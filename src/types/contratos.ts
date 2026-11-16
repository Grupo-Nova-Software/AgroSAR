// Tipos de los contratos de datos (ver contracts/*.schema.json). COMPARTIDO: cambiar solo por PR aprobado por los 3.

export type Calidad = "buena" | "dudosa" | "sin_dato";

export interface PuntoSerie {
  fecha: string; // AAAA-MM-DD
  humedad_m3m3: number | null;
  hv_db?: number | null;
  calidad: Calidad;
  pixeles_validos?: number;
}

export interface SerieHumedad {
  id: string;
  zona: string;
  tipo?: "zona" | "distrito" | "departamento";
  bbox: [number, number, number, number]; // [lon_min, lat_min, lon_max, lat_max]
  fuente: string;
  es_ejemplo: boolean;
  mascara?: string;
  serie: PuntoSerie[];
}

export interface IndiceHumedad {
  zonas: { id: string; zona: string; archivo: string; es_ejemplo: boolean }[];
}

export type EstadoRecomendacion = "sembrar" | "esperar" | "precaucion";

export interface Recomendacion {
  area_id: string;
  cultivo: string;
  hasta: string;
  estado: EstadoRecomendacion;
  etiqueta: string;
  motivo: string;
  humedad_media_m3m3?: number | null;
  n_observaciones?: number;
  umbrales_supuestos?: boolean;
  es_ejemplo: boolean;
}
