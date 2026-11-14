// Serie temporal de humedad (contrato humedad v0) para un conjunto de celdas: la "pasada SAR" sobre
// las hectáreas que marcó el agricultor. FICTICIA: promedia `humedadCelda` por fecha.
import type { SerieHumedad } from "@/types/contratos";
import { sumarDias } from "@/lib/agro/fechas";
import { type Celda, FUENTE_FICTICIA, humedadCelda } from "./celdas";
import type { BBox } from "./geo";
import { hash } from "./ruido";

export const INICIO_NISAR = "2026-06-18"; // primera fecha SME2 disponible sobre Itapúa (docs/decision.md)
export const PASO_DIAS = 6; // SUPUESTO: cadencia aproximada de observaciones

export function fechasObservacion(hasta: string, desde = INICIO_NISAR, paso = PASO_DIAS): string[] {
  const out: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, paso)) out.push(f);
  return out;
}

export function serieDeCeldas(id: string, zona: string, bbox: BBox, celdas: Celda[], hasta: string): SerieHumedad {
  const utiles = celdas.filter((c) => c.cobertura !== "agua" && c.cobertura !== "urbano");
  const base = utiles.length ? utiles : celdas;
  const serie = fechasObservacion(hasta).map((fecha) => {
    const dudosa = hash(fecha.length * 7 + Number(fecha.slice(8)), Number(fecha.slice(5, 7)), 97) < 0.12;
    if (base.length === 0) return { fecha, humedad_m3m3: null, calidad: "sin_dato" as const };
    const media = base.reduce((s, c) => s + humedadCelda(c.centro, c.cobertura, c.pendiente_pct, fecha), 0) / base.length;
    return {
      fecha,
      humedad_m3m3: Number(media.toFixed(3)),
      calidad: dudosa ? ("dudosa" as const) : ("buena" as const),
      pixeles_validos: base.length,
    };
  });
  return { id, zona, tipo: "zona", bbox, fuente: FUENTE_FICTICIA, es_ejemplo: true, serie };
}
