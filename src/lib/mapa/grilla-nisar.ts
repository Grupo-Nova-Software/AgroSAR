// Grilla REAL de NISAR SME2 (200 m) publicada por el rol Datos en /data/humedad → /data/grilla/<distrito>.json
// (contrato contracts/humedad_grilla.schema.json). Se carga una vez por instancia y se consulta en forma síncrona
// desde la grilla de celdas del mapa y del lote. Si no hay grilla para un punto, quien llama usa el valor ficticio
// y lo marca como tal (fuente_humedad = "ficticia").
import { DISTRITOS } from "./zonas";

export const FUENTE_NISAR = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC";

export interface GrillaNisar {
  id: string;
  lat: number[]; // centros de fila, norte → sur
  lon: number[]; // centros de columna, oeste → este
  fechas: string[];
  humedad: Record<string, (number | null)[][]>;
}

const cache = new Map<string, GrillaNisar>();
let cargando: Promise<void> | null = null;

/** Carga (una sola vez) las grillas de los distritos de trabajo. Los errores dejan la grilla ausente. */
export function cargarGrillas(origen: string): Promise<void> {
  if (cache.size === DISTRITOS.length) return Promise.resolve();
  cargando ??= Promise.all(
    DISTRITOS.map(async (d) => {
      try {
        const r = await fetch(new URL(`/data/grilla/${d.id}.json`, origen));
        if (r.ok) cache.set(d.id, await r.json());
      } catch {
        /* sin grilla real para este distrito */
      }
    }),
  ).then(() => {
    cargando = null;
  });
  return cargando;
}

/** Solo para tests: cargar una grilla a mano o vaciar la caché. */
export function _registrarGrilla(g: GrillaNisar | null) {
  if (g) cache.set(g.id, g);
  else cache.clear();
}

/** Índice del valor más cercano en un arreglo ordenado (ascendente o descendente). */
function cercano(arr: number[], v: number): number {
  const asc = arr[arr.length - 1] >= arr[0];
  let lo = 0, hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((arr[mid] < v) === asc) lo = mid;
    else hi = mid;
  }
  return Math.abs(arr[lo] - v) <= Math.abs(arr[hi] - v) ? lo : hi;
}

function grillaDe(p: [number, number]): GrillaNisar | null {
  for (const g of cache.values()) {
    const [lonMin, lonMax] = [g.lon[0], g.lon[g.lon.length - 1]];
    const [latA, latB] = [g.lat[0], g.lat[g.lat.length - 1]];
    if (p[0] >= lonMin && p[0] <= lonMax && p[1] >= Math.min(latA, latB) && p[1] <= Math.max(latA, latB)) return g;
  }
  return null;
}

/** Fecha NISAR a usar para `fecha`: la última observación ≤ fecha; si no hay, la primera. */
function fechaObs(g: GrillaNisar, fecha: string): string {
  const previas = g.fechas.filter((f) => f <= fecha);
  return previas.length ? previas[previas.length - 1] : g.fechas[0];
}

/**
 * Humedad real de la celda NISAR más cercana a `p`. Si esa celda no tiene dato, promedia sus vecinas (3×3).
 * `exacta`: usar exactamente esa fecha de observación (para armar series); si no existe, null.
 */
export function humedadNisar(p: [number, number], fecha: string, exacta = false): { valor: number; fecha_obs: string } | null {
  const g = grillaDe(p);
  if (!g || g.fechas.length === 0) return null;
  const f = exacta ? fecha : fechaObs(g, fecha);
  const m = g.humedad[f];
  if (!m) return null;
  const i = cercano(g.lat, p[1]);
  const j = cercano(g.lon, p[0]);
  const directo = m[i]?.[j];
  if (typeof directo === "number") return { valor: directo, fecha_obs: f };
  const vecinos: number[] = [];
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const v = m[i + di]?.[j + dj];
    if (typeof v === "number") vecinos.push(v);
  }
  if (!vecinos.length) return null;
  return { valor: Number((vecinos.reduce((s, v) => s + v, 0) / vecinos.length).toFixed(3)), fecha_obs: f };
}

/** Fechas NISAR disponibles para un punto (vacío si no hay grilla real ahí). */
export function fechasNisar(p: [number, number]): string[] {
  return grillaDe(p)?.fechas ?? [];
}
