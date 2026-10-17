// Converts data/areas/<id>/{households,shelters}.csv (+ data/areas.json) into public/data/*.json
// Usage: npm run data
// - empty cells -> null (the app must never crash on missing values)
// - ~20% of households per area are marked source="satellite" (hidden/unlisted), seeded => deterministic. SIMULATED.
// - shelter capacity is an ESTIMATE by kind (unless the CSV has a capacity_est column)
// - rescue fleet (boats/trucks/ambulances) is SIMULATED and deliberately scarce
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const IN = path.join(ROOT, "data");
const OUT = path.join(ROOT, "public", "data");
fs.mkdirSync(OUT, { recursive: true });

const SEED = 20261017;
const SATELLITE_SHARE = 0.2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

function parseCsv(text) {
  const rows = []; let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false; else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}
const num = (v, d) => { if (v === "" || v == null) return null; const n = Number(v); if (!Number.isFinite(n)) return null; return d == null ? n : Number(n.toFixed(d)); };
const str = (v) => (v === "" || v == null ? null : v);

const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const meters = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const CAP = { hospital: 60, clinic: 25, school: 300, community_centre: 200, place_of_worship: 150 };
const FLEET = { boat: { cap: 6, per: 45, min: 2 }, truck: { cap: 15, per: 70, min: 2 }, ambulance: { cap: 3, per: 150, min: 1 } };

const areaCfg = JSON.parse(fs.readFileSync(path.join(IN, "areas.json"), "utf8"));
const areas = [], households = [], shelters = [], resources = [];

for (const cfg of areaCfg) {
  const dir = path.join(IN, "areas", cfg.id);
  const hhPath = path.join(dir, "households.csv");
  if (!fs.existsSync(hhPath)) { console.log(`skip ${cfg.id}: no households.csv (run scripts/fetch_real_data.py)`); continue; }

  // households
  const rows = parseCsv(fs.readFileSync(hhPath, "utf8"));
  const rand = mulberry32(SEED + hash(cfg.id));
  const idx = rows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const sat = new Set(idx.slice(0, Math.round(rows.length * SATELLITE_SHARE)));
  let hh = rows.map((r, i) => ({
    id: r.id, area: cfg.id,
    lat: num(r.lat), lon: num(r.lon),
    ground_height_m: num(r.ground_height_m, 1),
    dist_to_waterway_m: num(r.dist_to_waterway_m, 0),
    flood_history: num(r.flood_history, 3),
    night_light: num(r.night_light, 2),
    building_area_m2: num(r.building_area_m2, 0),
    people_count_est: num(r.people_count_est),
    oldest_age_est: num(r.oldest_age_est),
    lives_alone_est: str(r.lives_alone_est),
    has_disability_est: str(r.has_disability_est),
    chronic_illness_est: str(r.chronic_illness_est),
    floor_est: str(r.floor_est),
    phone_signal_est: str(r.phone_signal_est),
    has_smartphone_est: str(r.has_smartphone_est),
    income_band_est: str(r.income_band_est),
    source: sat.has(i) ? "satellite" : "survey",
  })).filter((h) => h.id && h.lat != null && h.lon != null);

  // shelters
  const shPath = path.join(dir, "shelters.csv");
  let sh = [];
  if (fs.existsSync(shPath)) {
    sh = parseCsv(fs.readFileSync(shPath, "utf8"))
      .map((r, i) => {
        const kind = str(r.kind);
        const given = num(r.capacity_est);
        return {
          id: `${cfg.id.slice(0, 3).toUpperCase()}-S${String(i + 1).padStart(2, "0")}`,
          area: cfg.id, name: str(r.name) ?? "Shelter", kind, lat: num(r.lat), lon: num(r.lon),
          capacity: given ?? CAP[kind ?? ""] ?? 100, capacity_is_estimate: true, placeholder: false,
        };
      })
      .filter((s) => s.lat != null && s.lon != null);
  }
  // a building that is itself a shelter is not a household
  const before = hh.length;
  hh = hh.filter((h) => !sh.some((s) => meters(h, s) < 20));
  if (before - hh.length) console.log(`${cfg.id}: dropped ${before - hh.length} building(s) that are shelters`);

  const c = hh.length
    ? [hh.reduce((a, h) => a + h.lat, 0) / hh.length, hh.reduce((a, h) => a + h.lon, 0) / hh.length]
    : [(cfg.bbox[0] + cfg.bbox[2]) / 2, (cfg.bbox[1] + cfg.bbox[3]) / 2];

  // simulated rescue fleet, based at shelters (or area centre), deliberately scarce
  let k = 0;
  for (const [type, f] of Object.entries(FLEET)) {
    const n = Math.max(f.min, Math.round(hh.length / f.per));
    for (let i = 0; i < n; i++, k++) {
      const base = sh.length ? sh[k % sh.length] : { lat: c[0], lon: c[1] };
      resources.push({
        id: `${cfg.id.slice(0, 3).toUpperCase()}-${type[0].toUpperCase()}${i + 1}`,
        area: cfg.id, type, label: `${type[0].toUpperCase()}${type.slice(1)} ${i + 1}`, capacity: f.cap,
        lat: Number((base.lat + (rand() - 0.5) * 0.002).toFixed(6)), lon: Number((base.lon + (rand() - 0.5) * 0.002).toFixed(6)),
      });
    }
  }

  areas.push({ id: cfg.id, label: cfg.label, center: [Number(c[0].toFixed(5)), Number(c[1].toFixed(5))], zoom: 14, note: cfg.note ?? null, households: hh.length });
  households.push(...hh); shelters.push(...sh);
  console.log(`${cfg.id}: ${hh.length} households (${hh.filter((h) => h.source === "satellite").length} unlisted), ${sh.length} shelters`);
}

if (!areas.length) { console.error("No area data found in data/areas/*"); process.exit(1); }
const w = (n, d) => fs.writeFileSync(path.join(OUT, n), JSON.stringify(d));
w("areas.json", areas); w("households.json", households); w("shelters.json", shelters); w("resources.json", resources);
console.log(`TOTAL households: ${households.length}, shelters: ${shelters.length}, resources: ${resources.length}`);
