// Serie temporal de humedad (contrato humedad v0) para un conjunto de celdas: la "pasada SAR" sobre
// las hectáreas que marcó el agricultor. REAL (NISAR SME2) si hay grilla publicada; si no, FICTICIA.
import type { SerieHumedad } from "@/types/contratos";
import { sumarDias } from "@/lib/agro/fechas";
import { type Celda, FUENTE_FICTICIA, humedadCelda } from "./celdas";
import type { BBox } from "./geo";
import { hash } from "./ruido";
import { FUENTE_NISAR, fechasNisar, humedadNisar } from "./grilla-nisar";

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

  // REAL: si hay grilla NISAR publicada para estas celdas, la serie usa las fechas reales de paso del satélite.
  const fechasReales = base.length ? fechasNisar(base[0].centro).filter((f) => f <= hasta) : [];
  if (fechasReales.length) {
    const serieReal = fechasReales.map((fecha) => {
      const vals = base.map((c) => humedadNisar(c.centro, fecha, true)?.valor).filter((v): v is number => typeof v === "number");
      if (!vals.length) return { fecha, humedad_m3m3: null, calidad: "sin_dato" as const };
      return {
        fecha,
        humedad_m3m3: Number((vals.reduce((s2, v) => s2 + v, 0) / vals.length).toFixed(3)),
        calidad: vals.length >= Math.ceil(base.length / 2) ? ("buena" as const) : ("dudosa" as const),
        pixeles_validos: vals.length,
      };
    });
    return { id, zona, tipo: "zona", bbox, fuente: FUENTE_NISAR, es_ejemplo: false, serie: serieReal };
  }

  // FICTICIA: sin grilla real, se genera de forma determinista.
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
