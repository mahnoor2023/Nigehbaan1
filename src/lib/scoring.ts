import type { Household, Verification, WaterLevel } from "./types";

export type Tier = "critical" | "high" | "medium" | "low";
export type Need = "boat" | "truck" | "ambulance";

export const TIER_COLOR: Record<Tier, string> = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#16a34a" };
export const TIER_LABEL: Record<Tier, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
export const WATER_LABEL: Record<WaterLevel, string> = { none: "No water", ankle: "Ankle", knee: "Knee", waist: "Waist", above: "Above head" };
const WATER_HAZARD: Record<WaterLevel, number> = { none: 0.05, ankle: 0.45, knee: 0.65, waist: 0.85, above: 1 };

/** Ground truth from a field report. Overrides the model for that household. */
export type Evidence = { water: WaterLevel; people: number; needsMedical: boolean } | null;

export type Scored = {
  h: Household;
  score: number; // 0-100
  tier: Tier;
  hazard: number; // 0-1  how likely the water reaches them
  vuln: number; // 0-1  how little they can help themselves
  confidence: number; // 0-1  how much of the input data was actually present
  need: Need;
  people: number;
  reasons: string[]; // top reasons, human readable
  missing: string[]; // fields we had to guess
  unverified: boolean;
  verification: Verification | null;
  hasReport: boolean;
};

export type AreaStats = { minH: number; maxH: number };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function areaStats(hs: Household[]): AreaStats {
  const v = hs.map((h) => h.ground_height_m).filter((x): x is number => x != null);
  return v.length ? { minH: Math.min(...v), maxH: Math.max(...v) } : { minH: 0, maxH: 1 };
}

export function tierOf(score: number): Tier {
  if (score >= 38) return "critical";
  if (score >= 25) return "high";
  if (score >= 12) return "medium";
  return "low";
}

/**
 * Transparent score:  score = 100 x hazard x (0.3 + 0.7 x vulnerability)
 *  hazard  = exposure (distance to nala/river, low ground, ground floor) pushed through the flood-severity slider,
 *            or the water level a volunteer actually reported
 *  vuln    = 0.5 x cannot-self-evacuate (age, disability, illness, alone)
 *          + 0.2 x cannot-be-warned (no smartphone / no signal / not on official list)
 *          + 0.3 x poverty
 * Missing fields never crash: they get a neutral guess, are listed in `missing`, and lower `confidence`.
 */
export function scoreHousehold(h: Household, st: AreaStats, level: number, ev: Evidence, ver: Verification | null): Scored {
  const why: { w: number; t: string }[] = [];
  const missing: string[] = [];

  // ---- hazard ----
  const g = h.ground_height_m, d = h.dist_to_waterway_m;
  const eElev = g != null && st.maxH > st.minH ? 1 - (g - st.minH) / (st.maxH - st.minH) : null;
  const eWater = d != null ? clamp01(1 - (d - 50) / 1450) : null;
  let ex: number | null = eElev != null && eWater != null ? 0.6 * eWater + 0.4 * eElev : (eWater ?? eElev);
  if (ex != null && h.floor_est === "ground") ex = Math.min(1, ex + 0.08);
  if (g == null) missing.push("ground height");
  if (d == null) missing.push("distance to nala");

  let hazard: number;
  if (ev) {
    hazard = WATER_HAZARD[ev.water];
    why.push({ w: hazard * 45, t: ev.water === "none" ? "Volunteer reports no water" : `Volunteer reports ${WATER_LABEL[ev.water].toLowerCase()}-deep water` });
  } else if (ex == null) {
    hazard = 0.5 * (0.4 + 0.6 * level);
  } else {
    hazard = clamp01((ex - (1 - level) + 0.15) / 0.3) * (0.4 + 0.6 * level);
    if (d != null && d < 400) why.push({ w: hazard * 40, t: `${Math.round(d)} m from nala/river` });
    else if (eElev != null && eElev > 0.6) why.push({ w: hazard * 35, t: "Low-lying ground" });
    if (h.floor_est === "ground") why.push({ w: hazard * 6, t: "Ground floor" });
  }

  // ---- vulnerability ----
  const age = h.oldest_age_est;
  if (age == null) missing.push("age");
  let cap = age == null ? 0.15 : age >= 80 ? 0.5 : age >= 65 ? 0.35 : 0;
  if (age != null && age >= 65) why.push({ w: cap * 30, t: `Elderly (${age})` });
  if (h.has_disability_est === "yes") { cap += 0.3; why.push({ w: 9 + hazard * 10, t: "Person with disability" }); }
  const chronic = h.chronic_illness_est;
  if (chronic && chronic !== "none") { cap += 0.15; why.push({ w: 6, t: `Chronic illness (${chronic})` }); }
  if (h.lives_alone_est == null) missing.push("lives alone");
  if (h.lives_alone_est === "yes") { cap += 0.15; why.push({ w: 6, t: "Lives alone" }); }
  if (h.has_disability_est == null) missing.push("disability");
  if (chronic == null) missing.push("illness");
  cap = clamp01(cap);

  let info = h.has_smartphone_est == null && h.phone_signal_est == null ? 0.25 : (h.has_smartphone_est === "no" ? 0.5 : 0) + (h.phone_signal_est === "no" ? 0.5 : 0);
  if (h.has_smartphone_est === "no" || h.phone_signal_est === "no") why.push({ w: 5 + info * 5, t: h.phone_signal_est === "no" ? "No phone signal: cannot get alerts" : "No smartphone: cannot get alerts" });
  if (h.source !== "survey") { info = Math.min(1, info + 0.25); why.push({ w: 6, t: h.source === "report" ? "Found by field report" : "Not on the official warning list" }); }

  let pov = 0.4;
  if (h.income_band_est === "low") pov = 1;
  else if (h.income_band_est === "medium") pov = 0.5;
  else if (h.income_band_est === "high") pov = 0;
  else missing.push("income");
  if (pov >= 0.5) why.push({ w: pov * 7, t: pov === 1 ? "Low income" : "Medium income" });

  const vuln = 0.5 * cap + 0.2 * info + 0.3 * pov;
  let score = 100 * hazard * (0.3 + 0.7 * vuln);
  if (ver === "not_found") score *= 0.15; // volunteer went there and nobody is in need
  score = Math.round(score);

  // ---- confidence ----
  const keys = 8;
  let confidence = (keys - Math.min(missing.length, keys)) / keys;
  if (h.source !== "survey" && ver !== "verified") confidence *= 0.6;
  if (ev || ver === "verified") confidence = Math.max(confidence, 0.9);

  const medical = !!ev?.needsMedical || h.has_disability_est === "yes" || (age != null && age >= 75) || chronic === "heart";
  const need: Need = medical ? "ambulance" : hazard >= 0.6 ? "boat" : "truck";
  const people = ev?.people ?? h.people_count_est ?? 4;
  if (ver === "not_found") why.unshift({ w: 99, t: "Volunteer found nobody needing help" });

  return {
    h, score, tier: tierOf(score), hazard, vuln, confidence, need, people,
    reasons: why.sort((a, b) => b.w - a.w).slice(0, 3).map((x) => x.t),
    missing, verification: ver, hasReport: !!ev,
    unverified: h.source !== "survey" && ver !== "verified" && !ev,
  };
}
