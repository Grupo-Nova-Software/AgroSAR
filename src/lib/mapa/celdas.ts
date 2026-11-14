// Grilla de celdas tipo NISAR (200 m) sobre los distritos.
// HUMEDAD: real (NISAR SME2) cuando el rol Datos publicó la grilla del distrito (ver grilla-nisar.ts;
// hay que llamar antes a `cargarGrillas`). Si no hay grilla, se usa el generador ficticio y la celda queda
// marcada con fuente_humedad = "ficticia".
// COBERTURA y PENDIENTE: siguen siendo FICTICIAS (ruido reproducible) hasta tener capas reales.
import type { CultivoConfig, EstadoHumedad } from "@/lib/agro/tipos";
import { clasificarHumedad } from "@/lib/agro/humedad";
import { parseISO } from "@/lib/agro/fechas";
import { fbm, hash } from "./ruido";
import { type BBox, puntoEnPoligonos } from "./geo";
import { DISTRITOS, distritoMasCercano, kmACentroUrbano, type Distrito } from "./zonas";
import { humedadNisar } from "./grilla-nisar";
import type { Poligono } from "@/lib/agro/lote";

export const RES_BASE_M = 200; // resolución nominal de NISAR SME2
export const FUENTE_FICTICIA = "EJEMPLO FICTICIO (grilla generada, no es dato NISAR)";
export const FUENTE_REAL_CELDAS =
  "Humedad: NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC, celda de 200 m más cercana. Cobertura y pendiente: FICTICIAS (sin capa real todavía).";

export type Cobertura = "cultivo" | "pastura" | "bosque" | "agua" | "urbano";

export interface Celda {
  id: string;
  i: number;
  j: number;
  res_m: number;
  centro: [number, number];
  bbox: BBox;
  distrito: string;
  cobertura: Cobertura;
  pendiente_pct: number;
  humedad_m3m3: number | null; // null = NISAR pasó pero no hay dato válido en esa celda
  humedad_estado: EstadoHumedad;
  fuente_humedad: "nisar" | "ficticia";
  fecha_obs?: string; // fecha de la pasada NISAR usada (si es real)
  aptitud: number; // 0–100 para el cultivo pedido
  apto: boolean;
  motivos: string[];
}

// Origen fijo de la grilla para que las celdas no cambien con el bbox consultado.
const LON0 = -56.0, LAT0 = -27.5, LAT_REF = -26.8;
const M_POR_GRADO_LAT = 110_570;
const M_POR_GRADO_LON = 111_320 * Math.cos((LAT_REF * Math.PI) / 180);

export function pasoGrados(resM: number): { dLon: number; dLat: number } {
  return { dLon: resM / M_POR_GRADO_LON, dLat: resM / M_POR_GRADO_LAT };
}

export function indiceDe(p: [number, number], resM: number): { i: number; j: number } {
  const { dLon, dLat } = pasoGrados(resM);
  return { i: Math.floor((p[0] - LON0) / dLon), j: Math.floor((p[1] - LAT0) / dLat) };
}

function bboxCelda(i: number, j: number, resM: number): BBox {
  const { dLon, dLat } = pasoGrados(resM);
  return [LON0 + i * dLon, LAT0 + j * dLat, LON0 + (i + 1) * dLon, LAT0 + (j + 1) * dLat];
}

// --- Generadores ficticios -------------------------------------------------------------

// Coordenadas "de ruido": 1 unidad ≈ 1,5 km (parches del tamaño de lotes y bosques reales).
const nx = (lon: number) => ((lon - LON0) * M_POR_GRADO_LON) / 1500;
const ny = (lat: number) => ((lat - LAT0) * M_POR_GRADO_LAT) / 1500;

export function coberturaCelda(centro: [number, number], d: Distrito): Cobertura {
  const u = kmACentroUrbano(centro, d);
  if (u.km < u.radio) return "urbano";
  const agua = fbm(nx(centro[0]) * 2.3, ny(centro[1]) * 2.3, 7);
  if (agua > 0.78) return "agua"; // arroyos y tajamares
  const v = fbm(nx(centro[0]), ny(centro[1]), 11);
  if (v < 0.36) return "bosque";
  if (v < 0.46) return "pastura";
  return "cultivo";
}

export function pendienteCelda(centro: [number, number]): number {
  const v = fbm(nx(centro[0]) * 0.7, ny(centro[1]) * 0.7, 23);
  return Number((1 + 18 * Math.max(0, v - 0.3) * 1.6).toFixed(1));
}

const FECHA_BASE = parseISO("2026-01-01").getTime();
const diaDelAnio = (fecha: string) => Math.round((parseISO(fecha).getTime() - FECHA_BASE) / 86_400_000);

// Lluvia regional ficticia por día (compartida por todas las celdas): pulsos de 0..1.
function lluviaRegional(dia: number): number {
  const lenta = fbm(dia / 9, 0.5, 31, 3); // frentes de ~9 días
  const pulso = Math.max(0, lenta - 0.45) * 2.2;
  return Math.min(1, pulso);
}

export function humedadCelda(centro: [number, number], cobertura: Cobertura, pendiente: number, fecha: string): number {
  const dia = diaDelAnio(fecha);
  const base = 0.19 + 0.12 * fbm(nx(centro[0]) * 1.4, ny(centro[1]) * 1.4, 41); // textura/posición en el relieve
  const estacional = 0.03 * Math.sin(((dia - 20) / 365) * 2 * Math.PI); // más húmedo en verano (SUPUESTO)
  const lluvia = 0.14 * lluviaRegional(dia) * (1 - Math.min(pendiente, 20) / 40); // la pendiente escurre
  const local = 0.03 * (hash(Math.round(centro[0] * 1e4), Math.round(centro[1] * 1e4), dia) - 0.5);
  const porCobertura = cobertura === "bosque" ? 0.03 : cobertura === "agua" ? 0.2 : cobertura === "urbano" ? -0.05 : 0;
  return Number(Math.min(0.55, Math.max(0.05, base + estacional + lluvia + local + porCobertura)).toFixed(3));
}

// Aptitud para plantar (0–100) según cobertura, humedad del día y pendiente. SUPUESTO.
export function aptitudCelda(cfg: CultivoConfig | null, cobertura: Cobertura, estado: EstadoHumedad, pendiente: number) {
  const motivos: string[] = [];
  if (cobertura === "agua" || cobertura === "urbano") return { aptitud: 0, motivos: [cobertura === "agua" ? "Cuerpo de agua" : "Zona urbana"] };
  if (cobertura === "bosque") return { aptitud: 0, motivos: ["Bosque: no se recomienda habilitar (Ley de deforestación cero en la Región Oriental)"] };

  let a = cobertura === "cultivo" ? 85 : 65;
  motivos.push(cobertura === "cultivo" ? "Área ya cultivada" : "Pastura: requiere habilitación");

  const ajuste: Record<EstadoHumedad, number> = { optimo: 10, humedo: 0, bajo: -15, seco: -30, saturado: -30, sin_datos: -5 };
  a += ajuste[estado];
  if (estado === "seco" || estado === "bajo") motivos.push("Humedad del suelo baja (SAR)");
  if (estado === "saturado") motivos.push("Suelo saturado (SAR)");
  if (estado === "optimo") motivos.push("Humedad del suelo en rango óptimo (SAR)");

  const max = cfg?.suelo_requisitos.pendiente_max_pct ?? 8;
  if (pendiente > 15) { a -= 40; motivos.push(`Pendiente fuerte (${pendiente} %)`); }
  else if (pendiente > max) { a -= 20; motivos.push(`Pendiente ${pendiente} % > ${max} % recomendado`); }

  return { aptitud: Math.max(0, Math.min(100, Math.round(a))), motivos };
}

// --- Grilla ---------------------------------------------------------------------------

const UMBRALES_DEFECTO = { seco_max: 0.15, bajo_max: 0.2, optimo_max: 0.35, saturado_min: 0.4 };

export function construirCelda(
  i: number, j: number, resM: number, fecha: string, cfg: CultivoConfig | null, d: Distrito,
  coberturaFija?: Cobertura, // p. ej. "cultivo" para el lote que marcó el agricultor (no hay capa real de cobertura)
): Celda {
  const bbox = bboxCelda(i, j, resM);
  const centro: [number, number] = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  const cobertura = coberturaFija ?? coberturaCelda(centro, d);
  const pendiente = pendienteCelda(centro);
  const real = cobertura === "agua" || cobertura === "urbano" ? null : humedadNisar(centro, fecha);
  // Con grilla real nunca se inventa: si NISAR no tiene dato válido, la celda queda "sin_datos".
  const humedad = real ? real.valor : humedadCelda(centro, cobertura, pendiente, fecha);
  const estado = humedad === null ? "sin_datos" : clasificarHumedad(humedad, cfg?.humedad ?? UMBRALES_DEFECTO);
  const { aptitud, motivos } = aptitudCelda(cfg, cobertura, estado, pendiente);
  return {
    id: `${resM}:${i}:${j}`,
    i, j, res_m: resM,
    centro: [Number(centro[0].toFixed(6)), Number(centro[1].toFixed(6))],
    bbox: bbox.map((v) => Number(v.toFixed(6))) as BBox,
    distrito: d.id,
    cobertura,
    pendiente_pct: pendiente,
    humedad_m3m3: humedad,
    humedad_estado: estado,
    fuente_humedad: real ? "nisar" : "ficticia",
    ...(real ? { fecha_obs: real.fecha_obs } : {}),
    aptitud,
    apto: aptitud >= 50,
    motivos,
  };
}

export interface OpcionesGrilla {
  fecha: string;
  cfg?: CultivoConfig | null;
  resM?: number;
  maxCeldas?: number;
  soloDentroDe?: Poligono[]; // centro de celda dentro del polígono
  libre?: boolean; // no limitar a los distritos de trabajo (lotes dibujados en cualquier parte)
  coberturaFija?: Cobertura;
}

// Celdas dentro de un bbox, solo las que caen en alguno de los distritos.
// Si el bbox pide demasiadas celdas, se duplica la resolución hasta respetar `maxCeldas`.
export function generarCeldas(bbox: BBox, op: OpcionesGrilla): { celdas: Celda[]; res_m: number; recortado: boolean } {
  const max = op.maxCeldas ?? 4000;
  let resM = op.resM ?? RES_BASE_M;
  const distritos = DISTRITOS.filter((d) => d.bbox[0] <= bbox[2] && d.bbox[2] >= bbox[0] && d.bbox[1] <= bbox[3] && d.bbox[3] >= bbox[1]);
  if (distritos.length === 0 && !op.libre) return { celdas: [], res_m: resM, recortado: false };

  // Recortar el bbox a la unión de los distritos para no contar celdas vacías (salvo en modo libre).
  const b: BBox = op.libre ? bbox : [
    Math.max(bbox[0], Math.min(...distritos.map((d) => d.bbox[0]))),
    Math.max(bbox[1], Math.min(...distritos.map((d) => d.bbox[1]))),
    Math.min(bbox[2], Math.max(...distritos.map((d) => d.bbox[2]))),
    Math.min(bbox[3], Math.max(...distritos.map((d) => d.bbox[3]))),
  ];

  let recortado = false;
  for (;;) {
    const a = indiceDe([b[0], b[1]], resM);
    const z = indiceDe([b[2], b[3]], resM);
    const n = (z.i - a.i + 1) * (z.j - a.j + 1);
    if (n <= max || resM >= RES_BASE_M * 16) break;
    resM *= 2;
    recortado = true;
  }

  const a = indiceDe([b[0], b[1]], resM);
  const z = indiceDe([b[2], b[3]], resM);
  const celdas: Celda[] = [];
  for (let i = a.i; i <= z.i; i++) {
    for (let j = a.j; j <= z.j; j++) {
      const cb = bboxCelda(i, j, resM);
      const centro: [number, number] = [(cb[0] + cb[2]) / 2, (cb[1] + cb[3]) / 2];
      const d = distritos.find((x) => puntoEnPoligonos(centro, [x.poligono])) ?? (op.libre ? distritoMasCercano(centro).distrito : undefined);
      if (!d) continue;
      if (op.soloDentroDe && !puntoEnPoligonos(centro, op.soloDentroDe)) continue;
      celdas.push(construirCelda(i, j, resM, op.fecha, op.cfg ?? null, d, op.coberturaFija));
      if (celdas.length > max) return { celdas, res_m: resM, recortado: true };
    }
  }
  return { celdas, res_m: resM, recortado };
}

/** true si alguna celda usa humedad ficticia (para marcar la respuesta como ejemplo). */
export const hayFicticias = (celdas: Celda[]) => {
  const utiles = celdas.filter((c) => c.cobertura !== "agua" && c.cobertura !== "urbano");
  return utiles.length === 0 || utiles.some((c) => c.fuente_humedad === "ficticia");
};

export function celdasGeoJSON(celdas: Celda[]) {
  return {
    type: "FeatureCollection" as const,
    features: celdas.map((c) => ({
      type: "Feature" as const,
      id: c.id,
      geometry: {
        type: "Polygon" as const,
        coordinates: [[[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[1]], [c.bbox[2], c.bbox[3]], [c.bbox[0], c.bbox[3]], [c.bbox[0], c.bbox[1]]]],
      },
      properties: {
        id: c.id,
        distrito: c.distrito,
        cobertura: c.cobertura,
        pendiente_pct: c.pendiente_pct,
        humedad_m3m3: c.humedad_m3m3,
        humedad_estado: c.humedad_estado,
        fuente_humedad: c.fuente_humedad,
        fecha_obs: c.fecha_obs ?? null,
        aptitud: c.aptitud,
        apto: c.apto,
        motivos: c.motivos,
      },
    })),
  };
}

export const COLORES = {
  cobertura: { cultivo: "#d9a441", pastura: "#a9c47f", bosque: "#1f6b3a", agua: "#3b82c4", urbano: "#8a8a8a" } as Record<Cobertura, string>,
  humedad: { seco: "#b45309", bajo: "#f59e0b", optimo: "#22c55e", humedo: "#0ea5e9", saturado: "#1d4ed8", sin_datos: "#9ca3af" } as Record<EstadoHumedad, string>,
};
