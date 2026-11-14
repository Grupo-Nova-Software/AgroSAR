// Lectura de la humedad del suelo NISAR (contrato humedad v0) con los umbrales del cultivo.
// Es el dato satelital central: falta de agua, exceso de agua, agua en etapas críticas.
import type { SerieHumedad } from "@/types/contratos";
import type { EstadoHumedad, ResumenHumedad, UmbralesHumedad } from "./tipos";
import { diasEntre } from "./fechas";

export function clasificarHumedad(valor: number | null, u: UmbralesHumedad): EstadoHumedad {
  if (valor === null) return "sin_datos";
  if (valor < u.seco_max) return "seco";
  if (valor < u.bajo_max) return "bajo";
  if (valor < u.optimo_max) return "optimo";
  if (valor < u.saturado_min) return "humedo";
  return "saturado";
}

function validos(serie: SerieHumedad, desde: string, hasta: string, calidadMinima: string) {
  return serie.serie.filter(
    (p) => p.calidad === calidadMinima && typeof p.humedad_m3m3 === "number" && p.fecha > desde && p.fecha <= hasta,
  ) as { fecha: string; humedad_m3m3: number }[];
}

// Humedad media de las observaciones válidas en los `ventanaDias` previos a `hasta`.
export function resumirHumedad(
  serie: SerieHumedad | null,
  hasta: string,
  u: UmbralesHumedad,
  ventanaDias: number,
  calidadMinima = "buena",
): ResumenHumedad {
  const base = { ventana_dias: ventanaDias, fuente: serie?.fuente ?? "sin datos" };
  if (!serie) return { ...base, estado: "sin_datos", media_m3m3: null, n_observaciones: 0, ultima_fecha: null, tendencia: null };

  const desde = new Date(new Date(`${hasta}T00:00:00Z`).getTime() - ventanaDias * 86_400_000).toISOString().slice(0, 10);
  const obs = validos(serie, desde, hasta, calidadMinima);
  if (obs.length === 0) {
    return { ...base, estado: "sin_datos", media_m3m3: null, n_observaciones: 0, ultima_fecha: null, tendencia: null };
  }

  const media = Number((obs.reduce((s, p) => s + p.humedad_m3m3, 0) / obs.length).toFixed(3));
  return {
    ...base,
    estado: clasificarHumedad(media, u),
    media_m3m3: media,
    n_observaciones: obs.length,
    ultima_fecha: obs.at(-1)!.fecha,
    tendencia: tendencia(serie, hasta, calidadMinima),
  };
}

// Compara la última observación válida con la media de las 3 anteriores (umbral ±0,02 m³/m³, SUPUESTO).
export function tendencia(serie: SerieHumedad, hasta: string, calidadMinima = "buena"): ResumenHumedad["tendencia"] {
  const obs = validos(serie, "0000-01-01", hasta, calidadMinima).slice(-4);
  if (obs.length < 2) return null;
  const ultima = obs.at(-1)!.humedad_m3m3;
  const previas = obs.slice(0, -1);
  const media = previas.reduce((s, p) => s + p.humedad_m3m3, 0) / previas.length;
  if (ultima - media > 0.02) return "subiendo";
  if (media - ultima > 0.02) return "bajando";
  return "estable";
}

// Humedad media dentro de un período (para seguir una etapa crítica ya transcurrida).
export function humedadEnPeriodo(
  serie: SerieHumedad | null,
  desde: string,
  hasta: string,
  calidadMinima = "buena",
): { media_m3m3: number | null; n: number } {
  if (!serie) return { media_m3m3: null, n: 0 };
  const obs = validos(serie, desde, hasta, calidadMinima);
  if (obs.length === 0 || diasEntre(desde, hasta) < 0) return { media_m3m3: null, n: 0 };
  return { media_m3m3: Number((obs.reduce((s, p) => s + p.humedad_m3m3, 0) / obs.length).toFixed(3)), n: obs.length };
}
