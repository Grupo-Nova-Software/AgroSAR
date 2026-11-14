// Riesgo de heladas por calendario (SUPUESTO). Mañana se reemplaza/complementa con clima real (NASA POWER).
// Problemas que cubre: "el maíz zafriña llega al invierno sin madurar", siembra dentro del período de heladas.
import type { Ciclo, CultivoConfig } from "./tipos";
import { interseccion, ocurrencias, sumarDias } from "./fechas";

// Período de heladas que empieza DESPUÉS de la siembra y alcanza al cultivo antes de madurar.
export function heladaAntesDeMadurez(cfg: CultivoConfig, siembra: string, madurez: string) {
  for (const o of ocurrencias(cfg.heladas.inicio, cfg.heladas.fin, siembra)) {
    if (o.inicio <= siembra) continue;
    const x = interseccion(siembra, madurez, o.inicio, o.fin);
    if (x) return { inicio_heladas: o.inicio, fin_heladas: o.fin, ...x };
  }
  return null;
}

// Siembra dentro del período de heladas (o en los primeros días del cultivo).
export function heladaEnImplantacion(cfg: CultivoConfig, siembra: string, dias = 30) {
  const fin = sumarDias(siembra, dias);
  for (const o of ocurrencias(cfg.heladas.inicio, cfg.heladas.fin, siembra)) {
    if (o.inicio > siembra) continue;
    const x = interseccion(siembra, fin, o.inicio, o.fin);
    if (x) return { inicio_heladas: o.inicio, fin_heladas: o.fin, ...x };
  }
  return null;
}

// Ciclo más largo (más potencial) que madura antes de las heladas, sin pasar de `maxDias`. null si ninguno alcanza.
export function cicloQueEvitaHeladas(cfg: CultivoConfig, siembra: string, maxDias = Infinity): Ciclo | null {
  const ordenados = [...cfg.ciclos].filter((c) => c.dias <= maxDias).sort((a, b) => b.dias - a.dias);
  return ordenados.find((c) => !heladaAntesDeMadurez(cfg, siembra, sumarDias(siembra, c.dias))) ?? null;
}
