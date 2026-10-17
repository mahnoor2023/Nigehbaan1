export type Source = "survey" | "satellite" | "report";

export type Household = {
  id: string;
  area: string;
  lat: number;
  lon: number;
  ground_height_m: number | null;
  dist_to_waterway_m: number | null;
  flood_history: number | null;
  night_light: number | null;
  building_area_m2: number | null;
  people_count_est: number | null;
  oldest_age_est: number | null;
  lives_alone_est: string | null;
  has_disability_est: string | null;
  chronic_illness_est: string | null;
  floor_est: string | null;
  phone_signal_est: string | null;
  has_smartphone_est: string | null;
  income_band_est: string | null;
  /** survey = on the official list, satellite = unlisted (found from building footprints), report = found by a field report */
  source: Source;
};

export type Shelter = {
  id: string;
  area: string;
  name: string;
  kind: string | null;
  lat: number;
  lon: number;
  capacity: number;
  capacity_is_estimate: boolean;
  placeholder: boolean;
};

export type ResourceType = "boat" | "truck" | "ambulance";
export type Resource = { id: string; area: string; type: ResourceType; label: string; capacity: number; lat: number; lon: number };

export type Area = { id: string; label: string; center: [number, number]; zoom: number; note: string | null; households: number };

export type WaterLevel = "none" | "ankle" | "knee" | "waist" | "above";
export type Verification = "verified" | "not_found";

export type FieldReport = {
  id: string;
  area: string;
  lat: number;
  lon: number;
  householdId: string | null;
  water: WaterLevel;
  people: number;
  needsMedical: boolean;
  note: string;
  ts: number;
  count: number; // how many duplicate reports were merged into this one
  synced: boolean;
};
