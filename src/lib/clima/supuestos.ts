// Umbrales y referencias del módulo de clima.
// TODO SUPUESTO: son valores de partida definidos por el equipo, SIN validar con agrónomos ni con protocolos
// oficiales del MAG o de la SEN. Los cuatro niveles de sequía son una clasificación propia de la app.
import type { NodoReferencia, ReglaPulverizacion } from "./tipos";

export const ZONA_HORARIA = "America/Asuncion";

/** Lluvia diaria por debajo de la cual el día cuenta como "seco" (mm). SUPUESTO. */
export const LLUVIA_DIA_SECO_MM = 2;
/** Lluvia diaria desde la cual decimos "llueve" (mm). SUPUESTO. */
export const LLUVIA_SI_MM = 1;
/** Lluvia horaria mínima para contar la hora como lluviosa (mm). */
export const LLUVIA_HORA_MM = 0.1;

/** Regla de pulverización segura (deriva / evaporación de la gota). SUPUESTO del equipo. */
export const REGLA_PULVERIZACION: ReglaPulverizacion = {
  viento_min_kmh: 3, // con menos viento hay riesgo de inversión térmica
  viento_max_kmh: 15, // con más viento hay deriva
  temp_max_c: 30,
  hr_min_pct: 40,
  lluvia_max_mm: LLUVIA_HORA_MM,
};

/** Temperatura desde la que avisamos estrés por calor (°C), crítico en floración. SUPUESTO, igual para los 3 cultivos. */
export const UMBRAL_CALOR_C: Record<string, number> = { soja: 35, maiz: 35, mandioca: 35 };
export const UMBRAL_CALOR_DEFECTO_C = 35;

/** Helada agronómica: mínima a 2 m ≤ 3 °C (a nivel del suelo puede ser 2–3 °C menos). SUPUESTO. */
export const UMBRAL_HELADA_C = 3;
/** Margen de aviso "riesgo bajo" (°C). SUPUESTO. */
export const UMBRAL_FRIO_C = 5;

/** NISAR: días desde la última pasada a partir de los cuales el dato no decide el nivel de sequía. SUPUESTO (igual al motor). */
export const NISAR_DESACTUALIZADA_DIAS = 24;
/** Caída entre dos pasadas NISAR que suma al nivel de sequía (m³/m³). SUPUESTO. */
export const NISAR_CAIDA_M3M3 = 0.03;

/** Puntos por factor para el nivel de sequía. SUPUESTO. */
export const SEQUIA = {
  balance_30d: { fuerte: -60, leve: -25 }, // mm de P − ET0
  balance_15d: { fuerte: -40, leve: -20 },
  dias_sin_lluvia: { fuerte: 10, leve: 5 },
  /** Puntaje mínimo de cada nivel. */
  niveles: { atencion: 2, moderada: 4, severa: 6 },
};

/**
 * Puntos de referencia en Itapúa. Las coordenadas las pasó el equipo y NO están verificadas contra un registro
 * oficial de estaciones. Los valores que se muestran en cada punto son del MODELO (Open-Meteo), no mediciones:
 * la app todavía no recibe datos de estaciones del Observatorio del Agua (UNI), del MAG ni de la SEN.
 */
export const NODOS: NodoReferencia[] = [
  { id: "encarnacion_uni", nombre: "Encarnación · Campus UNI", lat: -27.309, lon: -55.888 },
  { id: "capitan_miranda", nombre: "Capitán Miranda · IPTA", lat: -27.202, lon: -55.792 },
  { id: "hohenau", nombre: "Hohenau · Colonias Unidas", lat: -27.078, lon: -55.642 },
  { id: "natalio", nombre: "Natalio", lat: -26.758, lon: -55.137 },
  { id: "san_rafael_del_parana", nombre: "San Rafael del Paraná", lat: -26.568, lon: -54.795 },
  { id: "tomas_romero_pereira", nombre: "Tomás Romero Pereira · María Auxiliadora", lat: -26.526, lon: -55.253 },
  { id: "bella_vista", nombre: "Bella Vista", lat: -27.047, lon: -55.551 },
];

export const NODOS_NOTA =
  "Puntos de referencia (coordenadas del equipo, sin verificar). Valores del modelo Open-Meteo, NO mediciones de estaciones.";

/** Itapúa: [lon_min, lat_min, lon_max, lat_max] (igual que el mapa de suelo). */
export const BBOX_ITAPUA: [number, number, number, number] = [-57.05, -27.61, -54.64, -26.09];
/** Coordenadas que acepta la API: Itapúa con un margen. */
export const BBOX_CONSULTA: [number, number, number, number] = [-58, -28.5, -54, -25.5];

/** Grilla del mapa: 9 × 6 puntos (~30 km). El modelo no resuelve parcelas; la grilla se interpola para dibujar. */
export const GRILLA = { nx: 9, ny: 6 };

export const FUENTES = [
  "Historical climate & solar data: NASA POWER Project (NASA LaRC), public domain. Daily point API, community AG.",
  "Soil moisture core: NASA-ISRO NISAR L3 SME2 (provisional, 200 m), ASF DAAC.",
  "Hourly & 14-day numerical weather forecast: Open-Meteo API (CC BY 4.0). Non-NASA meteorological model.",
  "Reference evapotranspiration for past days: FAO-56 Penman-Monteith computed by this app from NASA POWER variables.",
  "Thresholds (spray rule, heat, frost, drought levels) are team assumptions, not official MAG / SEN protocols.",
];

export const AVISO_CLIMA =
  "Clima: histórico NASA POWER (datos con 2–3 días de demora) + pronóstico Open-Meteo (modelo, NO es dato NASA). Umbrales SUPUESTOS del equipo, sin validación agronómica ni oficial (MAG / SEN).";
