type P = { lat: number; lon: number };
const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
/** great-circle distance in km */
export function km(a: P, b: P): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
