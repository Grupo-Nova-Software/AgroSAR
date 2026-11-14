// Motor de reglas (rol Backend). Portado de la web estática inicial.
// Umbrales en config/umbrales.json: SUPUESTOS, sin validación agronómica.
// TODO Backend: reglas por cultivo + calendario agrícola + pronóstico de lluvia.
import umbrales from "../../config/umbrales.json";
import type { Recomendacion, SerieHumedad } from "@/types/contratos";

type Regla = { estado: Recomendacion["estado"]; etiqueta: string; min?: number; max?: number };

export function recomendar(datos: SerieHumedad, cultivo: string, hasta: string): Recomendacion {
  const fin = new Date(hasta);
  const inicio = new Date(fin);
  inicio.setDate(inicio.getDate() - umbrales.ventana_dias);

  const validos = datos.serie.filter(
    (p) =>
      p.calidad === umbrales.calidad_minima &&
      typeof p.humedad_m3m3 === "number" &&
      new Date(p.fecha) > inicio &&
      new Date(p.fecha) <= fin,
  );

  const base = { area_id: datos.id, cultivo, hasta, umbrales_supuestos: true, es_ejemplo: datos.es_ejemplo };

  if (validos.length < umbrales.min_observaciones) {
    return {
      ...base,
      estado: umbrales.sin_datos.estado as Recomendacion["estado"],
      etiqueta: umbrales.sin_datos.etiqueta,
      motivo: `No hay observaciones de calidad "${umbrales.calidad_minima}" en los ${umbrales.ventana_dias} días previos a ${hasta}.`,
      humedad_media_m3m3: null,
      n_observaciones: 0,
    };
  }

  const media = validos.reduce((s, p) => s + (p.humedad_m3m3 as number), 0) / validos.length;
  const regla = (umbrales.reglas as Regla[]).find(
    (r) => (r.min === undefined || media >= r.min) && (r.max === undefined || media < r.max),
  )!;

  return {
    ...base,
    estado: regla.estado,
    etiqueta: regla.etiqueta,
    motivo: `Humedad media ${media.toFixed(3)} m³/m³ con ${validos.length} observación(es) válidas en los ${umbrales.ventana_dias} días previos a ${hasta}.`,
    humedad_media_m3m3: Number(media.toFixed(3)),
    n_observaciones: validos.length,
  };
}
