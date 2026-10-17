"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { actions, useStore } from "@/lib/store";
import { useData } from "@/lib/useData";

const ROLES = [
  { href: "/command", label: "Command Center", match: ["/command", "/households", "/analytics", "/missions"] },
  { href: "/field", label: "Field App", match: ["/field"] },
  { href: "/shelter", label: "Shelter Desk", match: ["/shelter"] },
];
const LINKS = [
  { href: "/command", label: "Command" },
  { href: "/households", label: "Households" },
  { href: "/analytics", label: "Analytics" },
  { href: "/missions", label: "Missions" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const { areas } = useData();
  const store = useStore();
  const current = store.area ?? areas[0]?.id ?? "";
  const pending = store.reports.filter((r) => !r.synced).length + Object.values(store.verifications).filter((v) => !v.synced).length;

  return (
    <header className="sticky top-0 z-[1000] bg-slate-900 text-white shadow">
      <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <Link href="/command" className="text-lg font-bold tracking-tight">
          Nigehbaan <span className="font-normal text-slate-400">نگہبان</span>
        </Link>

        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400">Area</span>
          <select
            value={current}
            onChange={(e) => actions.setArea(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white outline-none focus:border-sky-400"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.label} ({a.households})</option>
            ))}
          </select>
        </label>

        {store.offline && <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-900">OFFLINE{pending ? ` · ${pending} queued` : ""}</span>}

        <div role="tablist" aria-label="Switch role" className="ml-auto flex overflow-x-auto rounded-lg bg-slate-800 p-1">
          {ROLES.map((r) => {
            const active = r.match.some((m) => pathname.startsWith(m));
            return (
              <Link key={r.label} href={r.href} role="tab" aria-selected={active}
                className={`whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition ${active ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>
      <nav className="mx-auto flex max-w-[110rem] gap-1 overflow-x-auto px-3 pb-1.5 text-sm" aria-label="Pages">
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link key={l.href + l.label} href={l.href}
              className={`whitespace-nowrap rounded px-2 py-0.5 ${active ? "bg-slate-700 font-semibold text-white" : "text-slate-400 hover:text-white"}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
