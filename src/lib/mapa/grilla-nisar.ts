// Grilla REAL de NISAR SME2 (200 m) de TODO Itapúa, publicada por el rol Datos en /data/grilla/ como teselas
// (contrato contracts/humedad_grilla.schema.json v1; ver pipeline/07_exportar_grilla.py).
// Cada tesela trae, por fecha, un byte por celda en base64 (humedad × escala; `sin_dato` = sin estimación válida).
// Se carga una vez por instancia solo lo que toca el pedido (1 a 4 teselas por chacra) y se consulta en forma síncrona.

export const FUENTE_NISAR = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC";

export interface GrillaNisar {
  id: string;
  lat: number[]; // centros de fila, norte → sur
  lon: number[]; // centros de columna, oeste → este
  fechas: string[];
  humedad: Record<string, (number | null)[][]>;
  /** Bordes de la tesela [lon_min, lat_min, lon_max, lat_max]. Si falta, se deduce de los centros. */
  bbox?: BBox4;
}

/** Tesela tal como se publica (v1). */
interface TeselaPublicada {
  id: string;
  bbox: BBox4;
  lat: number[];
  lon: number[];
  fechas: string[];
  escala: number;
  sin_dato: number;
  humedad_b64: Record<string, string>;
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

/** Pasa una tesela publicada (bytes en base64) a matrices de números; `sin_dato` queda como null. */
export function decodificarTesela(t: TeselaPublicada): GrillaNisar {
  const filas = t.lat.length;
  const cols = t.lon.length;
  const humedad: GrillaNisar["humedad"] = {};
  for (const fecha of t.fechas) {
    const bytes = Buffer.from(t.humedad_b64[fecha] ?? "", "base64");
    if (bytes.length !== filas * cols) continue; // tesela dañada: esa fecha queda sin dato
    const m: (number | null)[][] = new Array(filas);
    for (let i = 0; i < filas; i++) {
      const fila: (number | null)[] = new Array(cols);
      for (let j = 0; j < cols; j++) {
        const b = bytes[i * cols + j];
        fila[j] = b === t.sin_dato ? null : b / t.escala;
      }
      m[i] = fila;
    }
    humedad[fecha] = m;
  }
  return { id: t.id, lat: t.lat, lon: t.lon, fechas: t.fechas.filter((f) => humedad[f]), humedad, bbox: t.bbox };
}

/**
 * Carga (una vez por instancia) las teselas NISAR que tocan `bbox` ([lon_min, lat_min, lon_max, lat_max]).
 * Los errores dejan la tesela ausente: quien consulta recibe null y debe decir que no hay dato (no inventarlo).
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
            if (!r.ok) return;
            const t = (await r.json()) as TeselaPublicada | GrillaNisar;
            cache.set(a.id, "humedad_b64" in t ? decodificarTesela(t) : t);
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

/** Bordes de la grilla: los publicados o, si no hay, los centros extremos más media celda. */
function bordesDe(g: GrillaNisar): BBox4 {
  if (g.bbox) return g.bbox;
  const n = g.lon.length;
  const k = g.lat.length;
  const dLon = n > 1 ? Math.abs(g.lon[1] - g.lon[0]) / 2 : 0;
  const dLat = k > 1 ? Math.abs(g.lat[1] - g.lat[0]) / 2 : 0;
  return (g.bbox = [
    Math.min(g.lon[0], g.lon[n - 1]) - dLon,
    Math.min(g.lat[0], g.lat[k - 1]) - dLat,
    Math.max(g.lon[0], g.lon[n - 1]) + dLon,
    Math.max(g.lat[0], g.lat[k - 1]) + dLat,
  ]);
}

function grillaDe(p: [number, number]): GrillaNisar | null {
  for (const g of cache.values()) {
    const [lo1, la1, lo2, la2] = bordesDe(g);
    if (p[0] >= lo1 && p[0] <= lo2 && p[1] >= la1 && p[1] <= la2) return g;
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

/**
 * Humedad media del bloque de (2·radio+1)² celdas alrededor de `p` en la pasada `fecha` (exacta).
 * Para un punto suelto (clima): una sola celda de 200 m es ruidosa; el bloque de 600 m es más estable.
 * Devuelve null si no hay tesela o esa fecha; { valor: null, celdas: 0 } si no hay ninguna celda válida.
 */
export function humedadNisarBloque(p: [number, number], fecha: string, radio = 1): { valor: number | null; celdas: number } | null {
  const g = grillaDe(p);
  const m = g?.humedad[fecha];
  if (!g || !m) return null;
  const i = cercano(g.lat, p[1]);
  const j = cercano(g.lon, p[0]);
  let suma = 0;
  let n = 0;
  for (let di = -radio; di <= radio; di++) for (let dj = -radio; dj <= radio; dj++) {
    const v = m[i + di]?.[j + dj];
    if (typeof v === "number") {
      suma += v;
      n++;
    }
  }
  return { valor: n ? Number((suma / n).toFixed(3)) : null, celdas: n };
}
