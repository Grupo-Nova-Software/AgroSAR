// Carga de las series de humedad NISAR publicadas por el rol Datos (contrato humedad v0).
// Se leen por HTTP desde el mismo origen porque en Vercel public/ se sirve por CDN.
// TODO Backend: si se decide usar Supabase, reemplazar solo este archivo.
import type { IndiceHumedad, SerieHumedad } from "@/types/contratos";

export const ID_AREA = /^[a-z0-9_]+$/;

export async function cargarIndice(origen: string): Promise<IndiceHumedad> {
  const r = await fetch(new URL("/data/humedad/index.json", origen));
  if (!r.ok) throw new Error(`no se pudo leer el índice de áreas (${r.status})`);
  return r.json();
}

export async function cargarSerie(origen: string, area: string): Promise<SerieHumedad | null> {
  if (!ID_AREA.test(area)) return null;
  const r = await fetch(new URL(`/data/humedad/${area}.json`, origen));
  return r.ok ? r.json() : null;
}

export async function cargarTodas(origen: string): Promise<SerieHumedad[]> {
  const indice = await cargarIndice(origen);
  const series = await Promise.all(indice.zonas.map((z) => cargarSerie(origen, z.id)));
  return series.filter((s): s is SerieHumedad => s !== null);
}
