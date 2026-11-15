// Descarga de las fuentes externas de clima, con caché de Next.js 16 ('use cache' + cacheLife).
// Las coordenadas y las fechas entran como ARGUMENTOS: son la clave de caché (misma zona + mismo día = una sola llamada).
// - NASA POWER: dato NASA, diario, sin login. Publica con 2–3 días de demora (los faltantes llegan como -999).
// - Open-Meteo: modelo meteorológico (NO es dato NASA), sin key. Licencia CC BY 4.0.
import { cacheLife } from "next/cache";
import { GRILLA, BBOX_ITAPUA, NODOS, ZONA_HORARIA } from "./supuestos";
import type { CamposDiarios, CamposHorarios, Climatologia, DiaPower, PowerDatos, PronosticoPunto } from "./tipos";

const POWER_DIARIO = "https://power.larc.nasa.gov/api/temporal/daily/point";
const POWER_CLIMA = "https://power.larc.nasa.gov/api/temporal/climatology/point";
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const ESPERA_MS = 25_000;

const HORARIAS =
  "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,soil_moisture_0_to_1cm,soil_temperature_0cm,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,et0_fao_evapotranspiration,shortwave_radiation";
const DIARIAS =
  "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max";

async function pedirJson(url: URL, fuente: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${fuente} respondió ${res.status}`);
  return res.json();
}

const limpio = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v !== -999 ? v : null);
const lista = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map(limpio) : []);

/** NASA POWER diario para un punto. `desde` y `hasta` en AAAAMMDD. */
export async function descargarPower(lat: number, lon: number, desde: string, hasta: string): Promise<PowerDatos> {
  "use cache";
  cacheLife("hours");

  const url = new URL(POWER_DIARIO);
  url.search = new URLSearchParams({
    parameters: "PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,GWETTOP,ALLSKY_SFC_SW_DWN,RH2M,WS2M",
    community: "AG",
    latitude: String(lat),
    longitude: String(lon),
    start: desde,
    end: hasta,
    format: "JSON",
  }).toString();

  const json = (await pedirJson(url, "NASA POWER")) as {
    geometry?: { coordinates?: number[] };
    properties?: { parameter?: Record<string, Record<string, number>> };
  };
  const p = json.properties?.parameter;
  if (!p?.PRECTOTCORR) throw new Error("NASA POWER devolvió una respuesta sin datos");

  const dias: DiaPower[] = Object.keys(p.PRECTOTCORR)
    .sort()
    .map((k) => ({
      fecha: `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`,
      mm: limpio(p.PRECTOTCORR[k]),
      t_c: limpio(p.T2M?.[k]),
      tmax_c: limpio(p.T2M_MAX?.[k]),
      tmin_c: limpio(p.T2M_MIN?.[k]),
      gwettop: limpio(p.GWETTOP?.[k]),
      rad_mj: limpio(p.ALLSKY_SFC_SW_DWN?.[k]),
      hr_pct: limpio(p.RH2M?.[k]),
      viento_ms: limpio(p.WS2M?.[k]),
    }));
  return { dias, elevacion_m: limpio(json.geometry?.coordinates?.[2]) };
}

const MESES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Normales mensuales de NASA POWER (climatología). Casi no cambian: se guardan por semanas. */
export async function descargarClimatologia(lat: number, lon: number): Promise<Climatologia> {
  "use cache";
  cacheLife("weeks");

  const url = new URL(POWER_CLIMA);
  url.search = new URLSearchParams({
    parameters: "PRECTOTCORR,T2M,T2M_MIN,T2M_MAX",
    community: "AG",
    latitude: String(lat),
    longitude: String(lon),
    format: "JSON",
  }).toString();

  const json = (await pedirJson(url, "NASA POWER (climatología)")) as {
    header?: { range?: string };
    properties?: { parameter?: Record<string, Record<string, number>> };
  };
  const p = json.properties?.parameter;
  const serie = (nombre: string) => MESES.map((m) => limpio(p?.[nombre]?.[m]));
  const mm = serie("PRECTOTCORR");
  const t = serie("T2M");
  if (mm.some((v) => v === null) || t.some((v) => v === null)) throw new Error("NASA POWER devolvió una climatología incompleta");
  const o = (v: (number | null)[]) => v.map((x) => x ?? 0);
  return { mm_dia: o(mm), t_c: o(t), tmin_c: o(serie("T2M_MIN")), tmax_c: o(serie("T2M_MAX")), periodo: json.header?.range ?? "NASA POWER climatology" };
}

interface OpenMeteoPunto {
  latitude: number;
  longitude: number;
  elevation?: number;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
}

/**
 * Pronóstico horario (14 días) y diario de un punto, con 7 días pasados para completar la demora de POWER.
 * `claveHora` (hora local) solo sirve para que la caché se renueve cada hora.
 */
export async function descargarPronostico(lat: number, lon: number, claveHora: string): Promise<PronosticoPunto> {
  "use cache";
  cacheLife("hours");
  void claveHora;

  const url = new URL(OPEN_METEO);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: HORARIAS,
    daily: DIARIAS,
    timezone: ZONA_HORARIA,
    forecast_days: "14",
    past_days: "7",
    wind_speed_unit: "kmh",
  }).toString();

  const j = (await pedirJson(url, "Open-Meteo")) as OpenMeteoPunto;
  const h = j.hourly;
  const d = j.daily;
  if (!h || !d || !Array.isArray(h.time) || !Array.isArray(d.time)) throw new Error("Open-Meteo devolvió una respuesta sin pronóstico");
  return {
    lat: j.latitude,
    lon: j.longitude,
    elevacion_m: limpio(j.elevation),
    horas: {
      t: h.time as string[],
      temp_c: lista(h.temperature_2m),
      hr_pct: lista(h.relative_humidity_2m),
      rocio_c: lista(h.dew_point_2m),
      prob_pct: lista(h.precipitation_probability),
      mm: lista(h.precipitation),
      suelo_modelo_m3m3: lista(h.soil_moisture_0_to_1cm),
      tsuelo_c: lista(h.soil_temperature_0cm),
      viento_kmh: lista(h.wind_speed_10m),
      rafaga_kmh: lista(h.wind_gusts_10m),
      dir_grados: lista(h.wind_direction_10m),
      uv: lista(h.uv_index),
      et0_mm: lista(h.et0_fao_evapotranspiration),
      rad_wm2: lista(h.shortwave_radiation),
    },
    dias: {
      fecha: d.time as string[],
      tmax_c: lista(d.temperature_2m_max),
      tmin_c: lista(d.temperature_2m_min),
      mm: lista(d.precipitation_sum),
      horas_lluvia: lista(d.precipitation_hours),
      prob_pct: lista(d.precipitation_probability_max),
      et0_mm: lista(d.et0_fao_evapotranspiration),
      viento_max_kmh: lista(d.wind_speed_10m_max),
    },
  };
}

export interface GrillaCruda {
  lats: number[];
  lons: number[];
  horas: string[];
  dias: string[];
  h: CamposHorarios;
  d: CamposDiarios;
}

const PASO_H = 3;
const PASOS = 17; // 0 h … 48 h

/** Puntos de la grilla (fila por fila, de norte a sur) seguidos de los nodos de referencia. */
export function puntosDeLaGrilla(): { lats: number[]; lons: number[] } {
  const [lo1, la1, lo2, la2] = BBOX_ITAPUA;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let f = 0; f < GRILLA.ny; f++) {
    for (let c = 0; c < GRILLA.nx; c++) {
      lats.push(Number((la2 - (f * (la2 - la1)) / (GRILLA.ny - 1)).toFixed(3)));
      lons.push(Number((lo1 + (c * (lo2 - lo1)) / (GRILLA.nx - 1)).toFixed(3)));
    }
  }
  for (const n of NODOS) {
    lats.push(n.lat);
    lons.push(n.lon);
  }
  return { lats, lons };
}

/**
 * Pronóstico de todos los puntos de la grilla y de los nodos en UNA llamada a Open-Meteo.
 * Devuelve 48 h en pasos de 3 h y 14 días, ya resumido (la respuesta cruda pesa ~1 MB).
 */
export async function descargarGrilla(claveHora: string): Promise<GrillaCruda> {
  "use cache";
  cacheLife("hours");
  void claveHora;

  const { lats, lons } = puntosDeLaGrilla();
  const url = new URL(OPEN_METEO);
  url.search = new URLSearchParams({
    latitude: lats.join(","),
    longitude: lons.join(","),
    hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,et0_fao_evapotranspiration,shortwave_radiation",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max",
    timezone: ZONA_HORARIA,
    forecast_days: "14",
    forecast_hours: String((PASOS - 1) * PASO_H + PASO_H),
    past_hours: "0",
    wind_speed_unit: "kmh",
  }).toString();

  const json = (await pedirJson(url, "Open-Meteo (grilla)")) as OpenMeteoPunto[] | OpenMeteoPunto;
  const puntos = Array.isArray(json) ? json : [json];
  if (puntos.length !== lats.length || !puntos[0]?.hourly || !puntos[0]?.daily) throw new Error("Open-Meteo devolvió una grilla incompleta");

  const horasTodas = puntos[0].hourly.time as string[];
  const dias = puntos[0].daily.time as string[];
  const horas = Array.from({ length: PASOS }, (_, s) => horasTodas[s * PASO_H]).filter(Boolean);

  const r1 = (v: number) => Number(v.toFixed(1));
  // [paso][punto]: valor de la hora del paso, o suma de las 3 h que empiezan en el paso
  const campoH = (nombre: string, modo: "instante" | "suma") =>
    horas.map((_, s) =>
      puntos.map((p) => {
        const v = lista(p.hourly?.[nombre]);
        if (modo === "instante") return r1(v[s * PASO_H] ?? 0);
        let suma = 0;
        for (let k = 0; k < PASO_H; k++) suma += v[s * PASO_H + k] ?? 0;
        return Number(suma.toFixed(2));
      }),
    );
  const campoD = (nombre: string) => dias.map((_, i) => puntos.map((p) => r1(lista(p.daily?.[nombre])[i] ?? 0)));

  return {
    lats,
    lons,
    horas,
    dias,
    h: {
      mm: campoH("precipitation", "suma"),
      temp_c: campoH("temperature_2m", "instante"),
      rocio_c: campoH("dew_point_2m", "instante"),
      viento_kmh: campoH("wind_speed_10m", "instante"),
      rafaga_kmh: campoH("wind_gusts_10m", "instante"),
      dir_grados: campoH("wind_direction_10m", "instante"),
      hr_pct: campoH("relative_humidity_2m", "instante"),
      rad_wm2: campoH("shortwave_radiation", "instante"),
      et0_mm: campoH("et0_fao_evapotranspiration", "suma"),
    },
    d: {
      mm: campoD("precipitation_sum"),
      tmax_c: campoD("temperature_2m_max"),
      tmin_c: campoD("temperature_2m_min"),
      viento_max_kmh: campoD("wind_speed_10m_max"),
      et0_mm: campoD("et0_fao_evapotranspiration"),
    },
  };
}
