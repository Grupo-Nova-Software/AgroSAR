import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { clasificarTemporada } from "../temporada.ts";
import { estimarFechas } from "../ciclo.ts";
import { clasificarHumedad, resumirHumedad } from "../humedad.ts";
import { recomendarSemilla } from "../semilla.ts";
import { evaluarSuelo } from "../suelo.ts";
import { cicloQueEvitaHeladas } from "../heladas.ts";
import { cuandoSembrar } from "../ventana.ts";
import { analizar, rankearAreas } from "../motor.ts";
import { hectareas, leerPoligonos, ubicarLote } from "../lote.ts";
import { leerEntrada, ErrorEntrada } from "../entrada.ts";

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const soja = json("../../../../config/cultivos/soja.json");
const maiz = json("../../../../config/cultivos/maiz.json");
const mandioca = json("../../../../config/cultivos/mandioca.json");
const itapua = json("../../../../public/data/humedad/itapua.json");

// Serie ficticia mínima con un valor fijo de humedad.
const serie = (valor, fechas = ["2026-10-01", "2026-10-05"]) => ({
  id: "test",
  zona: "Test",
  bbox: [-55.3, -27, -55, -26.6],
  fuente: "EJEMPLO FICTICIO",
  es_ejemplo: true,
  serie: fechas.map((fecha) => ({ fecha, humedad_m3m3: valor, calidad: "buena" })),
});

// ---------- Temporada ----------
test("temporada: soja en zafra, temprana, tardía y fuera", () => {
  assert.equal(clasificarTemporada(soja, "2026-09-20").estado, "en_ventana");
  assert.equal(clasificarTemporada(soja, "2026-10-25").estado, "tramo_tardio");
  assert.equal(clasificarTemporada(soja, "2026-08-25").estado, "temprana");
  assert.equal(clasificarTemporada(soja, "2026-11-14").estado, "tardia");
  const fuera = clasificarTemporada(soja, "2026-06-15");
  assert.equal(fuera.estado, "fuera");
  assert.equal(fuera.proxima.id, "zafra");
});

test("temporada: zafriña de enero (cruce de año)", () => {
  const t = clasificarTemporada(maiz, "2027-01-10");
  assert.equal(t.temporada.id, "zafrinha");
  assert.equal(t.estado, "en_ventana");
});

// ---------- Ciclo ----------
test("ciclo: fechas estimadas de maíz precoz", () => {
  const f = estimarFechas(maiz, "2026-09-01", "precoz");
  assert.equal(f.madurez, "2027-01-09"); // 130 días
  assert.equal(f.cosecha, "2027-01-24");
  assert.ok(f.etapas.find((e) => e.id === "floracion").critica_agua);
});

test("ciclo: un ciclo inexistente lanza error claro", () => {
  assert.throws(() => estimarFechas(soja, "2026-09-01", "xx"), /ciclo 'xx' no existe/);
});

// ---------- Humedad (NISAR) ----------
test("humedad: clasificación con umbrales de soja", () => {
  assert.equal(clasificarHumedad(0.1, soja.humedad), "seco");
  assert.equal(clasificarHumedad(0.18, soja.humedad), "bajo");
  assert.equal(clasificarHumedad(0.28, soja.humedad), "optimo");
  assert.equal(clasificarHumedad(0.37, soja.humedad), "humedo");
  assert.equal(clasificarHumedad(0.45, soja.humedad), "saturado");
  assert.equal(clasificarHumedad(null, soja.humedad), "sin_datos");
});

test("humedad: sin observaciones en la ventana → usa la última pasada y avisa su antigüedad", () => {
  const r = resumirHumedad(serie(0.3, ["2026-08-01"]), "2026-10-01", soja.humedad, 10);
  assert.equal(r.estado, "optimo");
  assert.equal(r.ultima_fecha, "2026-08-01");
  assert.equal(r.dias_desde_observacion, 61);
  assert.equal(r.desactualizada, true);
});

test("humedad: una pasada reciente no se marca como desactualizada", () => {
  const r = resumirHumedad(serie(0.3, ["2026-09-28"]), "2026-10-01", soja.humedad, 10);
  assert.equal(r.dias_desde_observacion, 3);
  assert.equal(r.desactualizada, false);
});

test("humedad: sin ninguna pasada anterior a la fecha → sin_datos", () => {
  const r = resumirHumedad(serie(0.3, ["2026-08-01"]), "2026-07-01", soja.humedad, 10);
  assert.equal(r.estado, "sin_datos");
  assert.equal(r.dias_desde_observacion, null);
});

test("humedad: ignora observaciones dudosas", () => {
  const s = serie(0.3);
  s.serie[1].calidad = "dudosa";
  const r = resumirHumedad(s, "2026-10-05", soja.humedad, 10);
  assert.equal(r.n_observaciones, 1);
});

// ---------- Semilla ----------
test("semilla soja: suelo → variedad y siembra tardía → R34", () => {
  const ctx = { siembra: "2026-09-20", tardia: false, estres_hidrico: false };
  assert.equal(recomendarSemilla(soja, { tipo: "arenoso" }, ctx).semilla, "R19");
  assert.equal(recomendarSemilla(soja, { tipo: "arcilloso" }, ctx).semilla, "R49");
  assert.equal(recomendarSemilla(soja, { tipo: "arcilloso" }, { ...ctx, tardia: true }).semilla, "R34");
  assert.equal(recomendarSemilla(soja, undefined, { ...ctx, estres_hidrico: true }).semilla, "R24");
});

test("semilla: el ciclo sugerido es coherente con la siembra tardía y las heladas", () => {
  // Soja tardía → ciclo más corto, no el más largo.
  assert.equal(recomendarSemilla(soja, undefined, { siembra: "2026-11-14", tardia: true, estres_hidrico: false }).ciclo_sugerido.id, "super_precoz");
  // Soja en zafra → ciclo por defecto.
  assert.equal(recomendarSemilla(soja, undefined, { siembra: "2026-09-20", tardia: false, estres_hidrico: false }).ciclo_sugerido.id, "semi_precoz");
  // Maíz zafriña 2027-01-20: el precoz (130 d) madura el 30-may (heladas) → baja a súper precoz (120 d, 20-may)… también helada → null.
  assert.equal(recomendarSemilla(maiz, undefined, { siembra: "2027-01-20", tardia: false, estres_hidrico: false }).ciclo_sugerido, null);
  // Maíz zafriña 2027-01-05: precoz madura 15-may (justo heladas) → súper precoz (05-may).
  assert.equal(recomendarSemilla(maiz, undefined, { siembra: "2027-01-05", tardia: false, estres_hidrico: false }).ciclo_sugerido.id, "super_precoz");
});

test("semilla maíz: baja fertilidad y suelo húmedo", () => {
  const ctx = { siembra: "2026-09-01", tardia: false, estres_hidrico: false };
  assert.match(recomendarSemilla(maiz, { fertilidad: "baja" }, ctx).semilla, /menor potencial/);
  assert.match(recomendarSemilla(maiz, { tipo: "humedo" }, ctx).semilla, /drenaje/);
});

test("semilla mandioca: incluye guía de selección de ramas", () => {
  const r = recomendarSemilla(mandioca, undefined, { siembra: "2026-09-01", tardia: false, estres_hidrico: false });
  assert.ok(r.seleccion.length > 0);
});

// ---------- Heladas ----------
test("heladas: maíz zafriña sembrado tarde no madura antes del invierno", () => {
  // Siembra 2027-02-25: incluso el súper precoz (120 d) madura en junio, después del 15-may.
  assert.equal(cicloQueEvitaHeladas(maiz, "2027-02-25"), null);
  // Siembra 2027-01-05: el súper precoz (120 d) madura el 05-may, antes de las heladas.
  assert.equal(cicloQueEvitaHeladas(maiz, "2027-01-05").id, "super_precoz");
});

// ---------- Suelo ----------
test("suelo: detecta acidez, compactación, pendiente y drenaje", () => {
  const ids = evaluarSuelo(maiz, { ph: 4.8, compactado: true, pendiente_pct: 15, drenaje: "malo" })
    .filter(Boolean)
    .map((a) => a.problema_id);
  for (const id of ["acidez", "compactacion", "erosion", "drenaje"]) assert.ok(ids.includes(id), id);
});

test("suelo: soja sin análisis → aviso de análisis de suelo", () => {
  const ids = evaluarSuelo(soja, undefined).filter(Boolean).map((a) => a.problema_id);
  assert.deepEqual(ids, ["analisis_suelo"]);
});

// ---------- Ventana ----------
test("ventana: saturado en arcilloso → esperar 5 días de oreo", () => {
  const t = clasificarTemporada(soja, "2026-09-20");
  const h = resumirHumedad(serie(0.45, ["2026-09-15"]), "2026-09-20", soja.humedad, 10);
  const v = cuandoSembrar(soja, "2026-09-20", t, h, { tipo: "arcilloso" });
  assert.equal(v.sembrar_ahora, false);
  assert.equal(v.dias_espera, 5);
  assert.equal(v.fecha_estimada, "2026-09-25");
});

test("ventana: fuera de temporada → días hasta la próxima", () => {
  const t = clasificarTemporada(soja, "2026-06-15");
  const v = cuandoSembrar(soja, "2026-06-15", t, resumirHumedad(null, "2026-06-15", soja.humedad, 10));
  assert.equal(v.sembrar_ahora, false);
  assert.equal(v.fecha_estimada, "2026-09-01");
});

// ---------- Motor completo (los 3 cultivos) ----------
test("motor: soja óptima en zafra → sembrar", () => {
  const a = analizar(soja, serie(0.28, ["2026-09-18"]), { fecha: "2026-09-20", suelo: { tipo: "franco", ph: 6.2, fertilidad: "media" } });
  assert.equal(a.estado, "sembrar");
  assert.equal(a.ventana.sembrar_ahora, true);
  assert.equal(a.es_ejemplo, true);
});

test("motor: suelo saturado → precaución", () => {
  const a = analizar(maiz, serie(0.45, ["2026-09-18"]), { fecha: "2026-09-20" });
  assert.equal(a.estado, "precaucion");
  assert.ok(a.alertas.some((x) => x.problema_id === "exceso_agua" && x.nivel === "critico"));
});

test("motor: seguimiento de maíz con falta de agua en floración", () => {
  // Siembra 2026-06-20, precoz 130 d → floración ~ 2026-08-17 a 2026-08-27.
  const s = serie(0.12, ["2026-08-18", "2026-08-25", "2026-10-30"]);
  const a = analizar(maiz, s, { fecha: "2026-11-01", fecha_siembra: "2026-06-20", ciclo: "precoz" });
  assert.equal(a.modo, "seguimiento");
  assert.ok(a.alertas.some((x) => x.problema_id === "agua_floracion" && x.nivel === "critico"));
});

test("motor: mandioca pasada de cosecha → cosecha tardía", () => {
  const a = analizar(mandioca, serie(0.25, ["2027-09-01"]), { fecha: "2027-09-05", fecha_siembra: "2026-09-01", ciclo: "precoz" });
  assert.ok(a.alertas.some((x) => x.problema_id === "cosecha_tardia" && x.nivel === "critico"));
});

test("motor: mandioca avisa malezas y heladas de invierno", () => {
  const a = analizar(mandioca, serie(0.25, ["2026-09-01"]), { fecha: "2026-09-05" });
  const ids = a.alertas.map((x) => x.id);
  assert.ok(ids.includes("malezas"));
  assert.ok(ids.includes("helada:invierno"));
});

test("motor: con la serie publicada de Itapúa funciona para los 3 cultivos", () => {
  // La serie puede ser ficticia o NISAR real (rol Datos): el análisis hereda su marca y su fuente.
  for (const cfg of [soja, maiz, mandioca]) {
    const a = analizar(cfg, itapua, {});
    assert.ok(["sembrar", "esperar", "precaucion"].includes(a.estado), cfg.id);
    assert.equal(a.es_ejemplo, itapua.es_ejemplo);
    assert.ok(a.fuentes.includes(itapua.fuente));
  }
});

test("ranking: ordena de mayor a menor puntaje", () => {
  const r = rankearAreas(soja, [{ ...serie(0.45, ["2026-09-18"]), id: "mojada" }, { ...serie(0.28, ["2026-09-18"]), id: "buena" }], { fecha: "2026-09-20" });
  assert.equal(r[0].area_id, "buena");
});

// ---------- Lote ----------
test("lote: un cuadrado de ~1 km² ≈ 100 ha y cae en su área", () => {
  // 0,009° de latitud ≈ 1 km; en lon a -26,7° ≈ 0,01°.
  const poligono = {
    type: "Polygon",
    coordinates: [[[-55.15, -26.75], [-55.14, -26.75], [-55.14, -26.741], [-55.15, -26.741], [-55.15, -26.75]]],
  };
  const polys = leerPoligonos(poligono);
  const ha = hectareas(polys);
  assert.ok(ha > 90 && ha < 110, `ha=${ha}`);
  const ub = ubicarLote(polys, [itapua]);
  assert.equal(ub.serie.id, "itapua");
  assert.equal(ub.dentro, true);
});

test("lote: rechaza geometrías inválidas", () => {
  assert.throws(() => leerPoligonos({ type: "Point", coordinates: [0, 0] }));
  assert.throws(() => leerPoligonos({ type: "Polygon", coordinates: [[[0, 0], [1, 1]]] }));
});

// ---------- Entrada ----------
test("entrada: valida fechas, suelo y números", () => {
  const e = leerEntrada({ fecha: "2026-09-20", suelo: "arcilloso", ph: "5.8", compactado: "true" });
  assert.deepEqual(e.suelo, { tipo: "arcilloso", ph: 5.8, compactado: true });
  assert.throws(() => leerEntrada({ fecha: "20-09-2026" }), ErrorEntrada);
  assert.throws(() => leerEntrada({ suelo: "piedra" }), ErrorEntrada);
  assert.throws(() => leerEntrada({ ph: "20" }), ErrorEntrada);
});
