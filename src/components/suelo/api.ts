// Llamadas del frontend al motor del backend (ver src/app/api/README.md) y utilidades de geometría del mapa.
// Tipos MÍNIMOS que usa la UI: cuando haya contracts/analisis.schema.json, reemplazarlos por los compartidos.
import type { EstadoRecomendacion, PuntoSerie } from "@/types/contratos";

export type PoligonoGeoJSON = { type: "Polygon"; coordinates: [number, number][][] };
export type LonLat = [number, number];
export type EstadoHumedad = "seco" | "bajo" | "optimo" | "humedo" | "saturado" | "sin_datos";

export interface Alerta {
  id: string;
  nivel: "info" | "advertencia" | "critico";
  categoria?: string;
  titulo: string;
  detalle?: string;
  recomendacion?: string;
  fuente_dato?: string;
}

export interface Analisis {
  area_id: string | null;
  cultivo: string;
  fecha: string;
  estado: EstadoRecomendacion;
  humedad: {
    estado: EstadoHumedad;
    media_m3m3: number | null;
    ultima_fecha: string | null;
    tendencia: "subiendo" | "bajando" | "estable" | null;
    dias_desde_observacion: number | null;
    desactualizada: boolean;
    fuente: string;
  };
  temporada: {
    estado: "en_ventana" | "tramo_tardio" | "temprana" | "tardia" | "fuera";
    dias_restantes: number | null;
    dias_fuera: number | null;
    proxima: { nombre: string; inicio: string; dias_hasta: number } | null;
  };
  semilla?: { semilla: string; ciclo_sugerido?: { nombre: string; dias: number } | null };
  alertas: Alerta[];
  es_ejemplo: boolean;
}

export interface UmbralesHumedad { seco_max: number; bajo_max: number; optimo_max: number; saturado_min: number }
export const UMBRALES_DEFECTO: UmbralesHumedad = { seco_max: 0.15, bajo_max: 0.2, optimo_max: 0.35, saturado_min: 0.4 };

export interface ResultadoLote {
  lote: { hectareas: number; area_referencia?: { id: string; zona: string; dentro: boolean } | null };
  analisis: Analisis;
  serie?: PuntoSerie[];
}

async function json<T>(r: Response): Promise<T> {
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error ?? `error ${r.status}`);
  return d as T;
}

export const pedirAnalisis = async (area: string, cultivo: string) =>
  json<Analisis>(await fetch(`/api/analisis?area=${encodeURIComponent(area)}&cultivo=${cultivo}`));

/** Estado por área (para el borde de cada zona en el mapa). */
export async function pedirEstados(cultivo: string): Promise<Record<string, EstadoRecomendacion>> {
  const d = await json<{ areas: { area_id: string; estado: EstadoRecomendacion }[] }>(await fetch(`/api/ranking?cultivo=${cultivo}`));
  return Object.fromEntries(d.areas.map((a) => [a.area_id, a.estado]));
}

export const analizarLote = async (poligono: PoligonoGeoJSON, cultivo: string) =>
  json<ResultadoLote>(
    await fetch("/api/lote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cultivo, poligono }) }),
  );

/** Límites de seco / bueno / mojado del cultivo (config del backend). */
export async function pedirUmbrales(cultivo: string): Promise<UmbralesHumedad> {
  try {
    const d = await json<{ cultivo?: { humedad?: UmbralesHumedad } }>(await fetch(`/api/cultivos?id=${cultivo}`));
    return d.cultivo?.humedad ?? UMBRALES_DEFECTO;
  } catch {
    return UMBRALES_DEFECTO;
  }
}

// ---------- Geometría de la chacra ----------

const M_LAT = 110_570;
const mLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Hectáreas de un polígono de esquinas [lon, lat] (aproximación plana, suficiente para una chacra). */
export function hectareasDe(v: LonLat[]): number {
  if (v.length < 3) return 0;
  const k = mLon(v.reduce((s, p) => s + p[1], 0) / v.length);
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const [x1, y1] = v[i];
    const [x2, y2] = v[(i + 1) % v.length];
    a += x1 * k * (y2 * M_LAT) - x2 * k * (y1 * M_LAT);
  }
  return Math.abs(a) / 2 / 10_000;
}

/**
 * Inserta una esquina nueva donde menos alarga el contorno (entre las dos esquinas vecinas más convenientes).
 * Así la chacra sale bien aunque se toquen las esquinas en cualquier orden, y no se forman "moños".
 */
export function insertarEsquina(v: LonLat[], p: LonLat): LonLat[] {
  if (v.length < 3) return [...v, p];
  const k = mLon(p[1]);
  const d = (a: LonLat, b: LonLat) => Math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * M_LAT);
  let mejor = v.length;
  let costoMin = Infinity;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const costo = d(a, p) + d(p, b) - d(a, b);
    if (costo < costoMin) {
      costoMin = costo;
      mejor = i + 1;
    }
  }
  return [...v.slice(0, mejor), p, ...v.slice(mejor)];
}

export const dentroDe = (p: LonLat, bbox: [number, number, number, number]) =>
  p[0] >= bbox[0] && p[0] <= bbox[2] && p[1] >= bbox[1] && p[1] <= bbox[3];
