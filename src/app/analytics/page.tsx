"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageShell, { Loading } from "@/components/PageShell";
import { Stat } from "@/components/ui";
import { TIER_COLOR, TIER_LABEL, type Tier } from "@/lib/scoring";
import { useModel } from "@/lib/useModel";

export default function Page() {
  const m = useModel();
  if (m.loading || m.error) return <PageShell title="Analytics"><Loading error={m.error} /></PageShell>;
  const { scored, plan, baseline, resources } = m;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const tiers = (["critical", "high", "medium", "low"] as Tier[]).map((t) => ({ name: TIER_LABEL[t], count: scored.filter((s) => s.tier === t).length, fill: TIER_COLOR[t] }));
  const compare = [
    { name: "Risk covered (%)", "First come, first served": pct(baseline.riskCovered, baseline.riskTotal), Nigehbaan: pct(plan.riskCovered, plan.riskTotal) },
    { name: "High/critical reached", "First come, first served": baseline.assignments.filter((a) => a.s.score >= 25).length, Nigehbaan: plan.assignments.filter((a) => a.s.score >= 25).length },
    { name: "Unlisted reached", "First come, first served": baseline.assignments.filter((a) => a.s.h.source !== "survey").length, Nigehbaan: plan.assignments.filter((a) => a.s.h.source !== "survey").length },
  ];
  const types = ["boat", "truck", "ambulance"] as const;
  const wanted = [...plan.assignments.map((a) => a.s), ...plan.unserved.map((u) => u.s)];
  const demand = types.map((t) => ({
    name: t,
    "People needing it": wanted.filter((s) => s.need === t).reduce((x, s) => x + Math.min(s.people, 12), 0),
    "Seats available": resources.filter((r) => r.type === t).reduce((x, r) => x + r.capacity, 0),
  }));
  const reasons = plan.unserved.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.reason]: (acc[u.reason] ?? 0) + 1 }), {});

  return (
    <PageShell title="Analytics" subtitle={`${m.area?.label}, flood severity ${Math.round(m.store.level * 100)}%. Same boats and shelters, two ways of using them.`}>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Risk covered" value={`${pct(plan.riskCovered, plan.riskTotal)}%`} sub={`vs ${pct(baseline.riskCovered, baseline.riskTotal)}% first-come-first-served`} tone="green" />
        <Stat label="People reached" value={plan.peopleServed} sub={`of ${plan.peopleAtRisk} at risk`} tone="blue" />
        <Stat label="Unserved households" value={plan.unserved.length} tone="red" />
        <Stat label="Unlisted reached" value={plan.assignments.filter((a) => a.s.h.source !== "survey").length} sub="invisible to the official list" tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Nigehbaan vs first-come-first-served (official list order)">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={compare}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
            <Bar dataKey="First come, first served" fill="#94a3b8" /><Bar dataKey="Nigehbaan" fill="#0284c7" /></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Households by priority tier">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={tiers}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip />
            <Bar dataKey="count">{tiers.map((t) => <Cell key={t.name} fill={t.fill} />)}</Bar></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Shortfall: people needing a vehicle vs seats available">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={demand}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
            <Bar dataKey="People needing it" fill="#dc2626" /><Bar dataKey="Seats available" fill="#16a34a" /></BarChart></ResponsiveContainer>
        </Card>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h2 className="mb-2 font-semibold">Why households were not served</h2>
          {Object.keys(reasons).length === 0 ? <p className="text-slate-500">Everyone above the threshold has a vehicle and a bed.</p> :
            <ul className="space-y-1">{Object.entries(reasons).map(([r, n]) => <li key={r} className="flex justify-between"><span>{r}</span><b>{n}</b></li>)}</ul>}
          <p className="mt-3 text-xs text-slate-500">&quot;Risk covered&quot; = share of the total priority score that sits in households that got a vehicle and a bed. The fleet is simulated and deliberately scarce.</p>
        </section>
      </div>
    </PageShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="h-64">{children}</div>
    </section>
  );
}
