"use client";

import { useEffect, useState } from "react";

type Status = "Pending" | "Assigned" | "En Route" | "Rescued" | "Completed";
type Mission = {
  id: string;
  household: string;
  responder: string;
  notes: string;
  status: Status;
  createdAt: number;
  updatedAt: number;
};
const KEY = "nigehbaan-demo-missions-v1";
const stages: Status[] = ["Pending", "Assigned", "En Route", "Rescued", "Completed"];

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [ready, setReady] = useState(false);
  const [household, setHousehold] = useState("");
  const [responder, setResponder] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(saved)) setMissions(saved);
    } catch { /* invalid local demo data */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(missions)); setError(""); }
    catch { setError("Could not save missions on this device. Check browser storage."); }
  }, [missions, ready]);

  function createMission(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!household.trim()) return;
    const now = Date.now();
    setMissions((prev) => [{
      id: crypto.randomUUID(), household: household.trim(), responder: responder.trim(),
      notes: notes.trim(), status: responder.trim() ? "Assigned" : "Pending",
      createdAt: now, updatedAt: now,
    }, ...prev]);
    setHousehold(""); setResponder(""); setNotes("");
  }
  function advance(id: string, status: Status) {
    setMissions((prev) => prev.map((m) => m.id === id ? { ...m, status, updatedAt: Date.now() } : m));
  }
  const active = missions.filter((m) => m.status !== "Completed").length;
  const completed = missions.length - active;
  const shown = missions.filter((m) => filter === "All" || m.status === filter);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-sky-700">Command Operations · Demo</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Rescue Mission Tracker</h1>
        <p className="mt-2 text-sm text-slate-600">Track rescue assignments and their progress. Demo data is stored only in this browser, not shared across devices.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["Total missions", missions.length], ["Active missions", active], ["Completed", completed]].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-3xl font-bold text-slate-900">{count}</div>
          </div>
        ))}
      </div>
      <form onSubmit={createMission} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Create rescue mission</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">Household ID *
            <input required maxLength={100} value={household} onChange={(e) => setHousehold(e.target.value)} placeholder="e.g. H-001" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm font-medium">Responder / team
            <input maxLength={100} value={responder} onChange={(e) => setResponder(e.target.value)} placeholder="e.g. Rescue Team A" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
        </div>
        <label className="block text-sm font-medium">Mission notes
          <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Location details, equipment needed, etc." className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
        </label>
        <button className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800">Create mission</button>
      </form>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Mission board</h2>
          <label className="text-sm">Status: <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border border-slate-300 bg-white p-2">
            {["All", ...stages].map((s) => <option key={s}>{s}</option>)}
          </select></label>
        </div>
        {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!ready ? <p>Loading missions...</p> : shown.length === 0 ? <p className="rounded-xl border bg-white p-6 text-slate-500">No missions found. Create one above to get started.</p> : shown.map((m) => (
          <article key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-bold text-slate-900">Household {m.household}</h3>
                <p className="mt-1 text-sm text-slate-600">Team: {m.responder || "Not assigned"}</p>
                {m.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{m.notes}</p>}
                <p className="mt-2 text-xs text-slate-400">Created {new Date(m.createdAt).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">{m.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label htmlFor={`status-${m.id}`} className="text-sm font-medium">Update status:</label>
              <select id={`status-${m.id}`} value={m.status} onChange={(e) => advance(m.id, e.target.value as Status)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                {stages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
