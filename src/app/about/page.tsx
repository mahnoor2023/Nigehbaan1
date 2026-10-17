import PageShell from "@/components/PageShell";

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <PageShell title="About and trade-offs" subtitle="Problem 01 (Disaster Response): who needs help most, and who gets the scarce boats first.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="How a household is scored (explainable, no black box)">
          <p><b>Priority = 100 × hazard × (0.3 + 0.7 × vulnerability).</b> Every number on screen comes with its top reasons.</p>
          <ul className="list-disc pl-5">
            <li><b>Hazard:</b> distance to nearest nala/river, low ground, ground floor, pushed through the flood-severity slider. If a volunteer reports water, the report overrides the model.</li>
            <li><b>Vulnerability:</b> 50% cannot self-evacuate (age, disability, illness, living alone), 20% cannot be warned (no smartphone/signal, not on the official list), 30% poverty.</li>
            <li><b>Dispatch:</b> households in priority order; each gets a shelter with free beds (medical cases prefer hospitals/clinics) and the nearest suitable vehicle with free seats, which then continues its route from there.</li>
          </ul>
        </Box>

        <Box title="When data is missing or wrong">
          <ul className="list-disc pl-5">
            <li>An empty field never crashes anything. It gets a neutral guess, is listed as &quot;guessed&quot;, and lowers the household&apos;s <b>confidence</b> bar.</li>
            <li>Households found only from satellite footprints are flagged <b>unverified</b> and their confidence is cut; the Field App lists them as tasks.</li>
            <li>A volunteer&apos;s check replaces the model: &quot;nobody found&quot; drops priority; a water report raises it. Duplicate reports (30 m, 10 min) are merged, not double counted.</li>
            <li>Network down: the Field App queues reports on the phone and sends them when the network returns (try &quot;Simulate outage&quot;).</li>
            <li>No terrain data for a household: hazard falls back to a mid value, never zero, so it is not silently ignored.</li>
          </ul>
        </Box>

        <Box title="What is real and what is simulated">
          <ul className="list-disc pl-5">
            <li><b>Real:</b> building locations and footprints (OpenStreetMap), ground height (satellite elevation model), distance to nala/river and shelters (OpenStreetMap).</li>
            <li><b>Simulated:</b> who lives in each building (age, illness, income band, phone) is modelled, not real people. The 20% &quot;unlisted&quot; flag, the shelter capacities, and the rescue fleet are also simulated assumptions. Columns ending in <code>_est</code> say so.</li>
          </ul>
        </Box>

        <Box title="Trade-offs we chose">
          <ul className="list-disc pl-5">
            <li><b>Explainable rules over machine learning:</b> responders must trust a priority order; there is no real flood outcome data to train on.</li>
            <li><b>Greedy dispatch over an optimal solver:</b> instant, easy to explain, good enough for a first wave. It is not guaranteed optimal.</li>
            <li><b>Straight-line distance</b> (with a detour factor) instead of road routing: works offline; real ETAs will differ.</li>
            <li><b>No backend:</b> data is static JSON and the shared state lives in the browser, so the demo works without internet services.</li>
            <li><b>Fairness:</b> vehicles go to the highest priority first, but poor and hidden households are scored up, not down, for being hard to reach or warn.</li>
          </ul>
        </Box>

        <Box title="Left out (and why)">
          <ul className="list-disc pl-5">
            <li>Live rainfall/river-gauge forecast feed: needs an API key; the severity slider stands in for a forecast.</li>
            <li>Road blockages and multi-trip rescue scheduling: would need road graph and time simulation.</li>
            <li>Real accounts and privacy controls: a real system must protect people&apos;s location and health data.</li>
          </ul>
        </Box>
      </div>
    </PageShell>
  );
}
