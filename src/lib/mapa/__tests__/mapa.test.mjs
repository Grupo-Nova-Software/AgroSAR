import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { fbm, hash } from "../ruido.ts";
import { puntoEnAnillo, leerBBox } from "../geo.ts";
import { DISTRITOS, distritoDePunto, distritosGeoJSON, BBOX_TRABAJO } from "../zonas.ts";
import { generarCeldas, humedadCelda, aptitudCelda, construirCelda, indiceDe } from "../celdas.ts";
import { serieDeCeldas, fechasObservacion } from "../series.ts";
import { celdasDelLote, resumirSectores } from "../sectores.ts";
import { leerPoligonos, hectareas } from "../../agro/lote.ts";
import { analizar } from "../../agro/motor.ts";

const soja = JSON.parse(readFileSync(new URL("../../../../config/cultivos/soja.json", import.meta.url), "utf8"));

test("ruido: determinista y en 0..1", () => {
  assert.equal(hash(3, 4, 5), hash(3, 4, 5));
  assert.notEqual(hash(3, 4, 5), hash(4, 3, 5));
  for (let i = 0; i < 50; i++) { const v = fbm(i * 0.37, i * 0.11, 9); assert.ok(v >= 0 && v <= 1); }
});

test("geo: punto en anillo y bbox", () => {
  const cuadrado = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  assert.ok(puntoEnAnillo([1, 1], cuadrado));
  assert.ok(!puntoEnAnillo([3, 1], cuadrado));
  assert.deepEqual(leerBBox("-55.1,-26.8,-55,-26.7"), [-55.1, -26.8, -55, -26.7]);
  assert.equal(leerBBox("1,2,3"), null);
  assert.equal(leerBBox("-55,-26.7,-55.1,-26.8"), null);
});

test("zonas: dos distritos, centros dentro de su polígono", () => {
  assert.deepEqual(DISTRITOS.map((d) => d.id).sort(), ["bella_vista", "san_rafael_del_parana"]);
  for (const d of DISTRITOS) assert.equal(distritoDePunto(d.centro)?.id, d.id);
  assert.equal(distritoDePunto([-57, -25]), null);
  const g = distritosGeoJSON();
  assert.equal(g.features.length, 2);
  assert.ok(g.features.every((f) => f.properties.es_aproximado));
});

test("celdas: deterministas, dentro de los distritos y con límite de cantidad", () => {
  const d = DISTRITOS.find((x) => x.id === "bella_vista");
  const { i, j } = indiceDe(d.centro, 200);
  const a = construirCelda(i, j, 200, "2026-09-20", soja, d);
  const b = construirCelda(i, j, 200, "2026-09-20", soja, d);
  assert.deepEqual(a, b);
  assert.equal(a.cobertura, "urbano"); // centro urbano
  assert.equal(a.aptitud, 0);

  const r = generarCeldas(BBOX_TRABAJO, { fecha: "2026-09-20", cfg: soja, maxCeldas: 1500 });
  assert.ok(r.celdas.length > 0 && r.celdas.length <= 1501, String(r.celdas.length));
  assert.ok(r.recortado && r.res_m > 200);
  assert.ok(r.celdas.every((c) => distritoDePunto(c.centro)?.id === c.distrito));
  const cob = new Set(r.celdas.map((c) => c.cobertura));
  assert.ok(cob.has("cultivo") && cob.has("bosque"), [...cob].join(","));
});

test("celdas: humedad en rango y varía con la fecha; aptitud penaliza bosque/agua/pendiente", () => {
  const p = [-54.9, -26.7];
  const h1 = humedadCelda(p, "cultivo", 3, "2026-07-01"), h2 = humedadCelda(p, "cultivo", 3, "2026-09-15");
  assert.ok(h1 >= 0.05 && h1 <= 0.55 && h2 >= 0.05 && h2 <= 0.55);
  assert.equal(aptitudCelda(soja, "bosque", "optimo", 2).aptitud, 0);
  assert.equal(aptitudCelda(soja, "agua", "optimo", 2).aptitud, 0);
  assert.ok(aptitudCelda(soja, "cultivo", "optimo", 2).aptitud > aptitudCelda(soja, "cultivo", "optimo", 20).aptitud);
  assert.ok(aptitudCelda(soja, "cultivo", "optimo", 2).aptitud > aptitudCelda(soja, "cultivo", "seco", 2).aptitud);
});

test("series: serie ficticia válida según el contrato de humedad", () => {
  const fechas = fechasObservacion("2026-09-20");
  assert.equal(fechas[0], "2026-06-18");
  assert.ok(fechas.at(-1) <= "2026-09-20");
  const d = DISTRITOS[0];
  const { celdas } = generarCeldas(d.bbox, { fecha: "2026-09-20", cfg: soja, maxCeldas: 300 });
  const s = serieDeCeldas("x", "X", d.bbox, celdas, "2026-09-20");
  assert.equal(s.es_ejemplo, true);
  assert.match(s.fuente, /FICTICIO/);
  assert.equal(s.serie.length, fechas.length);
  assert.ok(s.serie.every((p) => ["buena", "dudosa", "sin_dato"].includes(p.calidad)));
  const a = analizar(soja, s, { fecha: "2026-09-20" });
  assert.ok(["sembrar", "esperar", "precaucion"].includes(a.estado));
});

test("sectores: lote de ~100 ha en San Rafael → celdas, resumen y mejores sectores", () => {
  const polys = leerPoligonos({ type: "Polygon", coordinates: [[[-54.95, -26.70], [-54.94, -26.70], [-54.94, -26.691], [-54.95, -26.691], [-54.95, -26.70]]] });
  const ha = hectareas(polys);
  const { celdas, res_m } = celdasDelLote(polys, ha, "2026-09-20", soja);
  assert.equal(res_m, 200);
  assert.ok(celdas.length >= 15 && celdas.length <= 35, String(celdas.length));
  const s = resumirSectores(celdas, ha);
  assert.equal(s.mejores.length, 3);
  assert.ok(s.mejores[0].aptitud >= s.mejores[1].aptitud);
  assert.ok(s.porcentaje_apto >= 0 && s.porcentaje_apto <= 100);
});

test("sectores: lote más chico que una celda usa la celda del centroide", () => {
  const polys = leerPoligonos({ type: "Polygon", coordinates: [[[-55.60, -27.05], [-55.5995, -27.05], [-55.5995, -27.0495], [-55.60, -27.0495], [-55.60, -27.05]]] });
  const { celdas } = celdasDelLote(polys, hectareas(polys), "2026-09-20", soja);
  assert.equal(celdas.length, 1);
  assert.equal(celdas[0].distrito, "bella_vista");
});

// ---------- Grilla NISAR real (rol Datos) ----------
import { _registrarGrilla, humedadNisar, FUENTE_NISAR } from "../grilla-nisar.ts";

test("grilla NISAR: las celdas y la serie del lote usan la humedad real y quedan marcadas como reales", () => {
  const d = DISTRITOS[0];
  const [lo1, la1, lo2, la2] = d.bbox;
  // Grilla mínima de 3×3 sobre todo el distrito (lat norte→sur, lon oeste→este), 2 fechas.
  const lat = [la2, (la1 + la2) / 2, la1];
  const lon = [lo1, (lo1 + lo2) / 2, lo2];
  const llena = (v) => [[v, v, v], [v, null, v], [v, v, v]];
  _registrarGrilla({ id: d.id, lat, lon, fechas: ["2026-06-19", "2026-10-17"], humedad: { "2026-06-19": llena(0.3), "2026-10-17": llena(0.2) } });
  try {
    // Celda central sin dato → promedio de vecinas
    assert.equal(humedadNisar([lon[1], lat[1]], "2026-11-01")?.valor, 0.2);
    // Fecha previa a la primera pasada → usa la primera
    assert.equal(humedadNisar([lon[0], lat[0]], "2026-01-01")?.fecha_obs, "2026-06-19");

    const { celdas } = generarCeldas([lo1, la1, lo1 + 0.02, la1 + 0.02], { fecha: "2026-10-20", resM: 200 });
    const utiles = celdas.filter((c) => c.cobertura !== "agua" && c.cobertura !== "urbano");
    assert.ok(utiles.length > 0);
    assert.ok(utiles.every((c) => c.fuente_humedad === "nisar" && c.humedad_m3m3 === 0.2));

    const s = serieDeCeldas("lote", "x", d.bbox, celdas, "2026-10-20");
    assert.equal(s.es_ejemplo, false);
    assert.equal(s.fuente, FUENTE_NISAR);
    assert.deepEqual(s.serie.map((p) => p.fecha), ["2026-06-19", "2026-10-17"]);
  } finally {
    _registrarGrilla(null);
  }
});
