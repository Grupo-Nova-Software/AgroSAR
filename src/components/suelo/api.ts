// Llamadas del frontend al motor del backend (src/app/api/README.md en la rama backend).
// Tipos MÍNIMOS que usa la UI: cuando el backend publique contracts/analisis.schema.json, reemplazarlos
// por los tipos compartidos de src/types/contratos.ts.
// Si /api/analisis o /api/ranking no existen todavía en el deploy, se cae a /api/recomendacion (contrato v0).
import type { EstadoRecomendacion, Recomendacion } from "@/types/contratos";
import type { Idioma } from "../idioma";
import type { CeldasGeoJSON, PoligonoGeoJSON } from "./MapaAreas";

export type EstadoHumedad = "seco" | "bajo" | "optimo" | "humedo" | "saturado" | "sin_datos";

export interface Alerta {
  id: string;
  nivel: "info" | "advertencia" | "critico";
  titulo: string;
  detalle?: string;
  recomendacion?: string;
  fuente_dato?: string;
}

export interface Analisis {
  area_id: string;
  cultivo: string;
  fecha?: string;
  estado: EstadoRecomendacion;
  etiqueta: string;
  motivo: string;
  humedad?: { estado: EstadoHumedad; media_m3m3: number | null; n_observaciones: number; ultima_fecha?: string; tendencia?: string; fuente?: string };
  ventana?: { sembrar_ahora: boolean; dias_espera: number; fecha_estimada?: string; motivo?: string };
  semilla?: { semilla: string; motivo?: string; ciclo_sugerido?: { nombre: string; dias: number } };
  alertas?: Alerta[];
  es_ejemplo: boolean;
  fuentes?: string[];
}

export interface ResultadoLote {
  lote: { hectareas: number; area_referencia?: { id: string; zona: string; dentro: boolean } | null; nota?: string };
  analisis: Analisis;
  sectores?: { humedad_m3m3?: { media: number } };
  celdas?: CeldasGeoJSON | null; // sectores del lote para pintarlos en el mapa
}

/** Convierte la respuesta vieja (contrato v0) en un Analisis mínimo. */
const desdeRecomendacion = (r: Recomendacion): Analisis => ({
  area_id: r.area_id, cultivo: r.cultivo, fecha: r.hasta, estado: r.estado, etiqueta: r.etiqueta, motivo: r.motivo, es_ejemplo: r.es_ejemplo,
  humedad: r.humedad_media_m3m3 == null ? undefined : { estado: "sin_datos", media_m3m3: r.humedad_media_m3m3, n_observaciones: r.n_observaciones ?? 0 },
});

export async function pedirAnalisis(area: string, cultivo: string, lang: Idioma): Promise<Analisis> {
  const q = `area=${encodeURIComponent(area)}&cultivo=${cultivo}&lang=${lang}`;
  const r = await fetch(`/api/analisis?${q}`);
  if (r.ok) return r.json();
  const v0 = await fetch(`/api/recomendacion?${q}`);
  if (!v0.ok) throw new Error(`análisis no disponible (${r.status})`);
  return desdeRecomendacion(await v0.json());
}

/** Estado por área para colorear el mapa. */
export async function pedirEstados(areas: string[], cultivo: string, lang: Idioma): Promise<Record<string, EstadoRecomendacion>> {
  const r = await fetch(`/api/ranking?cultivo=${cultivo}&lang=${lang}`);
  if (r.ok) {
    const d: { areas: { area_id: string; estado: EstadoRecomendacion }[] } = await r.json();
    return Object.fromEntries(d.areas.map((a) => [a.area_id, a.estado]));
  }
  const lista = await Promise.all(areas.map((a) => pedirAnalisis(a, cultivo, lang)));
  return Object.fromEntries(lista.map((a) => [a.area_id, a.estado]));
}

export async function analizarLote(poligono: PoligonoGeoJSON, cultivo: string, lang: Idioma): Promise<ResultadoLote> {
  const r = await fetch(`/api/lote?lang=${lang}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cultivo, poligono }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error ?? `error ${r.status}`);
  return d;
}
