import { km } from "./geo";
import type { Need, Scored } from "./scoring";
import type { Resource, ResourceType, Shelter } from "./types";

export type Assignment = {
  s: Scored; resource: Resource; shelter: Shelter | null;
  legKm: number; etaMin: number; load: number; why: string;
};
export type Unserved = { s: Scored; reason: string };
export type Route = { resource: Resource; stops: Assignment[]; totalKm: number; carried: number };
export type Plan = {
  assignments: Assignment[]; unserved: Unserved[]; routes: Route[];
  shelterLoad: Record<string, number>;
  peopleAtRisk: number; peopleServed: number; riskCovered: number; riskTotal: number;
};

const SPEED: Record<ResourceType, number> = { boat: 12, truck: 25, ambulance: 35 }; // km/h (assumed)
const DETOUR = 1.35; // straight line -> road/water distance
const PREF: Record<Need, ResourceType[]> = { boat: ["boat"], truck: ["truck", "boat"], ambulance: ["ambulance", "boat", "truck"] };
const MEDICAL_KINDS = new Set(["hospital", "clinic"]);

/**
 * Greedy, explainable dispatch.
 *  1. take households in priority order (score high -> low)
 *  2. pick a shelter with free beds (medical cases prefer hospitals/clinics)
 *  3. pick the nearest suitable vehicle that still has seats; it then continues its route from that stop
 * Anything that cannot be served is returned with the reason: that is the shortfall.
 */
export function planDispatch(
  scored: Scored[], resources: Resource[], shelters: Shelter[], occupied: Record<string, number>,
  opts: { order?: "priority" | "listed"; minScore?: number } = {},
): Plan {
  const order = opts.order ?? "priority";
  const minScore = opts.minScore ?? 15;
  let cand = scored.filter((s) => s.score >= minScore);
  if (order === "priority") cand = [...cand].sort((a, b) => b.score - a.score);
  else cand = scored.filter((s) => s.h.source === "survey").sort((a, b) => (a.h.id < b.h.id ? -1 : 1)); // baseline: official list, first come first served

  const fleet = resources.map((r) => ({ r, pos: { lat: r.lat, lon: r.lon }, left: r.capacity, km: 0, stops: [] as Assignment[], carried: 0 }));
  const free: Record<string, number> = {};
  for (const sh of shelters) free[sh.id] = Math.max(0, sh.capacity - (occupied[sh.id] ?? 0));
  const load: Record<string, number> = {};

  const assignments: Assignment[] = [];
  const unserved: Unserved[] = [];
  const total = scored.reduce((a, s) => a + s.score, 0);

  for (const s of cand) {
    const need = Math.min(s.people, 12);
    // shelter
    let best: Shelter | null = null, bestCost = Infinity;
    for (const sh of shelters) {
      if (free[sh.id] < Math.min(need, 3)) continue;
      const medical = s.need === "ambulance";
      const cost = km(s.h, sh) + (medical && !MEDICAL_KINDS.has(sh.kind ?? "") ? 3 : 0);
      if (cost < bestCost) { best = sh; bestCost = cost; }
    }
    if (!best) { unserved.push({ s, reason: "All shelters are full" }); continue; }

    // vehicle
    let pick: (typeof fleet)[number] | null = null;
    for (const type of PREF[s.need]) {
      let d = Infinity;
      for (const f of fleet) {
        if (f.r.type !== type || f.left < Math.min(need, f.r.capacity)) continue;
        const dd = km(f.pos, s.h);
        if (dd < d) { d = dd; pick = f; }
      }
      if (pick) break;
    }
    if (!pick) { unserved.push({ s, reason: `No ${s.need === "ambulance" ? "ambulance/boat/truck" : s.need === "boat" ? "boat" : "truck/boat"} with free seats` }); continue; }

    const carried = Math.min(need, pick.left);
    const leg = km(pick.pos, s.h);
    pick.km += leg;
    pick.left -= carried; pick.carried += carried;
    pick.pos = { lat: s.h.lat, lon: s.h.lon };
    free[best.id] -= carried;
    load[best.id] = (load[best.id] ?? 0) + carried;
    const eta = Math.max(1, Math.round(((pick.km * DETOUR) / SPEED[pick.r.type]) * 60));
    const a: Assignment = {
      s, resource: pick.r, shelter: best, legKm: leg, etaMin: eta, load: carried,
      why: `${pick.r.label} (${leg.toFixed(1)} km, ETA ~${eta} min) then ${best.name}`,
    };
    pick.stops.push(a);
    assignments.push(a);
  }

  const served = assignments.reduce((a, x) => a + x.load, 0);
  const atRisk = cand.reduce((a, s) => a + Math.min(s.people, 12), 0);
  const covered = assignments.reduce((a, x) => a + x.s.score * (x.load / Math.max(1, Math.min(x.s.people, 12))), 0);
  return {
    assignments, unserved,
    routes: fleet.filter((f) => f.stops.length).map((f) => ({ resource: f.r, stops: f.stops, totalKm: f.km, carried: f.carried })),
    shelterLoad: load, peopleAtRisk: atRisk, peopleServed: served, riskCovered: covered, riskTotal: total,
  };
}
