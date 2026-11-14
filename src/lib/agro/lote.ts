// Lote (chacra) dibujado por el agricultor en el mapa: GeoJSON Polygon/MultiPolygon en WGS84 [lon, lat].
// Calcula hectáreas, centroide y en qué áreas NISAR cae.
import type { SerieHumedad } from "@/types/contratos";

type Anillo = [number, number][];
export type Poligono = Anillo[];

const RADIO_TIERRA_M = 6_378_137;
const rad = (g: number) => (g * Math.PI) / 180;

// Extrae los polígonos de un Polygon, MultiPolygon o Feature. Lanza un Error con mensaje claro si no es válido.
export function leerPoligonos(geo: unknown): Poligono[] {
  const g = (geo as { type?: string; geometry?: unknown })?.type === "Feature" ? (geo as { geometry: unknown }).geometry : geo;
  const { type, coordinates } = (g ?? {}) as { type?: string; coordinates?: unknown };
  const polys = type === "Polygon" ? [coordinates] : type === "MultiPolygon" ? (coordinates as unknown[]) : null;
  if (!polys) throw new Error("se espera un GeoJSON Polygon, MultiPolygon o Feature");

  return polys.map((p) => {
    if (!Array.isArray(p) || p.length === 0) throw new Error("polígono sin anillos");
    return p.map((anillo) => {
      if (!Array.isArray(anillo) || anillo.length < 4) throw new Error("cada anillo necesita al menos 4 puntos (cerrado)");
      return anillo.map((pt) => {
        const [lon, lat] = pt as number[];
        if (typeof lon !== "number" || typeof lat !== "number" || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
          throw new Error("coordenadas inválidas: se espera [lon, lat] en grados WGS84");
        }
        return [lon, lat] as [number, number];
      });
    });
  });
}

// Área geodésica de un anillo (aproximación esférica, misma fórmula que usa turf.js).
function areaAnillo(a: Anillo): number {
  let total = 0;
  for (let i = 0; i < a.length - 1; i++) {
    const [lon1, lat1] = a[i];
    const [lon2, lat2] = a[i + 1];
    total += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * RADIO_TIERRA_M * RADIO_TIERRA_M) / 2);
}

export function hectareas(polys: Poligono[]): number {
  const m2 = polys.reduce((s, p) => s + areaAnillo(p[0]) - p.slice(1).reduce((h, hueco) => h + areaAnillo(hueco), 0), 0);
  return Number((m2 / 10_000).toFixed(2));
}

export function bboxDe(polys: Poligono[]): [number, number, number, number] {
  const pts = polys.flatMap((p) => p[0]);
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

export function centroide(polys: Poligono[]): [number, number] {
  const pts = polys.flatMap((p) => p[0].slice(0, -1));
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [Number(lon.toFixed(6)), Number(lat.toFixed(6))];
}

const contiene = (b: number[], [lon, lat]: [number, number]) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
const seCruzan = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// Área NISAR del lote: la que contiene el centroide; si ninguna, la más cercana (con aviso).
export function ubicarLote(polys: Poligono[], series: SerieHumedad[]) {
  const c = centroide(polys);
  const bb = bboxDe(polys);
  const intersectadas = series.filter((s) => seCruzan(s.bbox, bb)).map((s) => s.id);
  const dentro = series.find((s) => contiene(s.bbox, c));
  if (dentro) return { serie: dentro, dentro: true, intersectadas, centroide: c, bbox: bb };

  const dist = (s: SerieHumedad) => Math.hypot((s.bbox[0] + s.bbox[2]) / 2 - c[0], (s.bbox[1] + s.bbox[3]) / 2 - c[1]);
  const cercana = [...series].sort((a, b) => dist(a) - dist(b))[0] ?? null;
  return { serie: cercana, dentro: false, intersectadas, centroide: c, bbox: bb };
}
