# Nigehbaan (نگہبان)

Flood-response prioritization for **CODE//CONNECT'26** (Problem 01: Disaster Response).

> During floods, warnings don't reach everyone. Nigehbaan finds the households most at risk, including ones missing from official lists, and matches scarce boats, vehicles and shelters to them in an order responders can read and trust.

## What works

| Route | Role | What it does |
|---|---|---|
| `/command` | Command Center | Map, flood-severity slider, ranked priority list with reasons, dispatch plan (routes, ETA, shelter), shortfall |
| `/households` | Command Center | Searchable, filterable table of every household |
| `/analytics` | Command Center | Nigehbaan vs first-come-first-served, tiers, demand vs seats, why people were not served |
| `/field` | Field App | Report water level, verify households, offline queue ("Simulate outage"), duplicate merging |
| `/shelter` | Shelter Desk | Beds and arrivals; Command re-routes when a shelter is full |
| `/about` | All | Scoring, missing-data behaviour, trade-offs, real vs simulated |

Area selector in the top bar switches between Karachi zones. Field reports, verifications and bed counts are shared between browser tabs (open `/field` and `/command` side by side to demo it live).

## Stack

Next.js (App Router) + TypeScript + Tailwind + Leaflet + Recharts. No backend: static JSON in `public/data/`, shared state in `localStorage`. Deploys on Vercel.

## Run

```bash
npm install
npm run data     # data/areas/*/*.csv -> public/data/*.json
npm run dev      # http://localhost:3000
npm run build
```

## Getting real data for more Karachi zones

```bash
pip install requests
python scripts/fetch_real_data.py              # every zone in data/areas.json except malir
python scripts/fetch_real_data.py korangi      # one zone
python scripts/fetch_real_data.py --n 400      # households per zone
npm run data
```

Add or move zones by editing `data/areas.json` (`bbox` = south, west, north, east).

**Real:** OSM building locations + footprints, Copernicus DEM ground height (Open-Meteo), distance to nearest river/nala/drain (OSM), shelters (OSM schools, hospitals, clinics, community centres, mosques).
**Simulated:** who lives in each building (`*_est` columns), the 20% "unlisted" flag, shelter capacities (by building type) and the rescue fleet. Demographics are modelled, not real people.

## Layout

```
data/areas.json          zones (bbox, label)
data/areas/<id>/         households.csv, shelters.csv per zone
scripts/build-data.mjs   CSV -> JSON (+ simulated fleet, capacities, unlisted flag)
scripts/fetch_real_data.py  real OSM + elevation fetch
src/lib/scoring.ts       explainable priority score
src/lib/dispatch.ts      greedy vehicle + shelter matching, shortfall
src/lib/store.ts         shared localStorage state (reports, bed counts, scenario)
src/lib/useModel.ts      data + scenario + reports -> scored households + plan
```
