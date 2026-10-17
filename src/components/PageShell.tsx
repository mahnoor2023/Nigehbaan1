export default function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </main>
  );
}

export function Loading({ error }: { error?: string | null }) {
  if (error) return <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Could not load data: {error}. Run <code>npm run data</code>.</div>;
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Loading data...</div>;
}
