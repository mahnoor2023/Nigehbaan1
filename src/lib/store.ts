"use client";
import { useSyncExternalStore } from "react";
import { km } from "./geo";
import type { FieldReport, Verification, WaterLevel } from "./types";

// Tiny shared store backed by localStorage (no backend). Other browser tabs update live through the `storage` event,
// so a report sent from /field shows up on /command in a second tab.
export type StoreState = {
  area: string | null;
  level: number; // flood severity 0.1 - 1
  offline: boolean; // field app simulates a dead network
  reports: FieldReport[];
  verifications: Record<string, { v: Verification; synced: boolean }>;
  shelterOcc: Record<string, number>;
};

const KEY = "nigehbaan-v1";
const EMPTY: StoreState = { area: null, level: 0.55, offline: false, reports: [], verifications: {}, shelterOcc: {} };
const WORSE: WaterLevel[] = ["none", "ankle", "knee", "waist", "above"];

let state: StoreState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    state = EMPTY;
  }
}
function emit() { listeners.forEach((l) => l()); }
function set(next: StoreState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep in memory */ }
  emit();
}
function onStorage(e: StorageEvent) { if (e.key === KEY) { load(); emit(); } }

function subscribe(cb: () => void) {
  if (!loaded) { load(); loaded = true; window.addEventListener("storage", onStorage); }
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

export const actions = {
  setArea: (area: string) => set({ ...state, area }),
  setLevel: (level: number) => set({ ...state, level }),
  setOffline: (offline: boolean) => set({ ...state, offline }),

  /** Adds a report. A report within 30 m and 10 min of an existing one for the same household is merged (duplicate). */
  addReport(r: Omit<FieldReport, "id" | "ts" | "count" | "synced">): { merged: boolean } {
    const now = Date.now();
    const dup = state.reports.find((x) => x.area === r.area && now - x.ts < 600_000 && km(x, r) < 0.03 && x.householdId === r.householdId);
    if (dup) {
      const merged: FieldReport = {
        ...dup, ts: now, count: dup.count + 1, people: Math.max(dup.people, r.people),
        needsMedical: dup.needsMedical || r.needsMedical,
        water: WORSE.indexOf(r.water) > WORSE.indexOf(dup.water) ? r.water : dup.water,
        note: r.note || dup.note, synced: dup.synced && !state.offline,
      };
      set({ ...state, reports: state.reports.map((x) => (x.id === dup.id ? merged : x)) });
      return { merged: true };
    }
    const rep: FieldReport = { ...r, id: `R-${now.toString(36).slice(-5)}${Math.floor(Math.random() * 36).toString(36)}`, ts: now, count: 1, synced: !state.offline };
    set({ ...state, reports: [...state.reports, rep] });
    return { merged: false };
  },
  setVerification(id: string, v: Verification | null) {
    const next = { ...state.verifications };
    if (v) next[id] = { v, synced: !state.offline }; else delete next[id];
    set({ ...state, verifications: next });
  },
  /** Push queued (offline) reports and verifications to the command centre. */
  sync() {
    const verifications = Object.fromEntries(Object.entries(state.verifications).map(([k, x]) => [k, { ...x, synced: true }]));
    set({ ...state, reports: state.reports.map((r) => ({ ...r, synced: true })), verifications });
  },
  setOcc: (id: string, n: number) => set({ ...state, shelterOcc: { ...state.shelterOcc, [id]: Math.max(0, Math.round(n)) } }),
  resetDemo: () => set({ ...EMPTY, area: state.area }),
};
