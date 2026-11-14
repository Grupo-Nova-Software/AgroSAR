// Geometría mínima sin dependencias: punto en polígono, bbox, distancias.
import type { Poligono } from "@/lib/agro/lote";

export type BBox = [number, number, number, number]; // [lon_min, lat_min, lon_max, lat_max]

export function puntoEnAnillo([x, y]: [number, number], anillo: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function puntoEnPoligonos(p: [number, number], polys: Poligono[]): boolean {
  return polys.some((poly) => puntoEnAnillo(p, poly[0]) && !poly.slice(1).some((h) => puntoEnAnillo(p, h)));
}

export function bboxDePoligonos(polys: Poligono[]): BBox {
  const pts = polys.flatMap((p) => p[0]);
  return [
    Math.min(...pts.map((p) => p[0])),
    Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])),
    Math.max(...pts.map((p) => p[1])),
  ];
}

export function bboxSeCruzan(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function leerBBox(s: string | null): BBox | null {
  if (!s) return null;
  const n = s.split(",").map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[0] >= n[2] || n[1] >= n[3]) return null;
  if (Math.abs(n[0]) > 180 || Math.abs(n[2]) > 180 || Math.abs(n[1]) > 90 || Math.abs(n[3]) > 90) return null;
  return n as BBox;
}

// Distancia aproximada en km entre dos puntos [lon, lat] (equirectangular; suficiente para pocos km).
export function distanciaKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const latm = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lon2 - lon1) * 111.32 * Math.cos(latm);
  const dy = (lat2 - lat1) * 110.57;
  return Math.hypot(dx, dy);
}
