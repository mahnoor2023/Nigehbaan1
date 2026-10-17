"use client";
import PageShell, { Loading } from "@/components/PageShell";
import { actions } from "@/lib/store";
import { useModel } from "@/lib/useModel";

export default function Page() {
  const m = useModel();
  if (m.loading || m.error) return <PageShell title="Shelter Desk"><Loading error={m.error} /></PageShell>;
  const { store, plan } = m;
  const cap = m.shelters.reduce((a, s) => a + s.capacity, 0);
  const occ = m.shelters.reduce((a, s) => a + (store.shelterOcc[s.id] ?? 0), 0);

  return (
    <PageShell title="Shelter Desk" subtitle={`${m.area?.label}: ${occ} of ~${cap} beds taken. Update arrivals; Command re-routes when a shelter fills up. Capacities are estimates by building type.`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {m.shelters.map((s) => {
          const o = store.shelterOcc[s.id] ?? 0;
          const incoming = plan.shelterLoad[s.id] ?? 0;
          const pct = Math.min(100, (o / s.capacity) * 100);
          const full = o >= s.capacity;
          return (
            <section key={s.id} className={`rounded-lg border bg-white p-3 ${full ? "border-red-400" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-semibold leading-tight">{s.name}</h2><div className="text-xs text-slate-500">{(s.kind ?? "shelter").replace("_", " ")} · cap ~{s.capacity}</div></div>
                {full ? <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">FULL</span> : o / s.capacity > 0.8 ? <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold">Almost full</span> : null}
              </div>
              <div className="mt-2 h-2 rounded bg-slate-100"><div className={`h-2 rounded ${full ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 flex justify-between text-xs text-slate-600"><span>{o} inside</span><span>{incoming} on the way (Command plan)</span></div>
              <div className="mt-2 flex items-center gap-1">
                {[-5, -1, 1, 5].map((d) => <button key={d} onClick={() => actions.setOcc(s.id, o + d)} className="rounded border border-slate-300 px-2 py-1 text-sm">{d > 0 ? `+${d}` : d}</button>)}
                <input type="number" min={0} value={o} onChange={(e) => actions.setOcc(s.id, Number(e.target.value))} className="ml-auto w-20 rounded border border-slate-300 px-2 py-1 text-sm" aria-label="Occupied beds" />
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
