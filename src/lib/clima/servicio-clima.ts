// Servicio de clima: junta NASA POWER (histórico), Open-Meteo (pronóstico), la normal climatológica y la humedad
// NISAR SME2, y arma la respuesta de GET /api/clima. Si una fuente falla, el resto se devuelve igual
// y `estado_fuentes` dice cuál faltó.
// Vale para cualquier punto DENTRO de Itapúa. NISAR: con coordenada se usa la grilla real en ese punto (bloque de
// 3 × 3 celdas = 600 m); sin coordenada (área "itapua"), el promedio del departamento.
import type { SerieHumedad } from "@/types/contratos";
import { dentroDeItapua, ITAPUA_CENTRO, ITAPUA_ID } from "../itapua";
import { cargarGrillas, fechasNisar, FUENTE_NISAR, humedadNisarBloque } from "../mapa/grilla-nisar";
import { cargarTodas } from "../agro/datos";
import { sumarDias } from "../agro/fechas";
import type { CultivoConfig } from "../agro/tipos";
import { descargarClimatologia, descargarGrilla, descargarPower, descargarPronostico } from "./fuentes";
import {
  clasificarSequia, construirHistorico, detalleDiario, detalleHorario, evaluarHelada, extremosDelDia, lluviaDelDia,
  perspectivaEstacional, pulverizacionDelDia, resumirNisar, umbralCalorDe, ventanasSecas,
} from "./motor-clima";
import { AVISO_CLIMA, BBOX_ITAPUA, FUENTES, GRILLA, NODOS, NODOS_NOTA, REGLA_PULVERIZACION, ZONA_HORARIA } from "./supuestos";
import type { EstadoFuente, GrillaClima, RespuestaClima } from "./tipos";

export class ErrorClima extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

/** Fecha y hora actuales en Paraguay: { fecha: "AAAA-MM-DD", hora: "AAAA-MM-DDTHH:00" }. */
export function ahoraLocal(ahora = new Date()): { fecha: string; hora: string } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value]),
  );
  const fecha = `${partes.year}-${partes.month}-${partes.day}`;
  return { fecha, hora: `${fecha}T${partes.hour}:00` };
}

const dentro = (lon: number, lat: number, [lo1, la1, lo2, la2]: number[]) => lon >= lo1 && lon <= lo2 && lat >= la1 && lat <= la2;

/** Centro de un área: el centroide del departamento para "itapua"; si no, el centro de su bbox. */
function centroDe(area: SerieHumedad): { lat: number; lon: number } {
  if (area.id === ITAPUA_ID) return { lon: ITAPUA_CENTRO[0], lat: ITAPUA_CENTRO[1] };
  const [lo1, la1, lo2, la2] = area.bbox;
  return { lon: (lo1 + lo2) / 2, lat: (la1 + la2) / 2 };
}

/** Área que contiene el punto (la más chica si hay varias) o, si ninguna lo contiene, la del centro más cercano. */
function areaDelPunto(areas: SerieHumedad[], lat: number, lon: number): { area: SerieHumedad | null; dentro: boolean } {
  const tam = (a: SerieHumedad) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
  const contienen = areas.filter((a) => dentro(lon, lat, a.bbox)).sort((a, b) => tam(a) - tam(b));
  if (contienen.length) return { area: contienen[0], dentro: true };
  const dist = (a: SerieHumedad) => {
    const c = centroDe(a);
    return (c.lat - lat) ** 2 + ((c.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
  };
  return { area: [...areas].sort((a, b) => dist(a) - dist(b))[0] ?? null, dentro: false };
}

/**
 * Serie NISAR real en un punto: promedio del bloque de 3 × 3 celdas (600 m) de cada pasada.
 * null si no se pudo leer la tesela (se usa entonces el promedio del departamento y se avisa).
 */
async function serieNisarDelPunto(origen: string, lat: number, lon: number): Promise<SerieHumedad | null> {
  await cargarGrillas(origen, [lon, lat, lon, lat]);
  const fechas = fechasNisar([lon, lat]);
  if (!fechas.length) return null;
  const serie = fechas.map((fecha) => {
    const b = humedadNisarBloque([lon, lat], fecha);
    return {
      fecha,
      humedad_m3m3: b?.valor ?? null,
      calidad: !b || b.celdas === 0 ? ("sin_dato" as const) : b.celdas >= 5 ? ("buena" as const) : ("dudosa" as const),
      pixeles_validos: b?.celdas ?? 0,
    };
  });
  return {
    id: "punto",
    zona: "punto",
    tipo: "zona",
    bbox: [lon, lat, lon, lat],
    fuente: `${FUENTE_NISAR} · promedio de 3 × 3 celdas (600 m) alrededor del punto`,
    es_ejemplo: false,
    serie,
  };
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "error desconocido");
const fuente = <T,>(r: PromiseSettledResult<T>): EstadoFuente => (r.status === "fulfilled" ? { ok: true } : { ok: false, error: mensaje(r.reason) });
const valor = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);

export interface ConsultaClima {
  origen: string; // origen HTTP, para leer public/data/humedad
  area?: string | null;
  lat?: number | null;
  lon?: number | null;
  cfg: CultivoConfig;
  fechaSiembra?: string | null;
}

export async function analizarClima(q: ConsultaClima): Promise<RespuestaClima> {
  const areas = await cargarTodas(q.origen).catch(() => [] as SerieHumedad[]);
  const conCoordenada = typeof q.lat === "number" && typeof q.lon === "number";

  let lat: number;
  let lon: number;
  let area: SerieHumedad | null;
  let dentroDeArea: boolean;
  if (conCoordenada) {
    lat = q.lat!;
    lon = q.lon!;
    if (!dentroDeItapua(lon, lat)) throw new ErrorClima(400, "ese punto está fuera de Itapúa: AgroSAR solo tiene datos del departamento de Itapúa (Paraguay)");
    const pedida = q.area ? areas.find((a) => a.id === q.area) : undefined;
    if (q.area && !pedida) throw new ErrorClima(404, `área '${q.area}' no encontrada`);
    const r = pedida ? { area: pedida, dentro: dentro(lon, lat, pedida.bbox) } : areaDelPunto(areas, lat, lon);
    area = r.area;
    dentroDeArea = r.dentro;
  } else {
    if (!q.area) throw new ErrorClima(400, "falta 'area' o el par 'lat' y 'lon'");
    area = areas.find((a) => a.id === q.area) ?? null;
    if (!area) throw new ErrorClima(404, `área '${q.area}' no encontrada`);
    ({ lat, lon } = centroDe(area));
    dentroDeArea = true;
  }
  // NISAR en el punto exacto (antes de redondear); si no se puede leer, queda el promedio del departamento
  const nisarPunto = conCoordenada ? await serieNisarDelPunto(q.origen, lat, lon).catch(() => null) : null;
  const serieNisar = nisarPunto ?? area;
  // 2 decimales (~1 km): suficiente para modelos de 10–50 km y hace que la caché sirva a chacras vecinas
  lat = Number(lat.toFixed(2));
  lon = Number(lon.toFixed(2));

  const { fecha: hoy, hora } = ahoraLocal();
  const aaaammdd = (f: string) => f.replaceAll("-", "");

  const [rPower, rPron, rClima] = await Promise.allSettled([
    descargarPower(lat, lon, aaaammdd(sumarDias(hoy, -31)), aaaammdd(hoy)),
    descargarPronostico(lat, lon, hora),
    descargarClimatologia(lat, lon),
  ]);
  const power = valor(rPower);
  const pron = valor(rPron);
  const clima = valor(rClima);
  if (!power && !pron) throw new ErrorClima(502, `no se pudo consultar ninguna fuente de clima (NASA POWER: ${mensaje((rPower as PromiseRejectedResult).reason)}; Open-Meteo: ${mensaje((rPron as PromiseRejectedResult).reason)})`);

  const manana = sumarDias(hoy, 1);
  const horario = pron ? detalleHorario(pron, hora, 48) : [];
  const diario = pron ? detalleDiario(pron, hoy, 14) : [];
  const historico = construirHistorico(power, pron, hoy, lat, 30);
  const nisar = resumirNisar(serieNisar, q.cfg, hoy);
  const umbralCalor = umbralCalorDe(q.cfg.id);
  const ultimoPower = power?.dias.filter((d) => d.mm !== null).at(-1)?.fecha ?? null;

  return {
    aviso: AVISO_CLIMA,
    supuesto: true,
    generado: new Date().toISOString(),
    hoy,
    hora_actual: hora,
    zona_horaria: ZONA_HORARIA,
    punto: {
      lat,
      lon,
      origen: conCoordenada ? "coordenada" : "centroide_zona",
      area_id: area?.id ?? null,
      zona: area?.zona ?? null,
      dentro_de_area: dentroDeArea,
      nisar_de: nisarPunto ? "punto" : "area",
      elevacion_m: power?.elevacion_m ?? pron?.elevacion_m ?? null,
    },
    cultivo: { id: q.cfg.id, nombre: q.cfg.nombre, nombre_en: q.cfg.nombre_en },
    estado_fuentes: {
      nasa_power: { ...fuente(rPower), hasta: ultimoPower },
      open_meteo: fuente(rPron),
      climatologia: fuente(rClima),
      nisar: nisar ? { ok: true, hasta: nisar.fecha } : { ok: false, error: "sin pasadas NISAR para el área" },
    },
    lluvia: pron ? { hoy: lluviaDelDia(pron, hoy, hora), manana: lluviaDelDia(pron, manana) } : null,
    ventanas_secas: pron ? ventanasSecas(diario) : null,
    pulverizacion: pron ? { regla: REGLA_PULVERIZACION, hoy: pulverizacionDelDia(horario, hoy), manana: pulverizacionDelDia(horario, manana) } : null,
    temperatura: pron
      ? {
          umbral_calor_c: umbralCalor,
          hoy: extremosDelDia(pron, hoy, umbralCalor),
          manana: extremosDelDia(pron, manana, umbralCalor),
          helada: evaluarHelada(diario, power, q.cfg, hoy),
        }
      : null,
    sequia: clasificarSequia({ historico, diario, nisar }),
    perspectiva: clima ? perspectivaEstacional({ clima, historico, cfg: q.cfg, hoy, fechaSiembra: q.fechaSiembra }) : null,
    horario,
    diario,
    historico,
    nisar_serie: (serieNisar?.serie ?? []).map((p) => ({ fecha: p.fecha, humedad_m3m3: p.humedad_m3m3, calidad: p.calidad })),
    fuentes: FUENTES,
  };
}

/** Grilla de pronóstico sobre Itapúa + nodos de referencia, para las capas del mapa. */
export async function grillaClima(): Promise<GrillaClima> {
  const { hora } = ahoraLocal();
  let cruda;
  try {
    cruda = await descargarGrilla(hora);
  } catch (e) {
    throw new ErrorClima(502, `no se pudo consultar Open-Meteo: ${mensaje(e)}`);
  }
  const [lo1, la1, lo2, la2] = BBOX_ITAPUA;
  const pasoLon = ((lo2 - lo1) / (GRILLA.nx - 1)) * 111 * Math.cos((((la1 + la2) / 2) * Math.PI) / 180);
  const pasoLat = ((la2 - la1) / (GRILLA.ny - 1)) * 111;
  return {
    aviso: AVISO_CLIMA,
    generado: new Date().toISOString(),
    zona_horaria: ZONA_HORARIA,
    bbox: BBOX_ITAPUA,
    nx: GRILLA.nx,
    ny: GRILLA.ny,
    paso_km_aprox: Math.round((pasoLon + pasoLat) / 2),
    ...cruda,
    nodos: NODOS,
    nodos_nota: NODOS_NOTA,
    modelo: "Open-Meteo (best match: combinación de modelos globales). Resolución del modelo ~10–25 km; la grilla se interpola para dibujar.",
    fuentes: FUENTES,
  };
}
