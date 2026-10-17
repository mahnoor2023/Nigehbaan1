"use client";
import { useState } from "react";
import PageShell, { Loading } from "@/components/PageShell";
import { TierBadge } from "@/components/ui";
import type { Tier } from "@/lib/scoring";
import { useModel } from "@/lib/useModel";

export default function Page() {
  const m = useModel();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [src, setSrc] = useState<"all" | "survey" | "satellite" | "report">("all");
  const [limit, setLimit] = useState(100);

  if (m.loading || m.error) return <PageShell title="Households"><Loading error={m.error} /></PageShell>;
  const rows = m.scored.filter((s) => (tier === "all" || s.tier === tier) && (src === "all" || s.h.source === src) && s.h.id.toLowerCase().includes(q.toLowerCase()));

  return (
    <PageShell title="Households" subtitle={`${m.area?.label}: every household, ranked by priority. Demographic columns are modelled estimates, not real people.`}>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID" className="rounded border border-slate-300 px-2 py-1" />
        <select value={tier} onChange={(e) => setTier(e.target.value as Tier | "all")} className="rounded border border-slate-300 px-2 py-1">
          <option value="all">All tiers</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select value={src} onChange={(e) => setSrc(e.target.value as typeof src)} className="rounded border border-slate-300 px-2 py-1">
          <option value="all">All sources</option><option value="survey">Official list</option><option value="satellite">Unlisted (satellite)</option><option value="report">Field report</option>
        </select>
        <span className="ml-auto self-center text-xs text-slate-500">{rows.length} households</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["#", "ID", "Priority", "Source", "People", "Oldest", "Height", "Nala", "Confidence", "Why"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((s, i) => (
              <tr key={s.h.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium">{s.h.id}</td>
                <td className="px-3 py-1.5"><TierBadge tier={s.tier} score={s.score} /></td>
                <td className="px-3 py-1.5 text-xs">{s.h.source === "survey" ? "official" : s.h.source === "satellite" ? "unlisted" : "report"}</td>
                <td className="px-3 py-1.5">{s.people}</td>
                <td className="px-3 py-1.5">{s.h.oldest_age_est ?? <span className="text-slate-400">?</span>}</td>
                <td className="px-3 py-1.5">{s.h.ground_height_m ?? <span className="text-slate-400">?</span>}</td>
                <td className="px-3 py-1.5">{s.h.dist_to_waterway_m ?? <span className="text-slate-400">?</span>}</td>
                <td className="px-3 py-1.5">{Math.round(s.confidence * 100)}%</td>
                <td className="px-3 py-1.5 text-xs text-slate-600">{s.reasons.join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <button onClick={() => setLimit(limit + 200)} className="mt-3 rounded border border-slate-300 bg-white px-3 py-1 text-sm">Show more</button>}
    </PageShell>
  );
}
