"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Plan } from "@/lib/dispatch";
import { TIER_COLOR, type Scored } from "@/lib/scoring";
import type { Area, Resource, Shelter } from "@/lib/types";
import { RES_COLOR, RES_ICON } from "./ui";

export type MapProps = {
  area: Area;
  scored: Scored[];
  shelters: Shelter[];
  resources: Resource[];
  plan: Plan;
  showPlan: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const GLYPH: Record<string, string> = { school: "S", hospital: "H", clinic: "C", community_centre: "C", place_of_worship: "M" };

function shelterIcon(s: Shelter) {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:6px;background:#1d4ed8;color:#fff;font:700 12px/24px system-ui;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">${GLYPH[s.kind ?? ""] ?? "S"}</div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  });
}
function resourceIcon(r: Resource) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${RES_COLOR[r.type]};color:#fff;font:700 13px/22px system-ui;text-align:center;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)">${RES_ICON[r.type]}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  });
}

function FlyTo({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lon != null) map.flyTo([lat, lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [lat, lon, map]);
  return null;
}

export default function MapView({ area, scored, shelters, resources, plan, showPlan, selectedId, onSelect }: MapProps) {
  const sel = scored.find((s) => s.h.id === selectedId) ?? null;
  const selAssign = plan.assignments.find((a) => a.s.h.id === selectedId) ?? null;
  const servedIds = new Set(plan.assignments.map((a) => a.s.h.id));

  return (
    <MapContainer key={area.id} center={area.center} zoom={area.zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo lat={sel?.h.lat ?? null} lon={sel?.h.lon ?? null} />

      {showPlan && plan.routes.map((r) => (
        <Polyline key={r.resource.id} positions={[[r.resource.lat, r.resource.lon], ...r.stops.map((a) => [a.s.h.lat, a.s.h.lon] as [number, number])]}
          pathOptions={{ color: RES_COLOR[r.resource.type], weight: 3, opacity: 0.8, dashArray: "6 6" }} />
      ))}
      {selAssign?.shelter && (
        <Polyline positions={[[selAssign.s.h.lat, selAssign.s.h.lon], [selAssign.shelter.lat, selAssign.shelter.lon]]} pathOptions={{ color: "#1d4ed8", weight: 4, opacity: 0.9 }} />
      )}

      {scored.map((s) => {
        const hidden = s.h.source !== "survey";
        const served = showPlan && servedIds.has(s.h.id);
        return (
          <CircleMarker key={s.h.id} center={[s.h.lat, s.h.lon]} radius={5 + Math.min(s.score, 60) / 8}
            eventHandlers={{ click: () => onSelect(s.h.id) }}
            pathOptions={{
              color: s.h.source === "report" ? "#7c3aed" : hidden ? "#111827" : "#ffffff",
              weight: hidden ? 2.5 : 1, fillColor: TIER_COLOR[s.tier], fillOpacity: showPlan && !served && s.score >= 15 ? 0.45 : 0.9,
              dashArray: showPlan && s.score >= 15 && !served ? "2 3" : undefined,
            }}>
            <Tooltip direction="top" offset={[0, -6]}>{s.h.id} · {s.tier} {s.score}</Tooltip>
          </CircleMarker>
        );
      })}
      {sel && <CircleMarker center={[sel.h.lat, sel.h.lon]} radius={16} pathOptions={{ color: "#0ea5e9", weight: 3, fill: false }} interactive={false} />}

      {shelters.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lon]} icon={shelterIcon(s)}>
          <Tooltip direction="top" offset={[0, -10]}>{s.name} · cap ~{s.capacity}</Tooltip>
        </Marker>
      ))}
      {resources.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lon]} icon={resourceIcon(r)}>
          <Tooltip direction="top" offset={[0, -10]}>{r.label} · seats {r.capacity}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
