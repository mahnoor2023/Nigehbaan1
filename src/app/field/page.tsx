"use client";
import { useState } from "react";
import PageShell, { Loading } from "@/components/PageShell";
import { TierBadge } from "@/components/ui";
import { WATER_LABEL } from "@/lib/scoring";
import { actions } from "@/lib/store";
import type { WaterLevel } from "@/lib/types";
import { useModel } from "@/lib/useModel";

const LEVELS: WaterLevel[] = ["none", "ankle", "knee", "waist", "above"];

export default function FieldPage() {
  const m = useModel();
  const [hid, setHid] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [water, setWater] = useState<WaterLevel>("knee");
  const [people, setPeople] = useState(4);
  const [medical, setMedical] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (m.loading || m.error || !m.area) return <PageShell title="Field App"><Loading error={m.error} /></PageShell>;
  const area = m.area;
  const { store } = m;
  const known = m.hs.filter((h) => h.source !== "report").sort((a, b) => (a.id < b.id ? -1 : 1));
  const pendingReports = store.reports.filter((r) => !r.synced && r.area === area.id);
  const pendingVer = Object.values(store.verifications).filter((v) => !v.synced).length;
  const tasks = m.scored.filter((s) => s.score >= 20 && !store.verifications[s.h.id] && !s.hasReport).slice(0, 8);

  function pickHousehold(id: string) {
    setHid(id);
    const h = known.find((x) => x.id === id);
    if (h) { setLat(String(h.lat)); setLon(String(h.lon)); }
  }
  function gps() {
    if (!navigator.geolocation) return setMsg("GPS not available. Enter coordinates by hand.");
    navigator.geolocation.getCurrentPosition((p) => { setLat(p.coords.latitude.toFixed(6)); setLon(p.coords.longitude.toFixed(6)); }, () => setMsg("GPS denied or unavailable."), { timeout: 8000 });
  }
  function submit() {
    const la = Number(lat || area.center[0]), lo = Number(lon || area.center[1]);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return setMsg("Location is not a valid number.");
    const { merged } = actions.addReport({ area: area.id, lat: la, lon: lo, householdId: hid || null, water, people: Math.max(1, people || 1), needsMedical: medical, note });
    setMsg(merged ? "Duplicate of a recent report: merged, not counted twice." : store.offline ? "Saved on the phone. Will send when the network is back." : "Sent to Command Center.");
    setNote("");
  }

  return (
    <PageShell title="Field App" subtitle="For volunteers on the ground: report what you see, verify households Command is unsure about.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className={`flex items-center justify-between rounded-lg border p-3 ${store.offline ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <div className="text-sm"><b>{store.offline ? "Network is DOWN" : "Network OK"}</b><div className="text-xs text-slate-600">{pendingReports.length + pendingVer} item(s) waiting to send</div></div>
            <div className="flex gap-2">
              <button onClick={() => actions.setOffline(!store.offline)} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">{store.offline ? "Network is back" : "Simulate outage"}</button>
              <button disabled={store.offline || pendingReports.length + pendingVer === 0} onClick={() => { actions.sync(); setMsg("Queued items sent."); }} className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-40">Send now</button>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="font-semibold">New report</h2>
            <label className="block text-sm">Which household?
              <select value={hid} onChange={(e) => pickHousehold(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
                <option value="">Not on the list (new household)</option>
                {known.map((h) => <option key={h.id} value={h.id}>{h.id}{h.source === "satellite" ? " (unlisted)" : ""}</option>)}
              </select>
            </label>
            {!hid && (
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-sm">
                <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder={`lat ${area.center[0]}`} className="rounded border border-slate-300 px-2 py-1.5" />
                <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder={`lon ${area.center[1]}`} className="rounded border border-slate-300 px-2 py-1.5" />
                <button onClick={gps} className="rounded border border-slate-300 px-2">GPS</button>
              </div>
            )}
            <div>
              <div className="text-sm">Water level</div>
              <div className="mt-1 grid grid-cols-5 gap-1">
                {LEVELS.map((l) => <button key={l} onClick={() => setWater(l)} className={`rounded border px-1 py-2 text-xs font-medium ${water === l ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white"}`}>{WATER_LABEL[l]}</button>)}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label>People <input type="number" min={1} max={30} value={people} onChange={(e) => setPeople(Number(e.target.value))} className="ml-1 w-16 rounded border border-slate-300 px-2 py-1" /></label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={medical} onChange={(e) => setMedical(e.target.checked)} /> Needs medical help</label>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            <button onClick={submit} className="w-full rounded bg-slate-900 py-2 font-medium text-white">Submit report</button>
            {msg && <p className="rounded bg-sky-50 p-2 text-sm text-sky-800">{msg}</p>}
          </section>

          {store.reports.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <h2 className="mb-1 font-semibold">My reports</h2>
              <ul className="divide-y divide-slate-100">
                {[...store.reports].reverse().slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-1">
                    <span>{r.householdId ?? "new household"} · {WATER_LABEL[r.water]} · {r.people} ppl{r.count > 1 ? ` · ×${r.count} merged` : ""}</span>
                    <span className={`text-xs font-semibold ${r.synced ? "text-emerald-600" : "text-amber-600"}`}>{r.synced ? "sent" : "queued"}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => { if (confirm("Clear all demo data (reports, verifications, bed counts)?")) actions.resetDemo(); }} className="mt-2 text-xs text-slate-500 underline">Reset demo data</button>
            </section>
          )}
        </div>

        <section className="h-fit rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="font-semibold">My tasks: verify these first</h2>
          <p className="text-xs text-slate-500">High-priority households whose data is estimated. Your check replaces the guess.</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {tasks.length === 0 && <li className="py-3 text-sm text-slate-500">Nothing to verify at this severity.</li>}
            {tasks.map((s) => (
              <li key={s.h.id} className="flex items-center gap-2 py-2">
                <TierBadge tier={s.tier} score={s.score} />
                <div className="min-w-0 flex-1 text-sm"><b>{s.h.id}</b>{s.h.source !== "survey" && <span className="ml-1 text-xs text-amber-700">unlisted</span>}<div className="truncate text-xs text-slate-500">{s.reasons[0]}</div></div>
                <button onClick={() => actions.setVerification(s.h.id, "verified")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Needs help</button>
                <button onClick={() => actions.setVerification(s.h.id, "not_found")} className="rounded bg-slate-500 px-2 py-1 text-xs font-medium text-white">Nobody</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
