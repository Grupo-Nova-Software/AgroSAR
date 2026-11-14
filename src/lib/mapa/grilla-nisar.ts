// Grilla REAL de NISAR SME2 (200 m) publicada por el rol Datos en /data/humedad → /data/grilla/<distrito>.json
// (contrato contracts/humedad_grilla.schema.json). Se carga una vez por instancia y se consulta en forma síncrona
// desde la grilla de celdas del mapa y del lote. Si no hay grilla para un punto, quien llama usa el valor ficticio
// y lo marca como tal (fuente_humedad = "ficticia").

export const FUENTE_NISAR = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC";

export interface GrillaNisar {
  id: string;
  lat: number[]; // centros de fila, norte → sur
  lon: number[]; // centros de columna, oeste → este
  fechas: string[];
  humedad: Record<string, (number | null)[][]>;
}

type BBox4 = [number, number, number, number];
interface EntradaIndice { id: string; archivo: string; bbox: BBox4 }

const cache = new Map<string, GrillaNisar>();
const pendientes = new Map<string, Promise<void>>();
let indice: Promise<EntradaIndice[]> | null = null;

function cargarIndice(origen: string): Promise<EntradaIndice[]> {
  indice ??= fetch(new URL("/data/grilla/index.json", origen))
    .then((r) => (r.ok ? r.json() : { areas: [] }))
    .then((d) => (d.areas ?? []) as EntradaIndice[])
    .catch(() => {
      indice = null; // reintentar en el próximo pedido
      return [];
    });
  return indice;
}

/**
 * Carga (una vez por instancia) las grillas NISAR publicadas que tocan `bbox` ([lon_min, lat_min, lon_max, lat_max]).
 * Sirve para cualquier área de public/data/grilla/index.json, no solo los distritos de trabajo.
 * Los errores dejan la grilla ausente (quien consulta cae al valor ficticio y lo marca).
 */
export async function cargarGrillas(origen: string, bbox?: BBox4): Promise<void> {
  const areas = await cargarIndice(origen);
  const necesarias = areas.filter(
    (a) => !bbox || (a.bbox[0] <= bbox[2] && a.bbox[2] >= bbox[0] && a.bbox[1] <= bbox[3] && a.bbox[3] >= bbox[1]),
  );
  await Promise.all(
    necesarias.map((a) => {
      if (cache.has(a.id)) return Promise.resolve();
      let p = pendientes.get(a.id);
      if (!p) {
        p = fetch(new URL(`/data/grilla/${a.archivo}`, origen))
          .then(async (r) => {
            if (r.ok) cache.set(a.id, await r.json());
          })
          .catch(() => {})
          .finally(() => pendientes.delete(a.id));
        pendientes.set(a.id, p);
      }
      return p;
    }),
  );
}

/** true si hay grilla NISAR real cargada que cubre el punto. */
export const hayGrillaEn = (p: [number, number]) => grillaDe(p) !== null;

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
 * Devuelve null si NO hay grilla para el punto; { valor: null } si hay grilla pero NISAR no tiene dato válido ahí.
 * `exacta`: usar exactamente esa fecha de observación (para armar series); si no existe, null.
 */
export function humedadNisar(p: [number, number], fecha: string, exacta = false): { valor: number | null; fecha_obs: string } | null {
  const g = grillaDe(p);
  if (!g || g.fechas.length === 0) return null;
  const f = exacta ? fecha : fechaObs(g, fecha);
  const m = g.humedad[f];
  if (!m) return exacta ? null : { valor: null, fecha_obs: f };
  const i = cercano(g.lat, p[1]);
  const j = cercano(g.lon, p[0]);
  const directo = m[i]?.[j];
  if (typeof directo === "number") return { valor: directo, fecha_obs: f };
  const vecinos: number[] = [];
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const v = m[i + di]?.[j + dj];
    if (typeof v === "number") vecinos.push(v);
  }
  if (!vecinos.length) return { valor: null, fecha_obs: f }; // NISAR pasó pero no hay dato válido (agua, borde, calidad)
  return { valor: Number((vecinos.reduce((s, v) => s + v, 0) / vecinos.length).toFixed(3)), fecha_obs: f };
}

/** Fechas NISAR disponibles para un punto (vacío si no hay grilla real ahí). */
export function fechasNisar(p: [number, number]): string[] {
  return grillaDe(p)?.fechas ?? [];
}
