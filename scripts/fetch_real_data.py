#!/usr/bin/env python3
"""
Fetch REAL geodata for Karachi zones and write data/areas/<id>/{households,shelters}.csv

REAL  : building locations + footprint (OpenStreetMap), ground height (Copernicus DEM via Open-Meteo),
        distance to nearest river/nala/drain (OpenStreetMap), shelters (OSM schools, hospitals, ...)
MODEL : household demographics (age, illness, income band, ...) are SIMULATED from the real footprint
        and published-style rates. They are NOT real people. Columns end in _est.

Usage (laptop or Colab):
    pip install requests
    python scripts/fetch_real_data.py                 # all zones in data/areas.json
    python scripts/fetch_real_data.py korangi lyari   # only some zones
    python scripts/fetch_real_data.py --n 400         # households per zone (default 300)
Then:  npm run data
"""
import csv, json, math, os, random, sys, time
import requests

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
ALLOWED = {"yes", "house", "residential", "apartments", "detached", "terrace", "semidetached_house", "hut", "bungalow", "dormitory"}


def overpass(query):
    last = None
    for attempt in range(3):
        for url in OVERPASS:
            try:
                r = requests.post(url, data={"data": query}, timeout=180)
                r.raise_for_status()
                return r.json()
            except Exception as e:  # noqa
                last = e
                print(f"  overpass retry ({url}): {e}")
                time.sleep(6)
    raise RuntimeError(f"Overpass failed: {last}")


def local_xy(lat, lon, lat0, lon0):
    return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 110540)


def poly_area_centroid(geom):
    lat0, lon0 = geom[0]["lat"], geom[0]["lon"]
    pts = [local_xy(p["lat"], p["lon"], lat0, lon0) for p in geom]
    a = 0.0
    for i in range(len(pts) - 1):
        a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    area = abs(a) / 2
    lat = sum(p["lat"] for p in geom) / len(geom)
    lon = sum(p["lon"] for p in geom) / len(geom)
    return area, lat, lon


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def elevations(points):
    out = []
    for i in range(0, len(points), 100):
        chunk = points[i:i + 100]
        lat = ",".join(f"{p[0]:.6f}" for p in chunk)
        lon = ",".join(f"{p[1]:.6f}" for p in chunk)
        for attempt in range(3):
            try:
                r = requests.get("https://api.open-meteo.com/v1/elevation", params={"latitude": lat, "longitude": lon}, timeout=60)
                r.raise_for_status()
                out += r.json()["elevation"]
                break
            except Exception as e:  # noqa
                print(f"  elevation retry: {e}")
                time.sleep(3)
        else:
            out += [None] * len(chunk)
        time.sleep(0.4)
    return out


def pick(rng, table):
    r = rng.random()
    acc = 0
    for k, p in table:
        acc += p
        if r <= acc:
            return k
    return table[-1][0]


def build_zone(cfg, n, seed):
    zid = cfg["id"]
    s, w, nn, e = cfg["bbox"]
    rng = random.Random(seed + sum(map(ord, zid)))
    print(f"[{zid}] buildings ...")
    data = overpass(f'[out:json][timeout:120];way["building"]({s},{w},{nn},{e});out geom 8000;')
    cands = []
    for el in data["elements"]:
        tags = el.get("tags", {})
        if tags.get("building", "yes") not in ALLOWED:
            continue
        geom = el.get("geometry")
        if not geom or len(geom) < 4:
            continue
        area, lat, lon = poly_area_centroid(geom)
        if area < 12 or area > 3000:
            continue
        lv = tags.get("building:levels")
        cands.append({"lat": lat, "lon": lon, "area": area, "levels": int(lv) if lv and lv.isdigit() else None})
    print(f"  {len(cands)} residential-like buildings; sampling {min(n, len(cands))}")
    if not cands:
        return None
    rng.shuffle(cands)
    cands = cands[:n]

    # shelters
    print(f"[{zid}] shelters ...")
    pad = 0.01
    sd = overpass(f'[out:json][timeout:90];nwr["amenity"~"^(school|hospital|clinic|community_centre|place_of_worship)$"]({s - pad},{w - pad},{nn + pad},{e + pad});out center;')
    shelters = []
    for el in sd["elements"]:
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None:
            continue
        kind = el["tags"].get("amenity")
        shelters.append({"name": el["tags"].get("name") or el["tags"].get("name:en") or kind, "kind": kind, "lat": lat, "lon": lon})
    print(f"  {len(shelters)} shelters")

    # waterways (look beyond the box: a nala just outside still floods you)
    print(f"[{zid}] waterways ...")
    wd = overpass(f'[out:json][timeout:90];way["waterway"~"^(river|stream|drain|canal)$"]({s - 0.02},{w - 0.02},{nn + 0.02},{e + 0.02});out geom;')
    lat0, lon0 = (s + nn) / 2, (w + e) / 2
    segs = []
    for el in wd["elements"]:
        g = el.get("geometry") or []
        pts = [local_xy(p["lat"], p["lon"], lat0, lon0) for p in g]
        segs += [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(len(pts) - 1)]
    print(f"  {len(segs)} waterway segments")

    print(f"[{zid}] elevation ...")
    elev = elevations([(c["lat"], c["lon"]) for c in cands])

    areas_sorted = sorted(c["area"] for c in cands)
    rows = []
    for i, (c, z) in enumerate(zip(cands, elev), 1):
        x, y = local_xy(c["lat"], c["lon"], lat0, lon0)
        dist = min((seg_dist(x, y, *sg) for sg in segs), default=None)
        pct = areas_sorted.index(c["area"]) / max(1, len(areas_sorted) - 1)
        wealth = pct + rng.uniform(-0.15, 0.15) + cfg.get("wealth", 0)
        income = "low" if wealth < 0.35 else ("medium" if wealth < 0.75 else "high")
        people = max(2, min(12, round(c["area"] / 18 + rng.uniform(-1.5, 1.5))))
        elderly = rng.random() < 0.12
        age = rng.randint(65, 88) if elderly else rng.randint(25, 62)
        alone = rng.random() < (0.5 if elderly and rng.random() < 0.4 else 0.04)
        if alone:
            people = 1 if elderly else min(people, 2)
        disability = "yes" if rng.random() < (0.15 if elderly else 0.06) else "no"
        chronic = pick(rng, [("none", 0.55), ("heart", 0.15), ("diabetes", 0.15), ("other", 0.15)]) if elderly else pick(rng, [("none", 0.9), ("heart", 0.03), ("diabetes", 0.04), ("other", 0.03)])
        if c["levels"] is not None:
            floor = "upper" if c["levels"] >= 2 else "ground"
        else:
            floor = "upper" if rng.random() < 0.2 else "ground"
        smart_p = {"low": 0.55, "medium": 0.78, "high": 0.93}[income]
        rows.append({
            "id": f"{zid[:3].upper()}-H{i:03d}",
            "lat": round(c["lat"], 7), "lon": round(c["lon"], 7),
            "ground_height_m": "" if z is None else round(z, 1),
            "dist_to_waterway_m": "" if dist is None else round(dist),
            "flood_history": "", "night_light": "",
            "building_area_m2": round(c["area"]),
            "people_count_est": people,
            "oldest_age_est": "" if rng.random() < 0.06 else age,   # deliberately missing sometimes
            "lives_alone_est": "yes" if alone else "no",
            "has_disability_est": disability,
            "chronic_illness_est": chronic,
            "floor_est": "" if rng.random() < 0.04 else floor,
            "phone_signal_est": "yes" if rng.random() < 0.9 else "no",
            "has_smartphone_est": "yes" if rng.random() < smart_p else "no",
            "income_band_est": "" if rng.random() < 0.06 else income,
            "source": "osm_building",
        })
    return rows, shelters


def main():
    args = sys.argv[1:]
    n = 300
    if "--n" in args:
        i = args.index("--n")
        n = int(args[i + 1])
        del args[i:i + 2]
    cfgs = json.load(open(os.path.join(ROOT, "data", "areas.json")))
    todo = [c for c in cfgs if not args or c["id"] in args]
    for cfg in todo:
        if cfg["id"] == "malir" and not args:
            print("[malir] keeping the existing sample (pass `malir` explicitly to re-fetch it)")
            continue
        res = build_zone(cfg, n, 20261017)
        if not res:
            print(f"[{cfg['id']}] nothing found, skipped")
            continue
        rows, shelters = res
        out = os.path.join(ROOT, "data", "areas", cfg["id"])
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "households.csv"), "w", newline="", encoding="utf8") as f:
            wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            wr.writeheader()
            wr.writerows(rows)
        with open(os.path.join(out, "shelters.csv"), "w", newline="", encoding="utf8") as f:
            wr = csv.DictWriter(f, fieldnames=["name", "kind", "lat", "lon"])
            wr.writeheader()
            wr.writerows(shelters)
        print(f"[{cfg['id']}] wrote {len(rows)} households, {len(shelters)} shelters -> {out}")
    print("\nDone. Now run:  npm run data")


if __name__ == "__main__":
    main()
