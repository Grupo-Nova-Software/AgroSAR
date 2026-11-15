// Tipos del módulo de clima (rol Backend). No son contrato compartido: la forma pública de las respuestas
// está documentada en src/app/api/README.md. Unidades en el nombre del campo (_mm, _c, _kmh, _m3m3, _pct).
// El backend devuelve CÓDIGOS y números; los textos en inglés / español los arma la interfaz.

// ---------- Datos crudos ya limpios de cada fuente ----------

/** Un día de NASA POWER (los -999 de la fuente llegan como null). */
export interface DiaPower {
  fecha: string; // AAAA-MM-DD
  mm: number | null; // PRECTOTCORR
  t_c: number | null; // T2M
  tmax_c: number | null; // T2M_MAX
  tmin_c: number | null; // T2M_MIN
  gwettop: number | null; // fracción 0–1 (NO es m³/m³)
  rad_mj: number | null; // ALLSKY_SFC_SW_DWN, MJ/m²/día
  hr_pct: number | null; // RH2M
  viento_ms: number | null; // WS2M, m/s a 2 m
}

export interface PowerDatos {
  dias: DiaPower[];
  elevacion_m: number | null;
}

/** Normales mensuales de NASA POWER (climatología MERRA-2). Índice 0 = enero. */
export interface Climatologia {
  mm_dia: number[];
  t_c: number[];
  tmin_c: number[];
  tmax_c: number[];
  periodo: string;
}

export interface HorasPronostico {
  t: string[]; // hora local "AAAA-MM-DDTHH:00"
  temp_c: (number | null)[];
  hr_pct: (number | null)[];
  rocio_c: (number | null)[];
  prob_pct: (number | null)[];
  mm: (number | null)[];
  suelo_modelo_m3m3: (number | null)[];
  tsuelo_c: (number | null)[];
  viento_kmh: (number | null)[];
  rafaga_kmh: (number | null)[];
  dir_grados: (number | null)[];
  uv: (number | null)[];
  et0_mm: (number | null)[];
  rad_wm2: (number | null)[];
}

export interface DiasPronostico {
  fecha: string[];
  tmax_c: (number | null)[];
  tmin_c: (number | null)[];
  mm: (number | null)[];
  horas_lluvia: (number | null)[];
  prob_pct: (number | null)[];
  et0_mm: (number | null)[];
  viento_max_kmh: (number | null)[];
}

export interface PronosticoPunto {
  lat: number;
  lon: number;
  elevacion_m: number | null;
  horas: HorasPronostico;
  dias: DiasPronostico; // incluye días pasados (past_days) y futuros
}

// ---------- Respuesta de GET /api/clima ----------

export interface VentanaHoraria {
  desde: string; // "HH:00"
  hasta: string; // "HH:00" (fin, exclusivo)
  mm: number;
}

export interface LluviaDia {
  fecha: string;
  mm: number;
  prob_max_pct: number | null;
  llueve: boolean;
  /** Bloque de horas seguidas con más agua. null si no llueve. */
  pico: VentanaHoraria | null;
}

export interface VentanaSeca {
  desde: string;
  hasta: string;
  dias: number;
}

export type MotivoNoPulverizar = "viento_bajo" | "viento_alto" | "lluvia" | "calor" | "aire_seco" | "sin_dato";

export interface BloqueHoras {
  desde: string; // hora local ISO
  hasta: string; // fin exclusivo
  horas: number;
}

export interface PulverizacionDia {
  fecha: string;
  horas_aptas: number;
  bloques: BloqueHoras[];
}

export interface ExtremosDia {
  fecha: string;
  max: { c: number; hora: string } | null;
  min: { c: number; hora: string; rocio_c: number | null } | null;
  estres_calor: boolean;
}

export type RiesgoHelada = "ninguno" | "bajo" | "alto";

export interface Helada {
  riesgo: RiesgoHelada;
  umbral_c: number;
  /** Mínima más baja del pronóstico de 14 días. */
  minima_pronosticada: { c: number; fecha: string } | null;
  dias_en_riesgo: { fecha: string; tmin_c: number }[];
  /** Registro real de NASA POWER en los últimos 30 días. */
  observado_30d: { minima_c: number | null; fecha: string | null; dias_bajo_umbral: number };
  /** Período de heladas por calendario del cultivo (config/cultivos, SUPUESTO). */
  calendario: { inicio: string; fin: string; en_periodo: boolean; sensible: boolean };
}

export interface BalancePeriodo {
  dias: number;
  dias_validos: number;
  lluvia_mm: number;
  et0_mm: number;
  balance_mm: number;
}

export type NivelSequia = "optimo" | "atencion" | "moderada" | "severa";

export interface FactorSequia {
  codigo: "balance_30d" | "balance_15d" | "dias_sin_lluvia" | "nisar_estado" | "nisar_baja" | "pronostico_alivia";
  valor: number | string;
  puntos: number;
}

export interface NisarResumen {
  fecha: string;
  humedad_m3m3: number;
  estado: "seco" | "bajo" | "optimo" | "humedo" | "saturado" | "sin_datos";
  dias_antiguedad: number;
  desactualizada: boolean;
  /** Cambio respecto de la pasada anterior (m³/m³). */
  cambio_m3m3: number | null;
  es_ejemplo: boolean;
  fuente: string;
}

export interface Sequia {
  nivel: NivelSequia;
  puntaje: number;
  factores: FactorSequia[];
  dias_sin_lluvia: number;
  balance_15d: BalancePeriodo | null;
  balance_30d: BalancePeriodo | null;
  /** Próximos 14 días según el pronóstico (Open-Meteo). */
  balance_prox_14d: BalancePeriodo | null;
  nisar: NisarResumen | null;
}

export interface MesPerspectiva {
  mes: string; // AAAA-MM
  normal_mm: number;
  normal_t_c: number;
  etapas: { id: string; nombre: string; critica_agua: boolean }[];
  critico: boolean;
}

export interface Perspectiva {
  /** Es la NORMAL climatológica, no un pronóstico estacional. */
  es_normal_climatologica: true;
  periodo_normal: string;
  meses: MesPerspectiva[];
  mes_actual: { acumulado_mm: number; normal_a_la_fecha_mm: number; anomalia_pct: number | null; dias_con_dato: number };
  ultimos_30d: { lluvia_mm: number; normal_mm: number; anomalia_pct: number | null } | null;
  siembra: { fecha: string; supuesta: boolean; ciclo: string; dias: number };
  mes_mas_vulnerable: string | null;
  /** Lluvia de referencia del cultivo si está en config/cultivos (hoy solo maíz). */
  requerimiento_mm: [number, number] | null;
  requerimiento_nota: string | null;
}

export interface HoraDetalle {
  t: string;
  temp_c: number | null;
  hr_pct: number | null;
  rocio_c: number | null;
  prob_pct: number | null;
  mm: number | null;
  viento_kmh: number | null;
  rafaga_kmh: number | null;
  dir_grados: number | null;
  uv: number | null;
  et0_mm: number | null;
  suelo_modelo_m3m3: number | null;
  pulverizar: boolean;
  motivos: MotivoNoPulverizar[];
}

export interface DiaDetalle {
  fecha: string;
  tmax_c: number | null;
  tmin_c: number | null;
  mm: number | null;
  horas_lluvia: number | null;
  prob_pct: number | null;
  et0_mm: number | null;
  viento_max_kmh: number | null;
}

export interface DiaHistorico {
  fecha: string;
  mm: number | null;
  tmax_c: number | null;
  tmin_c: number | null;
  et0_mm: number | null;
  gwettop: number | null;
  /** De dónde sale la lluvia de ese día. */
  fuente: "nasa_power" | "open_meteo" | null;
  /** ET0: calculada con FAO-56 a partir de NASA POWER, o la del modelo Open-Meteo. */
  et0_fuente: "fao56_power" | "open_meteo" | null;
}

export interface EstadoFuente {
  ok: boolean;
  error?: string;
  /** Último día con dato válido (POWER) o última pasada (NISAR). */
  hasta?: string | null;
}

export interface RespuestaClima {
  aviso: string;
  supuesto: true;
  generado: string;
  hoy: string;
  hora_actual: string;
  zona_horaria: string;
  punto: {
    lat: number;
    lon: number;
    origen: "centroide_zona" | "coordenada";
    area_id: string | null;
    zona: string | null;
    dentro_de_area: boolean;
    elevacion_m: number | null;
  };
  cultivo: { id: string; nombre: string; nombre_en: string };
  estado_fuentes: { nasa_power: EstadoFuente; open_meteo: EstadoFuente; climatologia: EstadoFuente; nisar: EstadoFuente };
  lluvia: { hoy: LluviaDia; manana: LluviaDia } | null;
  ventanas_secas: VentanaSeca[] | null;
  pulverizacion: { regla: ReglaPulverizacion; hoy: PulverizacionDia; manana: PulverizacionDia } | null;
  temperatura: { umbral_calor_c: number; hoy: ExtremosDia; manana: ExtremosDia; helada: Helada } | null;
  sequia: Sequia;
  perspectiva: Perspectiva | null;
  horario: HoraDetalle[];
  diario: DiaDetalle[];
  historico: DiaHistorico[];
  nisar_serie: { fecha: string; humedad_m3m3: number | null; calidad: string }[];
  fuentes: string[];
}

export interface ReglaPulverizacion {
  viento_min_kmh: number;
  viento_max_kmh: number;
  temp_max_c: number;
  hr_min_pct: number;
  lluvia_max_mm: number;
}

// ---------- Respuesta de GET /api/clima/mapa ----------

/** Campos por paso horario (cada 3 h) o por día. Cada arreglo: [paso][punto]. */
export interface CamposHorarios {
  mm: number[][]; // suma de las 3 h del paso
  temp_c: number[][];
  rocio_c: number[][];
  viento_kmh: number[][];
  rafaga_kmh: number[][];
  /** De dónde viene el viento, en grados (0 = norte). Opcional: respuestas guardadas viejas no lo traen. */
  dir_grados?: number[][];
  hr_pct: number[][];
  rad_wm2: number[][];
  et0_mm: number[][]; // suma de las 3 h del paso
}

export interface CamposDiarios {
  mm: number[][];
  tmax_c: number[][];
  tmin_c: number[][];
  viento_max_kmh: number[][];
  et0_mm: number[][];
}

export interface NodoReferencia {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
}

export interface GrillaClima {
  aviso: string;
  generado: string;
  zona_horaria: string;
  /** [lon_min, lat_min, lon_max, lat_max] */
  bbox: [number, number, number, number];
  nx: number;
  ny: number;
  /** Puntos de la grilla, fila por fila de NORTE a SUR, de oeste a este. Después van los nodos. */
  lats: number[];
  lons: number[];
  paso_km_aprox: number;
  horas: string[];
  dias: string[];
  h: CamposHorarios;
  d: CamposDiarios;
  /** Los nodos ocupan los índices nx*ny … nx*ny+nodos.length-1 de cada arreglo. */
  nodos: NodoReferencia[];
  nodos_nota: string;
  modelo: string;
  fuentes: string[];
}
