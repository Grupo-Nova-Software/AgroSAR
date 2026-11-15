// Tests del motor de clima (funciones puras, sin red).
//   node --import ./src/lib/agro/__tests__/registro.mjs --test src/lib/clima/__tests__/clima.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  balanceDe, clasificarSequia, construirHistorico, diasSinLluvia, et0PenmanMonteith, evaluarHelada, evaluarPulverizacion,
  extremosDelDia, lluviaDelDia, perspectivaEstacional, resumirNisar, sumarHoras, ventanasSecas,
} from "../motor-clima.ts";
import { CULTIVOS } from "../../agro/cultivos.ts";

const soja = CULTIVOS.soja;
const maiz = CULTIVOS.maiz;

// Pronóstico mínimo: 2 días con las horas que se pasen (el resto en 0 mm, 25 °C, viento 8, HR 60).
function pronostico(horas = {}, dias = {}) {
  const t = [];
  for (const f of ["2026-11-14", "2026-11-15"]) for (let h = 0; h < 24; h++) t.push(`${f}T${String(h).padStart(2, "0")}:00`);
  const campo = (nombre, defecto) => t.map((x) => horas[x]?.[nombre] ?? defecto);
  return {
    lat: -26.76, lon: -55.13, elevacion_m: 250,
    horas: {
      t, temp_c: campo("temp_c", 25), hr_pct: campo("hr_pct", 60), rocio_c: campo("rocio_c", 16), prob_pct: campo("prob_pct", 10),
      mm: campo("mm", 0), suelo_modelo_m3m3: campo("suelo", 0.3), tsuelo_c: campo("tsuelo", 24), viento_kmh: campo("viento_kmh", 8),
      rafaga_kmh: campo("rafaga", 15), dir_grados: campo("dir", 90), uv: campo("uv", 3), et0_mm: campo("et0", 0.2), rad_wm2: campo("rad", 300),
    },
    dias: { fecha: [], tmax_c: [], tmin_c: [], mm: [], horas_lluvia: [], prob_pct: [], et0_mm: [], viento_max_kmh: [], ...dias },
  };
}

test("ET0 FAO-56: ejemplo 18 del manual (Bruselas, 6 de julio) ≈ 3,9 mm/día", () => {
  // El manual usa HR máx/mín; acá se usa la HR media (73,5 %), por eso la tolerancia.
  const et0 = et0PenmanMonteith({ fecha: "2026-07-06", lat: 50.8, elevacion_m: 100, tmax_c: 21.5, tmin_c: 12.3, hr_pct: 73.5, viento_ms: 2.078, rad_mj: 22.07 });
  assert.ok(Math.abs(et0 - 3.9) < 0.3, `ET0 = ${et0}`);
});

test("sumarHoras cruza la medianoche sin correr el reloj", () => {
  assert.equal(sumarHoras("2026-11-14T23:00", 1), "2026-11-15T00:00");
});

test("lluvia: total, probabilidad y bloque de horas con más agua", () => {
  const p = pronostico({
    "2026-11-15T03:00": { mm: 0.4 },
    "2026-11-15T14:00": { mm: 5, prob_pct: 80 },
    "2026-11-15T15:00": { mm: 7 },
    "2026-11-15T16:00": { mm: 4.2 },
  });
  const r = lluviaDelDia(p, "2026-11-15");
  assert.equal(r.mm, 16.6);
  assert.equal(r.llueve, true);
  assert.equal(r.prob_max_pct, 80);
  assert.deepEqual(r.pico, { desde: "14:00", hasta: "17:00", mm: 16.2 });
});

test("lluvia: un día seco no tiene pico; 'hoy' solo cuenta lo que falta del día", () => {
  const p = pronostico({ "2026-11-14T08:00": { mm: 9 } });
  assert.equal(lluviaDelDia(p, "2026-11-14").mm, 9);
  const resto = lluviaDelDia(p, "2026-11-14", "2026-11-14T12:00");
  assert.equal(resto.mm, 0);
  assert.equal(resto.llueve, false);
  assert.equal(resto.pico, null);
});

test("ventanas secas: bloques de días seguidos con menos de 2 mm", () => {
  const dias = [0, 0.5, 12, 1.9, 0, 0, 2, null, 0].map((mm, i) => ({ fecha: `2026-11-${14 + i}`, mm }));
  assert.deepEqual(ventanasSecas(dias), [
    { desde: "2026-11-14", hasta: "2026-11-15", dias: 2 },
    { desde: "2026-11-17", hasta: "2026-11-19", dias: 3 },
    { desde: "2026-11-22", hasta: "2026-11-22", dias: 1 },
  ]);
});

test("pulverización: la regla marca cada motivo por separado", () => {
  const ok = { viento_kmh: 8, mm: 0, temp_c: 24, hr_pct: 60 };
  assert.deepEqual(evaluarPulverizacion(ok), { apta: true, motivos: [] });
  assert.deepEqual(evaluarPulverizacion({ ...ok, viento_kmh: 1 }).motivos, ["viento_bajo"]);
  assert.deepEqual(evaluarPulverizacion({ ...ok, viento_kmh: 22 }).motivos, ["viento_alto"]);
  assert.deepEqual(evaluarPulverizacion({ ...ok, mm: 0.6 }).motivos, ["lluvia"]);
  assert.deepEqual(evaluarPulverizacion({ ...ok, temp_c: 33, hr_pct: 35 }).motivos, ["calor", "aire_seco"]);
  assert.deepEqual(evaluarPulverizacion({ ...ok, viento_kmh: null }), { apta: false, motivos: ["sin_dato"] });
});

test("calor y frío: hora del pico, hora de la mínima y aviso de estrés", () => {
  const p = pronostico({ "2026-11-15T15:00": { temp_c: 36.2 }, "2026-11-15T05:00": { temp_c: 14, rocio_c: 12 } });
  const e = extremosDelDia(p, "2026-11-15", 35);
  assert.deepEqual(e.max, { c: 36.2, hora: "15:00" });
  assert.deepEqual(e.min, { c: 14, hora: "05:00", rocio_c: 12 });
  assert.equal(e.estres_calor, true);
  assert.equal(extremosDelDia(p, "2026-11-14", 35).estres_calor, false);
});

test("helada: usa la mínima pronosticada y el registro de POWER, no solo el calendario", () => {
  const diario = [5, 2.5, 8].map((tmin_c, i) => ({ fecha: `2026-07-0${i + 1}`, tmin_c, tmax_c: 18, mm: 0, horas_lluvia: 0, prob_pct: 0, et0_mm: 2, viento_max_kmh: 9 }));
  const power = { elevacion_m: 250, dias: [{ fecha: "2026-06-20", tmin_c: 1.2 }, { fecha: "2026-06-25", tmin_c: 9 }] };
  const h = evaluarHelada(diario, power, soja, "2026-07-01");
  assert.equal(h.riesgo, "alto");
  assert.deepEqual(h.dias_en_riesgo, [{ fecha: "2026-07-02", tmin_c: 2.5 }]);
  assert.equal(h.observado_30d.minima_c, 1.2);
  assert.equal(h.observado_30d.dias_bajo_umbral, 1);
  assert.equal(h.calendario.en_periodo, true);
  // En noviembre, con mínimas de 18 °C, no hay riesgo aunque el cultivo sea sensible.
  const calido = evaluarHelada(diario.map((d) => ({ ...d, tmin_c: 18 })), null, soja, "2026-11-14");
  assert.equal(calido.riesgo, "ninguno");
  assert.equal(calido.calendario.en_periodo, false);
});

test("histórico: POWER primero; los días con -999 se completan con el modelo y quedan marcados", () => {
  const power = {
    elevacion_m: 250,
    dias: [
      { fecha: "2026-11-12", mm: 4, t_c: 24, tmax_c: 30, tmin_c: 18, gwettop: 0.6, rad_mj: 25, hr_pct: 65, viento_ms: 1.5 },
      { fecha: "2026-11-13", mm: null, t_c: null, tmax_c: null, tmin_c: null, gwettop: null, rad_mj: null, hr_pct: null, viento_ms: null },
    ],
  };
  const pron = pronostico({}, { fecha: ["2026-11-13"], mm: [1.5], tmax_c: [31], tmin_c: [20], et0_mm: [5.1] });
  const h = construirHistorico(power, pron, "2026-11-14", -26.76, 3);
  assert.deepEqual(h.map((d) => d.fuente), [null, "nasa_power", "open_meteo"]);
  assert.equal(h[1].et0_fuente, "fao56_power");
  assert.ok(h[1].et0_mm > 3 && h[1].et0_mm < 7, `ET0 = ${h[1].et0_mm}`);
  assert.equal(h[2].mm, 1.5);
  assert.equal(h[2].et0_mm, 5.1);
  assert.equal(balanceDe(h).dias_validos, 2);
});

const dia = (i, mm, et0_mm) => ({ fecha: `2026-10-${String(i + 1).padStart(2, "0")}`, mm, et0_mm, tmax_c: 30, tmin_c: 18, gwettop: null, fuente: "nasa_power", et0_fuente: "fao56_power" });
const futuro = (mm, et0_mm) => Array.from({ length: 14 }, (_, i) => ({ fecha: `2026-11-${String(i + 1).padStart(2, "0")}`, mm, et0_mm, tmax_c: 30, tmin_c: 18, horas_lluvia: 0, prob_pct: 0, viento_max_kmh: 10 }));

test("sequía: días sin lluvia cuenta hacia atrás y se corta con la primera lluvia", () => {
  const h = [dia(0, 12, 5), dia(1, 0, 5), dia(2, 1.9, 5), dia(3, 0, 5)];
  assert.equal(diasSinLluvia(h), 3);
});

test("sequía: suelo con agua y lluvias normales → óptimo", () => {
  const historico = Array.from({ length: 30 }, (_, i) => dia(i, i % 3 === 0 ? 18 : 0, 4.5));
  const s = clasificarSequia({ historico, diario: futuro(6, 4.5), nisar: null });
  assert.equal(s.nivel, "optimo");
  assert.ok(s.balance_30d.balance_mm > 0);
});

test("sequía: 30 días sin lluvia, NISAR seco y bajando, sin lluvia a la vista → alerta severa", () => {
  const historico = Array.from({ length: 30 }, (_, i) => dia(i, 0, 5));
  const nisar = { fecha: "2026-10-28", humedad_m3m3: 0.11, estado: "seco", dias_antiguedad: 3, desactualizada: false, cambio_m3m3: -0.06, es_ejemplo: false, fuente: "NISAR" };
  const s = clasificarSequia({ historico, diario: futuro(0, 5), nisar });
  assert.equal(s.nivel, "severa");
  assert.equal(s.dias_sin_lluvia, 30);
  assert.deepEqual(s.factores.map((f) => f.codigo), ["balance_30d", "balance_15d", "dias_sin_lluvia", "nisar_estado", "nisar_baja"]);
});

test("sequía: una pasada NISAR vieja no decide el nivel, y la lluvia pronosticada alivia", () => {
  const historico = Array.from({ length: 30 }, (_, i) => dia(i, i < 20 ? 6 : 0, 5));
  const viejo = { fecha: "2026-10-01", humedad_m3m3: 0.1, estado: "seco", dias_antiguedad: 30, desactualizada: true, cambio_m3m3: -0.1, es_ejemplo: false, fuente: "NISAR" };
  const seco = clasificarSequia({ historico, diario: futuro(0, 5), nisar: viejo });
  assert.ok(!seco.factores.some((f) => f.codigo.startsWith("nisar")));
  const conLluvia = clasificarSequia({ historico, diario: futuro(8, 5), nisar: viejo });
  assert.ok(conLluvia.factores.some((f) => f.codigo === "pronostico_alivia"));
  assert.equal(conLluvia.puntaje, seco.puntaje - 1);
});

test("NISAR: antigüedad, estado con los umbrales del cultivo y cambio entre pasadas", () => {
  const serie = { id: "x", zona: "X", bbox: [0, 0, 1, 1], fuente: "NISAR", es_ejemplo: false, serie: [
    { fecha: "2026-06-19", humedad_m3m3: 0.3, calidad: "buena" },
    { fecha: "2026-10-17", humedad_m3m3: 0.217, calidad: "buena" },
  ] };
  const r = resumirNisar(serie, soja, "2026-11-14");
  assert.equal(r.dias_antiguedad, 28);
  assert.equal(r.desactualizada, true);
  assert.equal(r.estado, "optimo");
  assert.equal(r.cambio_m3m3, -0.083);
  assert.equal(resumirNisar(null, soja, "2026-11-14"), null);
});

test("perspectiva: normales por mes, etapas críticas y lluvia de referencia solo si está en la config", () => {
  const clima = { mm_dia: [5, 4.5, 4.4, 6.2, 5, 4, 3.2, 2.7, 3.9, 6.6, 6.2, 5.9], t_c: Array(12).fill(22), tmin_c: Array(12).fill(16), tmax_c: Array(12).fill(28), periodo: "2001–2025" };
  const historico = Array.from({ length: 13 }, (_, i) => ({ ...dia(i, 3, 5), fecha: `2026-11-${String(i + 1).padStart(2, "0")}` }));
  const p = perspectivaEstacional({ clima, historico, cfg: soja, hoy: "2026-11-14" });
  assert.deepEqual(p.meses.map((m) => m.mes), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(p.meses[0].normal_mm, 186); // 6,2 mm/día × 30 días
  assert.equal(p.meses[1].critico, false); // diciembre: solo crecimiento vegetativo
  assert.equal(p.mes_actual.acumulado_mm, 39);
  assert.equal(p.mes_actual.anomalia_pct, -52);
  assert.equal(p.siembra.supuesta, true);
  assert.equal(p.requerimiento_mm, null);
  assert.deepEqual(perspectivaEstacional({ clima, historico, cfg: maiz, hoy: "2026-11-14", fechaSiembra: "2026-09-10" }).requerimiento_mm, [600, 800]);
});
