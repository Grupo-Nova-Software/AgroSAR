// Motor agronómico: junta humedad NISAR, temporada, ciclo, semilla, suelo y riesgos en un análisis.
// Funciona igual para soja, maíz y mandioca: cada cultivo se describe en config/cultivos/<id>.json.
// Todos los umbrales son SUPUESTOS hasta que el equipo los valide (ver "_estado" en cada JSON).
import type { SerieHumedad } from "@/types/contratos";
import type { Alerta, Analisis, CultivoConfig, EstadoGeneral, SueloInput } from "./tipos";
import { ordenarAlertas } from "./alertas";
import { estimarFechas } from "./ciclo";
import { resumirHumedad } from "./humedad";
import { evaluarRiesgos } from "./riesgos";
import { recomendarSemilla } from "./semilla";
import { evaluarSuelo } from "./suelo";
import { clasificarTemporada, esSiembraTardia } from "./temporada";
import { cuandoSembrar } from "./ventana";

export interface EntradaAnalisis {
  fecha?: string; // fecha de referencia (por defecto: última observación NISAR)
  fecha_siembra?: string; // si ya se sembró → modo seguimiento
  ciclo?: string;
  suelo?: SueloInput;
  ventana_dias?: number;
}

const ETIQUETAS: Record<Analisis["modo"], Record<EstadoGeneral, string>> = {
  planificar: { sembrar: "Condición favorable para sembrar", esperar: "Esperar", precaucion: "Precaución: no sembrar ahora" },
  seguimiento: { sembrar: "Cultivo sin alertas importantes", esperar: "Atención al cultivo", precaucion: "Riesgo para el cultivo" },
};

function estadoGeneral(alertas: Alerta[], humedadSinDatos: boolean): EstadoGeneral {
  if (alertas.some((a) => a.nivel === "critico")) return "precaucion";
  if (humedadSinDatos) return "esperar";
  if (alertas.some((a) => a.nivel === "advertencia" && ["agua", "temporada", "clima"].includes(a.categoria))) return "esperar";
  return "sembrar";
}

export function fechaReferencia(serie: SerieHumedad | null, fecha?: string): string {
  return fecha ?? serie?.serie.at(-1)?.fecha ?? new Date().toISOString().slice(0, 10);
}

export function analizar(cfg: CultivoConfig, serie: SerieHumedad | null, entrada: EntradaAnalisis = {}): Analisis {
  const fecha = fechaReferencia(serie, entrada.fecha);
  const modo = entrada.fecha_siembra ? "seguimiento" : "planificar";
  const siembra = entrada.fecha_siembra ?? fecha;

  const humedad = resumirHumedad(serie, fecha, cfg.humedad, entrada.ventana_dias ?? 10);
  const temporada = clasificarTemporada(cfg, siembra);
  const estres = humedad.estado === "seco" || humedad.estado === "bajo" || entrada.suelo?.tipo === "arenoso";
  const semilla = recomendarSemilla(cfg, entrada.suelo, { siembra, tardia: esSiembraTardia(temporada), estres_hidrico: estres });
  const fechas = estimarFechas(cfg, siembra, entrada.ciclo ?? semilla.ciclo_sugerido?.id);

  const alertas = ordenarAlertas([
    ...evaluarRiesgos(cfg, { fecha, modo, humedad, temporada, fechas, serie }),
    ...evaluarSuelo(cfg, entrada.suelo),
  ]);

  const estado = estadoGeneral(alertas, humedad.estado === "sin_datos");
  const principales = alertas.filter((a) => a.nivel !== "info").slice(0, 2);
  const motivo = principales.length
    ? principales.map((a) => `${a.titulo}: ${a.detalle}`).join(" ")
    : humedad.media_m3m3 !== null
      ? `Humedad NISAR ${humedad.media_m3m3.toFixed(3)} m³/m³ (${humedad.n_observaciones} obs. en ${humedad.ventana_dias} días) y fecha dentro de la ${temporada.temporada?.nombre ?? "temporada"}.`
      : "Sin observaciones NISAR recientes.";

  return {
    area_id: serie?.id ?? null,
    cultivo: cfg.id,
    fecha,
    modo,
    estado,
    etiqueta: ETIQUETAS[modo][estado],
    motivo,
    humedad,
    temporada,
    ventana: cuandoSembrar(cfg, fecha, temporada, humedad, entrada.suelo),
    semilla,
    fechas,
    alertas,
    pendiente_clima: cfg.problemas.filter((p) => p.dato === "clima_pendiente").map((p) => p.nombre),
    supuesto: true,
    es_ejemplo: serie?.es_ejemplo ?? true,
    fuentes: [serie?.fuente ?? "sin datos de humedad", cfg.fuente],
  };
}

// "¿Dónde conviene más?": ordena las áreas para un cultivo (mejor estado y humedad más cerca del óptimo).
export function rankearAreas(cfg: CultivoConfig, series: SerieHumedad[], entrada: EntradaAnalisis = {}) {
  const puntaje: Record<EstadoGeneral, number> = { sembrar: 2, esperar: 1, precaucion: 0 };
  const centro = (cfg.humedad.bajo_max + cfg.humedad.optimo_max) / 2;
  return series
    .map((s) => {
      const a = analizar(cfg, s, entrada);
      const distancia = a.humedad.media_m3m3 === null ? 1 : Math.abs(a.humedad.media_m3m3 - centro);
      return {
        area_id: s.id,
        zona: s.zona,
        estado: a.estado,
        etiqueta: a.etiqueta,
        humedad_media_m3m3: a.humedad.media_m3m3,
        puntaje: Number((puntaje[a.estado] + (1 - Math.min(distancia, 1))).toFixed(3)),
        alertas_criticas: a.alertas.filter((x) => x.nivel === "critico").map((x) => x.titulo),
        es_ejemplo: a.es_ejemplo,
      };
    })
    .sort((a, b) => b.puntaje - a.puntaje);
}
