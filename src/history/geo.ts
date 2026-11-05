import world from '../../data/world_110m.json';

export const K = 1000; // Mercator px per radian at zoom 1
const rad = (d: number) => (d * Math.PI) / 180;
export const merc = (lon: number, lat: number): [number, number] => [rad(lon) * K, -Math.log(Math.tan(Math.PI / 4 + rad(Math.max(-80, Math.min(80, lat))) / 2)) * K];

export type Country = {name: string; d: string; bbox: [number, number, number, number]; center: [number, number]};
const list: Country[] = [];
for (const c of (world as any).countries as {name: string; continent: string; rings: number[][][]}[]) {
  if (c.continent === 'Antarctica') continue;
  let d = '', x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, best = -1, center: [number, number] = [0, 0];
  for (const ring of c.rings) {
    if (ring.length < 3) continue;
    let rx0 = 1e9, ry0 = 1e9, rx1 = -1e9, ry1 = -1e9;
    const pts = ring.map(([lo, la]) => merc(lo, la));
    for (const [x, y] of pts) { rx0 = Math.min(rx0, x); ry0 = Math.min(ry0, y); rx1 = Math.max(rx1, x); ry1 = Math.max(ry1, y); }
    d += 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
    x0 = Math.min(x0, rx0); y0 = Math.min(y0, ry0); x1 = Math.max(x1, rx1); y1 = Math.max(y1, ry1);
    const area = (rx1 - rx0) * (ry1 - ry0);
    if (area > best) { best = area; center = [(rx0 + rx1) / 2, (ry0 + ry1) / 2]; }
  }
  list.push({name: c.name, d, bbox: [x0, y0, x1, y1], center});
}
export const COUNTRIES = list;
export const BY_NAME: Record<string, Country> = Object.fromEntries(list.map((c) => [c.name, c]));

export const PRESETS: Record<string, [number, number, number]> = { // centre lon, centre lat, span of longitude across the stage width
  italy: [12.8, 42.0, 15], med: [14.0, 38.5, 60], empire: [15.0, 40.5, 58], west_med: [5.0, 40.0, 40],
  east_med: [29.0, 37.5, 38], europe: [14.0, 47.0, 66], wide: [18.0, 38.0, 90],
};
export const CITIES: Record<string, [number, number]> = { // name -> lat, lon
  rome: [41.9, 12.5], carthage: [36.85, 10.32], athens: [37.98, 23.73], alexandria: [31.2, 29.9], constantinople: [41.0, 28.98],
  antioch: [36.2, 36.16], 'carthago nova': [37.6, -0.98], londinium: [51.5, -0.1], pyrenees: [42.6, 1.0], rhône: [44.2, 4.8],
  alps: [45.4, 7.3], 'po valley': [45.1, 10.3], cannae: [41.3, 16.13], lutetia: [48.85, 2.35], gades: [36.53, -6.29],
  syracuse: [37.07, 15.29], jerusalem: [31.77, 35.21], ctesiphon: [33.1, 44.58], mediolanum: [45.46, 9.19], zama: [35.9, 9.4],
  paris: [48.85, 2.35], london: [51.5, -0.12], cairo: [30.04, 31.24], istanbul: [41.0, 28.98], baghdad: [33.3, 44.4],
};
export type Place = {name: string; lat: number; lon: number};
export const resolvePlace = (p: any): Place => {
  if (typeof p === 'object') return {name: p.name, lat: p.lat, lon: p.lon};
  const s = String(p);
  if (s.includes('@')) { const [name, ll] = s.split('@'); const [lat, lon] = ll.split(',').map(Number); return {name: name.trim(), lat, lon}; }
  const c = CITIES[s.toLowerCase()];
  if (!c) throw new Error(`unknown place "${s}": use "Name@lat,lon" or one of ${Object.keys(CITIES).join(', ')}`);
  return {name: s, lat: c[0], lon: c[1]};
};
export const SEAS: [string, number, number][] = [['MEDITERRANEAN SEA', 17.5, 34.6], ['ATLANTIC OCEAN', -9.5, 36.0], ['BLACK SEA', 34.0, 43.2], ['NORTH SEA', 3.0, 56.0], ['BALTIC', 19.5, 57.8]];
export const parseYear = (s: any): number => {
  if (typeof s === 'number') return s;
  const m = String(s).match(/^\s*(\d+)\s*(BC|BCE|AD|CE)?\s*$/i);
  if (!m) throw new Error(`bad year ${s}`);
  return /^(BC|BCE)$/i.test(m[2] || '') ? -parseInt(m[1], 10) : parseInt(m[1], 10);
};
