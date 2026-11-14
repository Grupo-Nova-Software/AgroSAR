// Análisis por sectores dentro de un lote: qué parte de tus hectáreas conviene más.
import type { CultivoConfig } from "@/lib/agro/tipos";
import type { Poligono } from "@/lib/agro/lote";
import { type Celda, generarCeldas, RES_BASE_M, construirCelda, indiceDe, type Cobertura } from "./celdas";
import { bboxDePoligonos } from "./geo";
import { distritoDePunto, distritoMasCercano } from "./zonas";
import { centroide } from "@/lib/agro/lote";

export const LOTE_MAX_HA = 10_000;

export function celdasDelLote(polys: Poligono[], hectareas: number, fecha: string, cfg: CultivoConfig) {
  const bbox = bboxDePoligonos(polys);
  const resM = hectareas > 2500 ? RES_BASE_M * 4 : hectareas > 600 ? RES_BASE_M * 2 : RES_BASE_M;
  const r = generarCeldas(bbox, { fecha, cfg, resM, soloDentroDe: polys, maxCeldas: 5000 });
  const res_m = r.res_m;
  let celdas = r.celdas;

  // Lote más chico que una celda: usar la celda que contiene el centroide.
  if (celdas.length === 0) {
    const c = centroide(polys);
    const d = distritoDePunto(c) ?? distritoMasCercano(c).distrito;
    const { i, j } = indiceDe(c, res_m);
    celdas = [construirCelda(i, j, res_m, fecha, cfg, d)];
  }
  return { celdas, res_m, bbox };
}

export function resumirSectores(celdas: Celda[], hectareas: number) {
  const haCelda = hectareas / celdas.length;
  const porCobertura = {} as Record<Cobertura, number>;
  for (const c of celdas) porCobertura[c.cobertura] = (porCobertura[c.cobertura] ?? 0) + 1;

  const aptas = celdas.filter((c) => c.apto);
  const hum = celdas.map((c) => c.humedad_m3m3);
  const ordenadas = [...celdas].sort((a, b) => b.aptitud - a.aptitud);
  const sector = (c: Celda) => ({ id: c.id, centro: c.centro, aptitud: c.aptitud, cobertura: c.cobertura, humedad_m3m3: c.humedad_m3m3, pendiente_pct: c.pendiente_pct, motivos: c.motivos });

  return {
    celdas: celdas.length,
    res_m: celdas[0]?.res_m ?? RES_BASE_M,
    hectareas_aptas: Number((aptas.length * haCelda).toFixed(1)),
    porcentaje_apto: Math.round((aptas.length / celdas.length) * 100),
    cobertura_pct: Object.fromEntries(Object.entries(porCobertura).map(([k, n]) => [k, Math.round((n / celdas.length) * 100)])),
    humedad_m3m3: {
      media: Number((hum.reduce((s, v) => s + v, 0) / hum.length).toFixed(3)),
      min: Math.min(...hum),
      max: Math.max(...hum),
    },
    aptitud_media: Math.round(celdas.reduce((s, c) => s + c.aptitud, 0) / celdas.length),
    mejores: ordenadas.slice(0, 3).map(sector),
    peores: ordenadas.slice(-3).reverse().filter((c) => c.aptitud < 50).map(sector),
  };
}
