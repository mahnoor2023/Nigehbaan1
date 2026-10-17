"use client";
import { useState } from "react";
import MapClient from "@/components/MapClient";
import { Loading } from "@/components/PageShell";
import { RES_COLOR, RES_ICON, Stat, TierBadge } from "@/components/ui";
import { TIER_COLOR, type Tier } from "@/lib/scoring";
import { actions } from "@/lib/store";
import { useModel } from "@/lib/useModel";

const severity = (l: number) => (l < 0.35 ? "Light rain" : l < 0.7 ? "Heavy rain, nala overflowing" : "Extreme flood");

export default function CommandPage() {
  const m = useModel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(true);

  if (m.loading || m.error || !m.area) return <div className="mx-auto w-full max-w-3xl p-4"><Loading error={m.error} /></div>;

  const { scored, plan, store } = m;
  const urgent = scored.filter((s) => s.score >= 25);
  const critical = scored.filter((s) => s.tier === "critical").length;
  const hiddenUrgent = urgent.filter((s) => s.h.source !== "survey").length;
  const sel = scored.find((s) => s.h.id === selectedId) ?? null;
  const selAssign = plan.assignments.find((a) => a.s.h.id === selectedId) ?? null;
  const selUnserved = plan.unserved.find((u) => u.s.h.id === selectedId) ?? null;

  const boatShort = Math.ceil(plan.unserved.filter((u) => u.s.need === "boat").reduce((a, u) => a + Math.min(u.s.people, 12), 0) / 6);
  const reasons = plan.unserved.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.reason]: (acc[u.reason] ?? 0) + 1 }), {});
  const tiers: Tier[] = ["critical", "high", "medium", "low"];

  return (
    <div className="mx-auto grid w-full max-w-[110rem] flex-1 gap-3 p-3 lg:h-[calc(100dvh-6.75rem)] lg:grid-cols-[400px_1fr]">
      {/* ---------- left panel ---------- */}
      <aside className="order-2 space-y-3 lg:order-1 lg:overflow-y-auto lg:pr-1">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Flood scenario</h2>
            <span className="text-xs font-medium text-sky-700">{severity(store.level)}</span>
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={store.level} onChange={(e) => actions.setLevel(Number(e.target.value))} className="mt-2 w-full accent-sky-600" aria-label="Flood severity" />
          <div className="flex justify-between text-[11px] text-slate-500"><span>Light</span><span>Heavy</span><span>Extreme</span></div>
          <p className="mt-1 text-xs text-slate-500">Slide to see priorities change. Early action: pre-position boats at the clusters that turn red first.</p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="High / critical" value={urgent.length} sub={`${critical} critical`} tone="red" />
          <Stat label="Unlisted but urgent" value={hiddenUrgent} sub="found by satellite / reports" tone="amber" />
          <Stat label="People reached" value={`${plan.peopleServed}`} sub={`of ${plan.peopleAtRisk} at risk`} tone="green" />
          <Stat label="Unserved" value={plan.unserved.length} sub={boatShort ? `~${boatShort} more boats needed` : "households"} tone="blue" />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
            <input type="checkbox" checked={showPlan} onChange={(e) => setShowPlan(e.target.checked)} /> Show dispatch plan on map
          </label>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
            {tiers.map((t) => <span key={t}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: TIER_COLOR[t] }} />{t}</span>)}
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-900 align-middle" />unlisted</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-violet-600 align-middle" />field report</span>
          </div>
          {Object.keys(reasons).length > 0 && (
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800">
              <b>Shortfall:</b> {Object.entries(reasons).map(([r, n]) => `${n} × ${r}`).join("; ")}
            </div>
          )}
        </section>

        {sel && (
          <section className="rounded-lg border-2 border-sky-400 bg-white p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{sel.h.id} <span className="text-xs font-normal text-slate-500">{sel.h.source === "survey" ? "official list" : sel.h.source === "satellite" ? "UNLISTED (satellite)" : "field report"}</span></h2>
              <TierBadge tier={sel.tier} score={sel.score} />
            </div>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-slate-700">{sel.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-slate-600">
              <span>People: {sel.people}</span><span>Needs: {sel.need}</span>
              <span>Height: {sel.h.ground_height_m ?? "?"} m</span><span>Nala: {sel.h.dist_to_waterway_m != null ? `${sel.h.dist_to_waterway_m} m` : "?"}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500"><span>Data confidence</span><span>{Math.round(sel.confidence * 100)}%</span></div>
              <div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-sky-500" style={{ width: `${sel.confidence * 100}%` }} /></div>
              {sel.missing.length > 0 && <p className="mt-1 text-xs text-amber-700">Guessed (missing): {sel.missing.join(", ")}</p>}
              {sel.unverified && <p className="text-xs font-medium text-amber-700">Unverified: send a field volunteer.</p>}
            </div>
            <div className="mt-2 rounded bg-slate-50 p-2 text-sm">
              {selAssign ? <><b style={{ color: RES_COLOR[selAssign.resource.type] }}>{selAssign.resource.label}</b> → {selAssign.shelter?.name}<div className="text-xs text-slate-500">{selAssign.legKm.toFixed(1)} km, ETA ~{selAssign.etaMin} min, carries {selAssign.load}</div></>
                : selUnserved ? <span className="text-red-700">Not served: {selUnserved.reason}</span>
                : <span className="text-slate-500">Below dispatch threshold in this scenario.</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => actions.setVerification(sel.h.id, "verified")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Mark verified</button>
              <button onClick={() => actions.setVerification(sel.h.id, "not_found")} className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white">Nobody found</button>
              {store.verifications[sel.h.id] && <button onClick={() => actions.setVerification(sel.h.id, null)} className="rounded border border-slate-300 px-2 py-1 text-xs">Undo</button>}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">Priority list (top 30)</h2>
          <ol>
            {scored.slice(0, 30).map((s, i) => {
              const a = plan.assignments.find((x) => x.s.h.id === s.h.id);
              return (
                <li key={s.h.id}>
                  <button onClick={() => setSelectedId(s.h.id)} className={`flex w-full items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-left hover:bg-slate-50 ${selectedId === s.h.id ? "bg-sky-50" : ""}`}>
                    <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                    <TierBadge tier={s.tier} score={s.score} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700"><b>{s.h.id}</b> {s.reasons[0] ?? ""}</span>
                    {a ? <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: RES_COLOR[a.resource.type] }} title={a.why}>{RES_ICON[a.resource.type]}</span>
                      : s.score >= 15 ? <span className="text-[10px] font-semibold text-red-600">WAIT</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </aside>

      {/* ---------- map ---------- */}
      <div className="order-1 h-[58dvh] min-h-[340px] overflow-hidden rounded-lg border border-slate-200 bg-white lg:order-2 lg:h-full">
        <MapClient area={m.area} scored={scored} shelters={m.shelters} resources={m.resources} plan={plan} showPlan={showPlan} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}
