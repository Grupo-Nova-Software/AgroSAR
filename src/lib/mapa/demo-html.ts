// HTML de la demo del mapa (se sirve en /api/mapa/demo). Leaflet desde CDN (sin dependencias nuevas); dibujo de lote propio.
// Capas: imagen satelital (Esri), NASA HLS (Landsat/Sentinel-2, 30 m) y NDVI MODIS vía NASA GIBS, grilla SAR ficticia.
export function demoHTML(): string {
  return /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgroSAR — mapa de campo (demo backend)</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>
  :root { --verde:#287d45; --profundo:#1b4d2c; --dorado:#d9a441; --fondo:#f4f6f1; --texto:#1f2a22; --muted:#5b6b5f; }
  * { box-sizing:border-box } html,body { margin:0; height:100%; font-family:system-ui,Segoe UI,Roboto,sans-serif; color:var(--texto); background:var(--fondo) }
  #aviso { background:#fff7df; border-bottom:1px solid #e7d7a6; font-size:12px; padding:6px 12px; text-align:center }
  #app { display:grid; grid-template-columns: 1fr 380px; height:calc(100% - 29px) }
  #map { height:100% }
  #panel { overflow:auto; padding:12px 14px; background:#fff; border-left:1px solid #e3e8e0 }
  h1 { font-size:18px; margin:0 0 6px; color:var(--profundo) } h2 { font-size:14px; margin:14px 0 6px; color:var(--profundo) }
  .fila { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px } label { font-size:12px; color:var(--muted); display:block }
  select,input,button { font:inherit; padding:6px 8px; border:1px solid #cdd6cc; border-radius:8px; background:#fff }
  button.pri { background:var(--verde); color:#fff; border-color:var(--verde); cursor:pointer } button.pri:hover{ background:var(--profundo) }
  .chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; margin:2px 4px 2px 0; background:#eef3ea }
  .estado { padding:12px; border-radius:12px; color:#fff; margin:8px 0 } .sembrar{background:#22a05b} .esperar{background:#d9a441} .precaucion{background:#c2410c}
  .alerta { border-left:4px solid #ccc; padding:6px 8px; margin:6px 0; background:#fafbf8; font-size:13px; border-radius:6px }
  .critico{border-color:#c2410c} .advertencia{border-color:#d9a441} .info{border-color:#60a5fa}
  .leyenda { font-size:12px; line-height:1.5 } .sw { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:4px; vertical-align:-1px }
  .muted { color:var(--muted); font-size:12px } table{ font-size:12px; border-collapse:collapse; width:100% } td{ padding:2px 4px; border-bottom:1px solid #eee }
  #ayuda { font-size:12px; color:var(--muted) }
  @media (max-width: 820px) { #app { grid-template-columns:1fr; grid-template-rows: 55% 45% } #panel { border-left:0; border-top:1px solid #e3e8e0 } }
</style>
</head>
<body>
<div id="aviso">⚠️ <b>Demo del backend.</b> Los datos SAR de la grilla y del lote son <b>FICTICIOS</b> (generados) y los umbrales son supuestos. Las imágenes de fondo sí son reales (Esri, NASA GIBS). No usar para decisiones reales.</div>
<div id="app">
  <div id="map" role="application" aria-label="Mapa de San Rafael del Paraná y Bella Vista"></div>
  <aside id="panel">
    <h1>AgroSAR · Analizá tu chacra</h1>
    <div class="fila">
      <div><label for="cultivo">Cultivo</label><select id="cultivo"></select></div>
      <div><label for="suelo">Suelo (opcional)</label><select id="suelo"><option value="">— no sé —</option><option>arcilloso</option><option>arenoso</option><option>franco</option><option>humedo</option><option>degradado</option></select></div>
      <div><label for="fecha">Fecha</label><input id="fecha" type="date" /></div>
    </div>
    <div class="fila">
      <div><label for="capa">Colorear grilla por</label><select id="capa"><option value="aptitud">Aptitud para plantar</option><option value="humedad">Humedad SAR</option><option value="cobertura">Cobertura (campo / árboles / agua)</option><option value="">— ocultar grilla —</option></select></div>
      <div><label for="distrito">Ir a</label><select id="distrito"></select></div>
    </div>
    <div class="fila">
      <button class="pri" id="dibujar">✏️ Marcar mi hectárea</button>
      <button id="terminar" disabled>✔ Terminar</button>
      <button id="deshacer" disabled>↶ Deshacer punto</button>
      <button id="borrar">Borrar</button>
    </div>
    <p id="ayuda">Tocá "Marcar mi hectárea" y hacé clic en el mapa en cada esquina de tu lote; terminá con doble clic, tocando el primer punto o con "Terminar". Acercá el mapa para ver la grilla de 200 m.</p>
    <div id="resultado"></div>
    <h2>Leyenda</h2>
    <div class="leyenda" id="leyenda"></div>
    <p class="muted" style="margin-top:14px">Fuentes: imagen satelital © Esri, Maxar, Earthstar Geographics; HLS (Landsat 8/9 + Sentinel-2, 30 m) y NDVI MODIS: NASA GIBS/Worldview; humedad del suelo: grilla FICTICIA en lugar de NISAR SME2 (NASA-ISRO) hasta que el pipeline la procese. Proyecto comunitario, no afiliado ni respaldado por NASA. Límites de distritos aproximados.</p>
  </aside>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
(async function () {
  const $ = (id) => document.getElementById(id);
  const hoy = new Date().toISOString().slice(0, 10);
  $("fecha").value = hoy;

  // --- Mapa y capas base ---------------------------------------------------------------
  const map = L.map("map", { zoomControl: true, minZoom: 9, maxZoom: 18 });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, attribution: "© Esri, Maxar, Earthstar Geographics" }).addTo(map);
  const etiquetas = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, opacity: 0.9 }).addTo(map);
  const fechaGibs = (d) => d; // GIBS acepta AAAA-MM-DD
  const hls = L.tileLayer("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{time}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png", { time: fechaGibs(hoy), maxNativeZoom: 12, maxZoom: 18, opacity: 0.95, attribution: "NASA GIBS · HLS S30" });
  const ndvi = L.tileLayer("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png", { time: fechaGibs(hoy), maxNativeZoom: 9, maxZoom: 18, opacity: 0.6, attribution: "NASA GIBS · MODIS NDVI 8 días" });
  const grilla = L.geoJSON(null, { style: estiloCelda, onEachFeature: popupCelda }).addTo(map);
  const distritosCapa = L.geoJSON(null, { style: { color: "#ffd166", weight: 2, fill: false, dashArray: "6 4" } }).addTo(map);
  const dibujo = new L.FeatureGroup().addTo(map);
  const sectoresCapa = L.geoJSON(null, { style: (f) => ({ color: "#fff", weight: 1, fillColor: colorAptitud(f.properties.aptitud), fillOpacity: 0.65 }), onEachFeature: popupCelda }).addTo(map);
  L.control.layers({ "Satélite (Esri)": sat }, { "Nombres de lugares": etiquetas, "NASA HLS 30 m (fecha elegida)": hls, "NASA NDVI MODIS (vigor vegetal)": ndvi, "Grilla SAR (ficticia)": grilla, "Distritos": distritosCapa, "Sectores de mi lote": sectoresCapa }, { collapsed: false, position: "topleft" }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);

  // --- Distritos de trabajo ---------------------------------------------------------------
  const zonas = await (await fetch("/api/mapa/zonas")).json();
  distritosCapa.addData(zonas);
  const b = zonas.bbox;
  map.fitBounds([[b[1], b[0]], [b[3], b[2]]]);
  map.setMaxBounds([[b[1] - 0.3, b[0] - 0.3], [b[3] + 0.3, b[2] + 0.3]]);
  for (const f of zonas.features) {
    const o = document.createElement("option"); o.value = f.properties.id; o.textContent = f.properties.nombre + " (límite aprox.)"; $("distrito").appendChild(o);
  }
  $("distrito").onchange = () => { const f = zonas.features.find((x) => x.properties.id === $("distrito").value); if (f) map.fitBounds(L.geoJSON(f).getBounds()); };

  // --- Cultivos ---------------------------------------------------------------------------
  const cult = await (await fetch("/api/cultivos")).json();
  for (const c of cult.cultivos) { const o = document.createElement("option"); o.value = c.id; o.textContent = c.nombre; $("cultivo").appendChild(o); }

  // --- Grilla SAR -------------------------------------------------------------------------
  const COL = { cobertura: { cultivo: "#d9a441", pastura: "#a9c47f", bosque: "#1f6b3a", agua: "#3b82c4", urbano: "#8a8a8a" }, humedad: { seco: "#b45309", bajo: "#f59e0b", optimo: "#22c55e", humedo: "#0ea5e9", saturado: "#1d4ed8", sin_datos: "#9ca3af" } };
  function colorAptitud(a) { return a >= 80 ? "#15803d" : a >= 65 ? "#4ade80" : a >= 50 ? "#facc15" : a > 0 ? "#f97316" : "#6b7280"; }
  function estiloCelda(f) {
    const p = f.properties, capa = $("capa").value;
    const fill = capa === "humedad" ? COL.humedad[p.humedad_estado] : capa === "cobertura" ? COL.cobertura[p.cobertura] : colorAptitud(p.aptitud);
    return { color: "rgba(255,255,255,.25)", weight: 0.5, fillColor: fill, fillOpacity: 0.55 };
  }
  function popupCelda(f, l) {
    const p = f.properties;
    l.bindPopup("<b>Celda " + p.id + "</b><br>Cobertura: " + p.cobertura + "<br>Humedad SAR: " + p.humedad_m3m3 + " m³/m³ (" + p.humedad_estado + ")<br>Pendiente: " + p.pendiente_pct + " %<br>Aptitud: <b>" + p.aptitud + "/100</b><br><small>" + p.motivos.join(" · ") + "</small><br><small>Humedad: " + (p.fuente_humedad === "nisar" ? "NISAR SME2 (real, pasada " + p.fecha_obs + ")" : "FICTICIA") + " · cobertura y pendiente ficticias</small>");
  }
  let cargando = null;
  async function cargarGrilla() {
    grilla.clearLayers();
    if (!map.hasLayer(grilla)) return;
    if (!$("capa").value || map.getZoom() < 11) { $("ayuda").textContent = $("capa").value ? "Acercá el mapa (zoom ≥ 11) para ver la grilla SAR de 200 m." : "Grilla oculta."; return; }
    const bb = map.getBounds();
    const q = new URLSearchParams({ bbox: [bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()].join(","), cultivo: $("cultivo").value, fecha: $("fecha").value });
    const ctrl = new AbortController(); if (cargando) cargando.abort(); cargando = ctrl;
    try {
      const r = await fetch("/api/mapa/celdas?" + q, { signal: ctrl.signal }); const g = await r.json();
      grilla.addData(g);
      $("ayuda").textContent = g.features.length + " celdas de " + g.res_m + " m (SAR ficticio, " + g.fecha + "). " + (g.nota || "Clic en una celda para ver el detalle.");
    } catch (e) { if (e.name !== "AbortError") $("ayuda").textContent = "No se pudo cargar la grilla: " + e.message; }
  }
  map.on("moveend", cargarGrilla);
  for (const id of ["capa", "cultivo", "fecha"]) $(id).addEventListener("change", () => { hls.options.time = $("fecha").value; hls.redraw(); ndvi.options.time = $("fecha").value; ndvi.redraw(); cargarGrilla(); if (ultimoPoligono) analizar(ultimoPoligono); });
  cargarGrilla();

  // --- Dibujo del lote (clics simples; sin plugin) ------------------------------------------
  let ultimoPoligono = null, vertices = [], dibujando = false, trazo = null;
  const estiloTrazo = { color: "#ffffff", weight: 3, fillOpacity: 0.08, dashArray: "6 4" };
  function redibujar() {
    if (trazo) dibujo.removeLayer(trazo);
    const ll = vertices.map((v) => [v[1], v[0]]);
    trazo = (vertices.length >= 3 ? L.polygon(ll, estiloTrazo) : L.polyline(ll, estiloTrazo)).addTo(dibujo);
    $("terminar").disabled = vertices.length < 3; $("deshacer").disabled = vertices.length === 0;
    $("ayuda").textContent = vertices.length + " punto(s). " + (vertices.length >= 3 ? "Doble clic, clic en el primer punto o «Terminar» para cerrar el lote." : "Seguí marcando esquinas.");
  }
  function iniciarDibujo() {
    $("borrar").onclick(); dibujando = true; vertices = [];
    map.closePopup(); map.removeLayer(grilla); map.doubleClickZoom.disable(); map.getContainer().style.cursor = "crosshair";
    $("ayuda").textContent = "Hacé clic en cada esquina de tu lote.";
  }
  function terminarDibujo() {
    if (vertices.length < 3) return;
    dibujando = false; map.doubleClickZoom.enable(); map.getContainer().style.cursor = "";
    if ($("capa").value) { grilla.addTo(map); cargarGrilla(); }
    ultimoPoligono = { type: "Polygon", coordinates: [[...vertices, vertices[0]]] };
    dibujo.clearLayers(); trazo = L.polygon(vertices.map((v) => [v[1], v[0]]), { color: "#ffffff", weight: 3, fillOpacity: 0.05 }).addTo(dibujo);
    analizar(ultimoPoligono);
  }
  map.on("click", (e) => {
    if (!dibujando) return;
    const p = [e.latlng.lng, e.latlng.lat];
    if (vertices.length >= 3 && map.latLngToContainerPoint(e.latlng).distanceTo(map.latLngToContainerPoint([vertices[0][1], vertices[0][0]])) < 12) return terminarDibujo();
    const u = vertices.at(-1); if (u && u[0] === p[0] && u[1] === p[1]) return; // doble clic repite el punto
    vertices.push(p); L.circleMarker(e.latlng, { radius: 6, color: "#fff", weight: 2, fillColor: "#287d45", fillOpacity: 1 }).addTo(dibujo); redibujar();
  });
  map.on("dblclick", (e) => { if (dibujando) { L.DomEvent.stop(e); terminarDibujo(); } });
  $("dibujar").onclick = iniciarDibujo;
  $("terminar").onclick = terminarDibujo;
  $("deshacer").onclick = () => { vertices.pop(); dibujo.clearLayers(); trazo = null; vertices.forEach((v) => L.circleMarker([v[1], v[0]], { radius: 6, color: "#fff", weight: 2, fillColor: "#287d45", fillOpacity: 1 }).addTo(dibujo)); redibujar(); };
  $("borrar").onclick = () => { dibujando = false; vertices = []; trazo = null; dibujo.clearLayers(); sectoresCapa.clearLayers(); ultimoPoligono = null; $("resultado").innerHTML = ""; $("terminar").disabled = true; $("deshacer").disabled = true; map.doubleClickZoom.enable(); map.getContainer().style.cursor = ""; if ($("capa").value && !map.hasLayer(grilla)) { grilla.addTo(map); cargarGrilla(); } };

  async function analizar(poligono) {
    $("resultado").innerHTML = "<p class='muted'>Analizando con SAR…</p>";
    const cuerpo = { poligono, cultivo: $("cultivo").value, fecha: $("fecha").value };
    if ($("suelo").value) cuerpo.suelo = { tipo: $("suelo").value };
    const r = await fetch("/api/lote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
    const d = await r.json();
    if (!r.ok) { $("resultado").innerHTML = "<p class='alerta critico'>" + (d.error || "error") + "</p>"; return; }
    sectoresCapa.clearLayers(); if (d.celdas) sectoresCapa.addData(d.celdas);
    const a = d.analisis, s = d.sectores, l = d.lote;
    const alertas = a.alertas.map((x) => "<div class='alerta " + x.nivel + "'><b>" + x.titulo + "</b> <span class='muted'>(" + x.fuente_dato + ")</span><br>" + x.detalle + "<br><i>" + x.recomendacion + "</i></div>").join("");
    const mejores = s.mejores.map((m) => "<tr><td>" + m.aptitud + "/100</td><td>" + m.cobertura + "</td><td>" + m.humedad_m3m3 + "</td><td>" + m.pendiente_pct + " %</td></tr>").join("");
    const cob = Object.entries(s.cobertura_pct).map(([k, v]) => "<span class='chip'><span class='sw' style='background:" + COL.cobertura[k] + "'></span>" + k + " " + v + " %</span>").join("");
    $("resultado").innerHTML =
      "<h2>Tu lote</h2><div class='fila'><span class='chip'><b>" + l.hectareas + " ha</b></span><span class='chip'>" + (l.distrito ? l.distrito.nombre : "fuera de los distritos") + "</span><span class='chip'>" + s.celdas + " celdas SAR de " + s.res_m + " m</span></div>" +
      "<div class='estado " + a.estado + "'><b>" + a.etiqueta + "</b><br><small>" + a.motivo + "</small></div>" +
      "<p><b>¿Cuándo sembrar?</b> " + (a.ventana.sembrar_ahora ? "Ahora." : (a.ventana.dias_espera != null ? "En unos " + a.ventana.dias_espera + " días (" + a.ventana.fecha_estimada + ")." : "Esperar.")) + " <span class='muted'>" + a.ventana.motivo + "</span></p>" +
      "<p><b>Semilla:</b> " + a.semilla.semilla + " <span class='muted'>— " + a.semilla.motivo + (a.semilla.ciclo_sugerido ? " · ciclo " + a.semilla.ciclo_sugerido.nombre + " (" + a.semilla.ciclo_sugerido.dias + " d)" : "") + "</span></p>" +
      "<p><b>Fechas:</b> madurez " + a.fechas.madurez + " · cosecha " + a.fechas.cosecha + "</p>" +
      "<h2>Sectores del lote (SAR)</h2><p>" + cob + "</p><p><b>" + s.hectareas_aptas + " ha aptas</b> (" + s.porcentaje_apto + " %) · humedad media " + s.humedad_m3m3.media + " m³/m³ (" + s.humedad_m3m3.min + "–" + s.humedad_m3m3.max + ") · aptitud media " + s.aptitud_media + "/100</p>" +
      "<table><tr><th>Mejor sector</th><th>Cobertura</th><th>Humedad</th><th>Pendiente</th></tr>" + mejores + "</table><p class='muted'>Los sectores se pintan sobre el mapa (verde = mejor).</p>" +
      "<h2>Alertas (" + a.alertas.length + ")</h2>" + alertas +
      "<p class='muted'>Humedad de la serie: " + a.humedad.media_m3m3 + " m³/m³, " + a.humedad.n_observaciones + " obs. en " + a.humedad.ventana_dias + " días · " + a.fuentes.join(" · ") + "</p>";
  }

  // --- Leyenda ----------------------------------------------------------------------------
  $("leyenda").innerHTML =
    "<b>Aptitud</b>: <span class='sw' style='background:#15803d'></span>≥80 muy apta · <span class='sw' style='background:#4ade80'></span>65–79 · <span class='sw' style='background:#facc15'></span>50–64 · <span class='sw' style='background:#f97316'></span>1–49 · <span class='sw' style='background:#6b7280'></span>0 (agua/urbano/bosque)<br>" +
    "<b>Humedad SAR</b>: " + Object.entries(COL.humedad).map(([k, c]) => "<span class='sw' style='background:" + c + "'></span>" + k).join(" · ") + "<br>" +
    "<b>Cobertura</b>: " + Object.entries(COL.cobertura).map(([k, c]) => "<span class='sw' style='background:" + c + "'></span>" + k).join(" · ");
})();
</script>
</body>
</html>`;
}
