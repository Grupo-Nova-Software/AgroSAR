// Tipos internos del motor agronómico (rol Backend).
// No son contrato compartido: la forma pública de las respuestas está documentada en src/app/api/README.md.
// Cuando el equipo apruebe, los campos nuevos se suman como OPCIONALES a contracts/recomendacion.schema.json.

export type TipoSuelo = "arcilloso" | "arenoso" | "franco" | "humedo" | "degradado";
export const TIPOS_SUELO: TipoSuelo[] = ["arcilloso", "arenoso", "franco", "humedo", "degradado"];

export interface Temporada {
  id: string;
  nombre: string;
  inicio: string; // MM-DD
  fin: string; // MM-DD
  ideal: boolean;
  nota?: string;
}

export interface Ciclo {
  id: string;
  nombre: string;
  rango: string;
  dias: number;
}

export interface Etapa {
  id: string;
  nombre: string;
  desde: number; // fracción del ciclo (0–1)
  hasta: number;
  critica_agua: boolean;
  malezas?: boolean;
}

export interface UmbralesHumedad {
  seco_max: number;
  bajo_max: number;
  optimo_max: number;
  saturado_min: number;
}

export interface ReglaSemilla {
  suelos?: TipoSuelo[];
  condicion?: "siembra_tardia" | "estres_hidrico" | "baja_fertilidad";
  semilla: string;
  motivo: string;
}

export interface Problema {
  id: string;
  nombre: string;
  categoria: "suelo" | "agua" | "clima" | "temporada" | "manejo";
  dato: "nisar" | "usuario" | "calendario" | "clima_pendiente";
  detalle: string;
}

export interface CultivoConfig {
  id: string;
  nombre: string;
  nombre_en: string;
  fuente: string;
  supuesto: boolean;
  incompleto?: boolean;
  temporadas: Temporada[];
  tolerancia_temprana_dias: number;
  tramo_tardio_dias: number;
  tardia_max_dias: number;
  ciclos: Ciclo[];
  ciclo_por_defecto: string;
  emergencia_dias: number;
  etapas: Etapa[];
  cosecha_dias_despues_madurez: number;
  ventana_cosecha_dias: number;
  humedad: UmbralesHumedad;
  heladas: { inicio: string; fin: string; sensible: boolean; ciclo_largo?: boolean; nota?: string };
  suelo_requisitos: {
    ph_min?: number;
    ph_max?: number;
    materia_organica_min_pct?: number;
    pendiente_max_pct?: number;
    profundidad?: "profundo";
    drenaje?: "bueno";
  };
  semillas: ReglaSemilla[];
  semilla_por_defecto: { semilla: string; motivo: string };
  seleccion_semilla?: string[];
  oreo_dias: Record<string, number>;
  clima_referencia: Record<string, unknown> | null;
  registro_lote?: string[];
  escenarios: Record<string, string>;
  problemas: Problema[];
}

// Lo que el agricultor carga sobre su lote (todo opcional).
export interface SueloInput {
  tipo?: TipoSuelo;
  ph?: number;
  fertilidad?: "baja" | "media" | "alta";
  drenaje?: "bueno" | "malo";
  compactado?: boolean;
  pendiente_pct?: number;
  materia_organica_pct?: number;
  profundidad?: "profundo" | "superficial";
  preparado?: boolean;
}

export type Nivel = "info" | "advertencia" | "critico";

export interface Alerta {
  id: string;
  problema_id: string;
  nivel: Nivel;
  categoria: Problema["categoria"];
  titulo: string;
  detalle: string;
  recomendacion: string;
  fuente_dato: Problema["dato"];
}

export type EstadoHumedad = "seco" | "bajo" | "optimo" | "humedo" | "saturado" | "sin_datos";

export interface ResumenHumedad {
  estado: EstadoHumedad;
  media_m3m3: number | null;
  n_observaciones: number;
  ultima_fecha: string | null;
  tendencia: "subiendo" | "bajando" | "estable" | null;
  ventana_dias: number;
  fuente: string;
  dias_desde_observacion: number | null; // antigüedad de la última pasada usada, respecto de la fecha del análisis
  desactualizada: boolean; // true si esa pasada tiene más de DIAS_DATO_VIEJO días
}

export interface ClasifTemporada {
  fecha: string;
  estado: "en_ventana" | "tramo_tardio" | "temprana" | "tardia" | "fuera";
  temporada: { id: string; nombre: string; ideal: boolean; inicio: string; fin: string } | null;
  dias_restantes: number | null; // dentro de la ventana
  dias_fuera: number | null; // antes del inicio o después del fin
  proxima: { id: string; nombre: string; inicio: string; dias_hasta: number } | null;
}

export interface FechasCultivo {
  siembra: string;
  ciclo: { id: string; nombre: string; dias: number };
  emergencia: string;
  etapas: { id: string; nombre: string; desde: string; hasta: string; critica_agua: boolean }[];
  madurez: string;
  cosecha: string;
  cosecha_limite: string;
}

export interface RecomSemilla {
  semilla: string;
  motivo: string;
  ciclo_sugerido: { id: string; nombre: string; dias: number } | null;
  alternativas: { semilla: string; motivo: string }[];
  seleccion?: string[];
}

export interface CuandoSembrar {
  sembrar_ahora: boolean;
  dias_espera: number | null;
  fecha_estimada: string | null;
  motivo: string;
  revisar_en_dias: number;
}

export type EstadoGeneral = "sembrar" | "esperar" | "precaucion";

export interface Analisis {
  area_id: string | null;
  cultivo: string;
  fecha: string;
  modo: "planificar" | "seguimiento";
  estado: EstadoGeneral;
  etiqueta: string;
  motivo: string;
  humedad: ResumenHumedad;
  temporada: ClasifTemporada;
  ventana: CuandoSembrar;
  semilla: RecomSemilla;
  fechas: FechasCultivo;
  alertas: Alerta[];
  pendiente_clima: string[];
  supuesto: true;
  es_ejemplo: boolean;
  fuentes: string[];
}
