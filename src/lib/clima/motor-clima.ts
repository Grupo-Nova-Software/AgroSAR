// Motor de clima: funciones PURAS (sin red ni Next.js) que convierten los datos de NASA POWER, Open-Meteo y NISAR
// en respuestas para el agricultor: ¿llueve?, ¿cuándo no llueve?, ¿se puede pulverizar?, calor / helada y sequía.
// Todos los umbrales vienen de ./supuestos.ts y son SUPUESTOS del equipo.
import type { SerieHumedad } from "@/types/contratos";
import { buscarCiclo } from "../agro/ciclo";
import { diasEntre, ocurrencias, sumarDias } from "../agro/fechas";
import { clasificarHumedad } from "../agro/humedad";
import type { CultivoConfig } from "../agro/tipos";
import {
  LLUVIA_DIA_SECO_MM, LLUVIA_HORA_MM, LLUVIA_SI_MM, NISAR_CAIDA_M3M3, NISAR_DESACTUALIZADA_DIAS,
  REGLA_PULVERIZACION, SEQUIA, UMBRAL_CALOR_C, UMBRAL_CALOR_DEFECTO_C, UMBRAL_FRIO_C, UMBRAL_HELADA_C,
} from "./supuestos";
import type {
  BalancePeriodo, BloqueHoras, Climatologia, DiaDetalle, DiaHistorico, ExtremosDia, FactorSequia, Helada, HoraDetalle,
  LluviaDia, MesPerspectiva, MotivoNoPulverizar, NisarResumen, NivelSequia, Perspectiva, PowerDatos, PronosticoPunto,
  PulverizacionDia, ReglaPulverizacion, Sequia, VentanaSeca,
} from "./tipos";

const red = (n: number, d = 1) => Number(n.toFixed(d));
const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const horaDe = (t: string) => t.slice(11, 16); // "AAAA-MM-DDTHH:00" → "HH:00"

/** Hora local siguiente a `t` (sin zona horaria: se opera como si fuera UTC para no correr el reloj). */
export function sumarHoras(t: string, horas: number): string {
  return new Date(new Date(`${t}:00Z`).getTime() + horas * 3_600_000).toISOString().slice(0, 16);
}

// ---------- Evapotranspiración de referencia (FAO-56 Penman-Monteith, paso diario) ----------

export interface EntradaEt0 {
  fecha: string;
  lat: number;
  elevacion_m: number;
  tmax_c: number;
  tmin_c: number;
  hr_pct: number; // humedad relativa media
  viento_ms: number; // a 2 m
  rad_mj: number; // radiación solar incidente, MJ/m²/día
}

const e0 = (t: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3)); // presión de vapor de saturación, kPa

/** ET0 en mm/día según FAO-56 (Allen et al., 1998, ec. 6), con G = 0 y presión de vapor real a partir de la HR media. */
export function et0PenmanMonteith(e: EntradaEt0): number {
  const t = (e.tmax_c + e.tmin_c) / 2;
  const presion = 101.3 * ((293 - 0.0065 * e.elevacion_m) / 293) ** 5.26;
  const gamma = 0.000665 * presion;
  const delta = (4098 * e0(t)) / (t + 237.3) ** 2;
  const es = (e0(e.tmax_c) + e0(e.tmin_c)) / 2;
  const ea = (es * Math.min(100, Math.max(0, e.hr_pct))) / 100;

  // Radiación extraterrestre (Ra) para la latitud y el día del año
  const d = new Date(`${e.fecha}T00:00:00Z`);
  const j = Math.round((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000);
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * j) / 365);
  const decl = 0.409 * Math.sin((2 * Math.PI * j) / 365 - 1.39);
  const fi = (e.lat * Math.PI) / 180;
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(fi) * Math.tan(decl))));
  const ra = ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(fi) * Math.sin(decl) + Math.cos(fi) * Math.cos(decl) * Math.sin(ws));

  const rso = (0.75 + 2e-5 * e.elevacion_m) * ra;
  const rns = 0.77 * e.rad_mj; // albedo 0,23
  const nubosidad = 1.35 * Math.min(1, rso > 0 ? e.rad_mj / rso : 1) - 0.35;
  const rnl = 4.903e-9 * (((e.tmax_c + 273.16) ** 4 + (e.tmin_c + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(ea)) * nubosidad;
  const rn = rns - rnl;

  const et0 = (0.408 * delta * rn + ((gamma * 900) / (t + 273)) * e.viento_ms * (es - ea)) / (delta + gamma * (1 + 0.34 * e.viento_ms));
  return Math.max(0, et0);
}

// ---------- Histórico de 30 días: NASA POWER + relleno de los últimos días con el modelo ----------

/**
 * Los `dias` días completos anteriores a `hoy`. POWER publica con 2–3 días de demora: esos días se completan con
 * Open-Meteo y quedan marcados con `fuente: "open_meteo"`.
 */
export function construirHistorico(power: PowerDatos | null, pron: PronosticoPunto | null, hoy: string, lat: number, dias = 30): DiaHistorico[] {
  const porFechaPower = new Map((power?.dias ?? []).map((d) => [d.fecha, d]));
  const idxPron = new Map((pron?.dias.fecha ?? []).map((f, i) => [f, i]));
  const elevacion = power?.elevacion_m ?? pron?.elevacion_m ?? 0;
  const out: DiaHistorico[] = [];

  for (let k = dias; k >= 1; k--) {
    const fecha = sumarDias(hoy, -k);
    const p = porFechaPower.get(fecha);
    const i = idxPron.get(fecha);
    const dia: DiaHistorico = { fecha, mm: null, tmax_c: null, tmin_c: null, et0_mm: null, gwettop: p?.gwettop ?? null, fuente: null, et0_fuente: null };

    if (p && num(p.mm)) {
      dia.mm = red(p.mm, 1);
      dia.tmax_c = num(p.tmax_c) ? red(p.tmax_c) : null;
      dia.tmin_c = num(p.tmin_c) ? red(p.tmin_c) : null;
      dia.fuente = "nasa_power";
    } else if (i !== undefined && pron && num(pron.dias.mm[i])) {
      dia.mm = red(pron.dias.mm[i]!, 1);
      dia.tmax_c = pron.dias.tmax_c[i];
      dia.tmin_c = pron.dias.tmin_c[i];
      dia.fuente = "open_meteo";
    }

    if (p && num(p.tmax_c) && num(p.tmin_c) && num(p.hr_pct) && num(p.viento_ms) && num(p.rad_mj)) {
      dia.et0_mm = red(et0PenmanMonteith({ fecha, lat, elevacion_m: elevacion, tmax_c: p.tmax_c, tmin_c: p.tmin_c, hr_pct: p.hr_pct, viento_ms: p.viento_ms, rad_mj: p.rad_mj }), 2);
      dia.et0_fuente = "fao56_power";
    } else if (i !== undefined && pron && num(pron.dias.et0_mm[i])) {
      dia.et0_mm = red(pron.dias.et0_mm[i]!, 2);
      dia.et0_fuente = "open_meteo";
    }
    out.push(dia);
  }
  return out;
}

/** Balance hídrico simplificado P − ET0 de una lista de días (solo cuentan los días con lluvia y ET0). */
export function balanceDe(dias: { mm: number | null; et0_mm: number | null }[]): BalancePeriodo | null {
  const validos = dias.filter((d) => num(d.mm) && num(d.et0_mm)) as { mm: number; et0_mm: number }[];
  if (!validos.length) return null;
  const lluvia = validos.reduce((s, d) => s + d.mm, 0);
  const et0 = validos.reduce((s, d) => s + d.et0_mm, 0);
  return { dias: dias.length, dias_validos: validos.length, lluvia_mm: red(lluvia), et0_mm: red(et0), balance_mm: red(lluvia - et0) };
}

/** Días seguidos sin lluvia significativa contando hacia atrás desde ayer. Un día sin dato corta la cuenta. */
export function diasSinLluvia(historico: DiaHistorico[]): number {
  let n = 0;
  for (let i = historico.length - 1; i >= 0; i--) {
    const mm = historico[i].mm;
    if (!num(mm) || mm >= LLUVIA_DIA_SECO_MM) break;
    n++;
  }
  return n;
}

// ---------- Pronóstico: lluvia, ventanas secas, pulverización, calor y frío ----------

function indicesDelDia(p: PronosticoPunto, fecha: string, desdeHora?: string): number[] {
  const out: number[] = [];
  p.horas.t.forEach((t, i) => {
    if (t.startsWith(fecha) && (!desdeHora || t >= desdeHora)) out.push(i);
  });
  return out;
}

/**
 * ¿Llueve ese día? Total, probabilidad máxima y el bloque de horas seguidas con más agua.
 * Con `desdeHora` (para "hoy") solo cuenta lo que falta del día.
 */
export function lluviaDelDia(p: PronosticoPunto, fecha: string, desdeHora?: string): LluviaDia {
  const idx = indicesDelDia(p, fecha, desdeHora);
  const mm = idx.reduce((s, i) => s + (p.horas.mm[i] ?? 0), 0);
  const probs = idx.map((i) => p.horas.prob_pct[i]).filter(num);

  // Bloques de horas seguidas con lluvia; queda el que junta más agua
  type Bloque = { desde: number; hasta: number; mm: number };
  const bloques: Bloque[] = [];
  let abierto = false;
  for (const i of idx) {
    const v = p.horas.mm[i] ?? 0;
    if (v >= LLUVIA_HORA_MM) {
      if (abierto) {
        const b = bloques[bloques.length - 1];
        b.hasta = i;
        b.mm += v;
      } else bloques.push({ desde: i, hasta: i, mm: v });
      abierto = true;
    } else abierto = false;
  }
  const mejor = bloques.reduce<Bloque | null>((a, b) => (!a || b.mm > a.mm ? b : a), null);

  return {
    fecha,
    mm: red(mm),
    prob_max_pct: probs.length ? Math.max(...probs) : null,
    llueve: mm >= LLUVIA_SI_MM,
    pico: mejor && mm >= LLUVIA_SI_MM
      ? { desde: horaDe(p.horas.t[mejor.desde]), hasta: horaDe(sumarHoras(p.horas.t[mejor.hasta], 1)), mm: red(mejor.mm) }
      : null,
  };
}

/** Bloques de días seguidos con menos de 2 mm (para sembrar, cosechar o pulverizar). */
export function ventanasSecas(dias: { fecha: string; mm: number | null }[], umbral = LLUVIA_DIA_SECO_MM): VentanaSeca[] {
  const out: VentanaSeca[] = [];
  let actual: VentanaSeca | null = null;
  for (const d of dias) {
    if (num(d.mm) && d.mm < umbral) {
      if (actual) {
        actual.hasta = d.fecha;
        actual.dias++;
      } else {
        actual = { desde: d.fecha, hasta: d.fecha, dias: 1 };
        out.push(actual);
      }
    } else actual = null;
  }
  return out;
}

export interface CondicionHora {
  viento_kmh: number | null;
  mm: number | null;
  temp_c: number | null;
  hr_pct: number | null;
}

/** ¿Se puede pulverizar a esa hora? Devuelve los motivos por los que no. */
export function evaluarPulverizacion(h: CondicionHora, regla: ReglaPulverizacion = REGLA_PULVERIZACION): { apta: boolean; motivos: MotivoNoPulverizar[] } {
  if (!num(h.viento_kmh) || !num(h.mm) || !num(h.temp_c) || !num(h.hr_pct)) return { apta: false, motivos: ["sin_dato"] };
  const motivos: MotivoNoPulverizar[] = [];
  if (h.viento_kmh < regla.viento_min_kmh) motivos.push("viento_bajo");
  if (h.viento_kmh > regla.viento_max_kmh) motivos.push("viento_alto");
  if (h.mm >= regla.lluvia_max_mm) motivos.push("lluvia");
  if (h.temp_c >= regla.temp_max_c) motivos.push("calor");
  if (h.hr_pct <= regla.hr_min_pct) motivos.push("aire_seco");
  return { apta: motivos.length === 0, motivos };
}

export function pulverizacionDelDia(horas: HoraDetalle[], fecha: string): PulverizacionDia {
  const bloques: BloqueHoras[] = [];
  let actual: BloqueHoras | null = null;
  for (const h of horas) {
    if (!h.t.startsWith(fecha)) continue;
    if (h.pulverizar) {
      if (actual) {
        actual.hasta = sumarHoras(h.t, 1);
        actual.horas++;
      } else {
        actual = { desde: h.t, hasta: sumarHoras(h.t, 1), horas: 1 };
        bloques.push(actual);
      }
    } else actual = null;
  }
  return { fecha, horas_aptas: bloques.reduce((s, b) => s + b.horas, 0), bloques };
}

/** Hora del pico de calor y de la mínima del día. */
export function extremosDelDia(p: PronosticoPunto, fecha: string, umbralCalor: number): ExtremosDia {
  let max: ExtremosDia["max"] = null;
  let min: ExtremosDia["min"] = null;
  for (const i of indicesDelDia(p, fecha)) {
    const c = p.horas.temp_c[i];
    if (!num(c)) continue;
    if (!max || c > max.c) max = { c, hora: horaDe(p.horas.t[i]) };
    if (!min || c < min.c) min = { c, hora: horaDe(p.horas.t[i]), rocio_c: p.horas.rocio_c[i] };
  }
  return { fecha, max, min, estres_calor: !!max && max.c >= umbralCalor };
}

export const umbralCalorDe = (cultivo: string) => UMBRAL_CALOR_C[cultivo] ?? UMBRAL_CALOR_DEFECTO_C;

/** Helada con dato real: mínimas pronosticadas (14 días) + mínimas registradas por NASA POWER + calendario del cultivo. */
export function evaluarHelada(diario: DiaDetalle[], power: PowerDatos | null, cfg: CultivoConfig, hoy: string): Helada {
  const conMin = diario.filter((d) => num(d.tmin_c)) as (DiaDetalle & { tmin_c: number })[];
  const masFria = conMin.reduce<(DiaDetalle & { tmin_c: number }) | null>((m, d) => (!m || d.tmin_c < m.tmin_c ? d : m), null);
  const enRiesgo = conMin.filter((d) => d.tmin_c <= UMBRAL_HELADA_C).map((d) => ({ fecha: d.fecha, tmin_c: d.tmin_c }));

  const desde = sumarDias(hoy, -30);
  const obs = (power?.dias ?? []).filter((d) => d.fecha >= desde && num(d.tmin_c)) as { fecha: string; tmin_c: number }[];
  const obsMin = obs.reduce<{ fecha: string; tmin_c: number } | null>((m, d) => (!m || d.tmin_c < m.tmin_c ? d : m), null);

  const enPeriodo = ocurrencias(cfg.heladas.inicio, cfg.heladas.fin, hoy).some((o) => o.inicio <= hoy && hoy <= o.fin);
  return {
    riesgo: enRiesgo.length ? "alto" : masFria && masFria.tmin_c <= UMBRAL_FRIO_C ? "bajo" : "ninguno",
    umbral_c: UMBRAL_HELADA_C,
    minima_pronosticada: masFria ? { c: masFria.tmin_c, fecha: masFria.fecha } : null,
    dias_en_riesgo: enRiesgo,
    observado_30d: {
      minima_c: obsMin ? red(obsMin.tmin_c) : null,
      fecha: obsMin?.fecha ?? null,
      dias_bajo_umbral: obs.filter((d) => d.tmin_c <= UMBRAL_HELADA_C).length,
    },
    calendario: { inicio: cfg.heladas.inicio, fin: cfg.heladas.fin, en_periodo: enPeriodo, sensible: cfg.heladas.sensible },
  };
}

// ---------- Sequía ----------

/** Última pasada NISAR con dato, su antigüedad y el cambio respecto de la anterior. */
export function resumirNisar(serie: SerieHumedad | null, cfg: CultivoConfig, hoy: string): NisarResumen | null {
  const obs = (serie?.serie ?? []).filter((p) => num(p.humedad_m3m3) && p.fecha <= hoy) as { fecha: string; humedad_m3m3: number }[];
  const ultima = obs.at(-1);
  if (!serie || !ultima) return null;
  const previa = obs.at(-2);
  const edad = diasEntre(ultima.fecha, hoy);
  return {
    fecha: ultima.fecha,
    humedad_m3m3: ultima.humedad_m3m3,
    estado: clasificarHumedad(ultima.humedad_m3m3, cfg.humedad),
    dias_antiguedad: edad,
    desactualizada: edad > NISAR_DESACTUALIZADA_DIAS,
    cambio_m3m3: previa ? red(ultima.humedad_m3m3 - previa.humedad_m3m3, 3) : null,
    es_ejemplo: serie.es_ejemplo,
    fuente: serie.fuente,
  };
}

/**
 * Nivel de sequía en 4 pasos (clasificación propia, SUPUESTO): suma puntos por déficit de P − ET0, días sin lluvia
 * y humedad NISAR (solo si la pasada es reciente); el pronóstico de lluvia puede restar un punto.
 */
export function clasificarSequia(e: {
  historico: DiaHistorico[];
  diario: DiaDetalle[];
  nisar: NisarResumen | null;
}): Sequia {
  const b30 = balanceDe(e.historico.slice(-30));
  const b15 = balanceDe(e.historico.slice(-15));
  const prox = balanceDe(e.diario);
  const secos = diasSinLluvia(e.historico);
  const factores: FactorSequia[] = [];
  const sumar = (codigo: FactorSequia["codigo"], valor: number | string, puntos: number) => {
    if (puntos !== 0) factores.push({ codigo, valor, puntos });
  };

  if (b30) sumar("balance_30d", b30.balance_mm, b30.balance_mm <= SEQUIA.balance_30d.fuerte ? 2 : b30.balance_mm <= SEQUIA.balance_30d.leve ? 1 : 0);
  if (b15) sumar("balance_15d", b15.balance_mm, b15.balance_mm <= SEQUIA.balance_15d.fuerte ? 2 : b15.balance_mm <= SEQUIA.balance_15d.leve ? 1 : 0);
  sumar("dias_sin_lluvia", secos, secos >= SEQUIA.dias_sin_lluvia.fuerte ? 2 : secos >= SEQUIA.dias_sin_lluvia.leve ? 1 : 0);
  if (e.nisar && !e.nisar.desactualizada) {
    sumar("nisar_estado", e.nisar.estado, e.nisar.estado === "seco" ? 2 : e.nisar.estado === "bajo" ? 1 : 0);
    if (num(e.nisar.cambio_m3m3)) sumar("nisar_baja", e.nisar.cambio_m3m3, e.nisar.cambio_m3m3 <= -NISAR_CAIDA_M3M3 ? 1 : 0);
  }
  const antes = factores.reduce((s, f) => s + f.puntos, 0);
  if (antes > 0 && prox && prox.balance_mm >= 0) sumar("pronostico_alivia", prox.balance_mm, -1);

  const puntaje = Math.max(0, factores.reduce((s, f) => s + f.puntos, 0));
  const n = SEQUIA.niveles;
  const nivel: NivelSequia = puntaje >= n.severa ? "severa" : puntaje >= n.moderada ? "moderada" : puntaje >= n.atencion ? "atencion" : "optimo";
  return { nivel, puntaje, factores, dias_sin_lluvia: secos, balance_15d: b15, balance_30d: b30, balance_prox_14d: prox, nisar: e.nisar };
}

// ---------- Perspectiva de la campaña (normal climatológica, no pronóstico) ----------

const mesDe = (fecha: string) => fecha.slice(0, 7);
const diasDelMes = (anio: number, mes0: number) => new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();

export function perspectivaEstacional(e: {
  clima: Climatologia;
  historico: DiaHistorico[];
  cfg: CultivoConfig;
  hoy: string;
  fechaSiembra?: string | null;
}): Perspectiva {
  const { clima, cfg, hoy } = e;
  const siembra = e.fechaSiembra || hoy;
  const ciclo = buscarCiclo(cfg);
  const etapas = cfg.etapas.map((et) => ({
    id: et.id,
    nombre: et.nombre,
    critica_agua: et.critica_agua,
    desde: sumarDias(siembra, et.desde * ciclo.dias),
    hasta: sumarDias(siembra, et.hasta * ciclo.dias),
  }));

  const anio0 = Number(hoy.slice(0, 4));
  const mes0 = Number(hoy.slice(5, 7)) - 1;
  const meses: MesPerspectiva[] = [];
  for (let k = 0; k < 4; k++) {
    const anio = anio0 + Math.floor((mes0 + k) / 12);
    const m = (mes0 + k) % 12;
    const clave = `${anio}-${String(m + 1).padStart(2, "0")}`;
    const ini = `${clave}-01`;
    const fin = `${clave}-${String(diasDelMes(anio, m)).padStart(2, "0")}`;
    const presentes = etapas.filter((et) => et.desde <= fin && et.hasta >= ini).map(({ id, nombre, critica_agua }) => ({ id, nombre, critica_agua }));
    meses.push({
      mes: clave,
      normal_mm: red(clima.mm_dia[m] * diasDelMes(anio, m), 0),
      normal_t_c: red(clima.t_c[m]),
      etapas: presentes,
      critico: presentes.some((p) => p.critica_agua),
    });
  }

  // Mes actual: lo que llovió hasta ayer contra la normal a la misma altura del mes
  const delMes = e.historico.filter((d) => mesDe(d.fecha) === mesDe(hoy) && num(d.mm)) as (DiaHistorico & { mm: number })[];
  const acumulado = delMes.reduce((s, d) => s + d.mm, 0);
  const normalALaFecha = clima.mm_dia[mes0] * delMes.length;

  const con30 = e.historico.slice(-30).filter((d) => num(d.mm)) as (DiaHistorico & { mm: number })[];
  const lluvia30 = con30.reduce((s, d) => s + d.mm, 0);
  const normal30 = con30.reduce((s, d) => s + clima.mm_dia[Number(d.fecha.slice(5, 7)) - 1], 0);
  const anomalia = (real: number, normal: number) => (normal > 0 ? red(((real - normal) / normal) * 100, 0) : null);

  const criticos = meses.filter((m) => m.critico);
  const ref = cfg.clima_referencia as { precipitacion_mm?: unknown; _precipitacion_nota?: unknown } | null;
  const rango = Array.isArray(ref?.precipitacion_mm) && ref.precipitacion_mm.length === 2 && ref.precipitacion_mm.every(num)
    ? (ref.precipitacion_mm as [number, number])
    : null;

  return {
    es_normal_climatologica: true,
    periodo_normal: clima.periodo,
    meses,
    mes_actual: {
      acumulado_mm: red(acumulado),
      normal_a_la_fecha_mm: red(normalALaFecha),
      anomalia_pct: delMes.length >= 5 ? anomalia(acumulado, normalALaFecha) : null,
      dias_con_dato: delMes.length,
    },
    ultimos_30d: con30.length ? { lluvia_mm: red(lluvia30), normal_mm: red(normal30), anomalia_pct: anomalia(lluvia30, normal30) } : null,
    siembra: { fecha: siembra, supuesta: !e.fechaSiembra, ciclo: ciclo.nombre, dias: ciclo.dias },
    mes_mas_vulnerable: criticos.length ? criticos.reduce((a, b) => (b.normal_mm < a.normal_mm ? b : a)).mes : null,
    requerimiento_mm: rango,
    requerimiento_nota: rango && typeof ref?._precipitacion_nota === "string" ? ref._precipitacion_nota : null,
  };
}

// ---------- Detalle horario y diario para la interfaz ----------

export function detalleHorario(p: PronosticoPunto, desdeHora: string, horas = 48): HoraDetalle[] {
  const inicio = p.horas.t.findIndex((t) => t >= desdeHora);
  if (inicio < 0) return [];
  const out: HoraDetalle[] = [];
  for (let i = inicio; i < Math.min(p.horas.t.length, inicio + horas); i++) {
    const h = p.horas;
    const cond = { viento_kmh: h.viento_kmh[i], mm: h.mm[i], temp_c: h.temp_c[i], hr_pct: h.hr_pct[i] };
    const { apta, motivos } = evaluarPulverizacion(cond);
    out.push({
      t: h.t[i],
      ...cond,
      rocio_c: h.rocio_c[i],
      prob_pct: h.prob_pct[i],
      rafaga_kmh: h.rafaga_kmh[i],
      dir_grados: h.dir_grados[i],
      uv: h.uv[i],
      et0_mm: h.et0_mm[i],
      suelo_modelo_m3m3: h.suelo_modelo_m3m3[i],
      pulverizar: apta,
      motivos,
    });
  }
  return out;
}

export function detalleDiario(p: PronosticoPunto, hoy: string, dias = 14): DiaDetalle[] {
  const out: DiaDetalle[] = [];
  p.dias.fecha.forEach((fecha, i) => {
    if (fecha < hoy || out.length >= dias) return;
    out.push({
      fecha,
      tmax_c: p.dias.tmax_c[i],
      tmin_c: p.dias.tmin_c[i],
      mm: p.dias.mm[i],
      horas_lluvia: p.dias.horas_lluvia[i],
      prob_pct: p.dias.prob_pct[i],
      et0_mm: p.dias.et0_mm[i],
      viento_max_kmh: p.dias.viento_max_kmh[i],
    });
  });
  return out;
}
