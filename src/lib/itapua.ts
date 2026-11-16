// Itapúa: contorno real del departamento (config/zonas/itapua_contorno.json, de OpenStreetMap, ODbL).
// Lo usan igual el backend (rechazar chacras de afuera), el mapa de la app (dibujar el borde y tapar lo de afuera)
// y el pipeline (recortar los datos NISAR). Un solo archivo = todos coinciden en qué es "dentro de Itapúa".
import contorno from "../../config/zonas/itapua_contorno.json";

export type LonLat = [number, number];
export type BBox4 = [number, number, number, number]; // [lon_min, lat_min, lon_max, lat_max]

export const ITAPUA_ID = "itapua";
export const ITAPUA_NOMBRE = contorno.nombre;
export const ITAPUA_BBOX = contorno.bbox as BBox4;
/** Centroide del departamento [lon, lat]. */
export const ITAPUA_CENTRO = contorno.centro as LonLat;
/** Anillo exterior cerrado, [lon, lat]. */
export const ITAPUA_ANILLO = contorno.anillo as LonLat[];
export const ITAPUA_FUENTE = contorno._fuente;

/** ¿El punto cae dentro del departamento de Itapúa? (trazado de rayos sobre el contorno) */
export function dentroDeItapua(lon: number, lat: number): boolean {
  const [lo1, la1, lo2, la2] = ITAPUA_BBOX;
  if (lon < lo1 || lon > lo2 || lat < la1 || lat > la2) return false;
  const a = ITAPUA_ANILLO;
  let dentro = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i];
    const [xj, yj] = a[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** ¿Todas las esquinas están dentro de Itapúa? */
export const todoDentroDeItapua = (puntos: readonly (readonly [number, number])[]) => puntos.length > 0 && puntos.every(([lon, lat]) => dentroDeItapua(lon, lat));
