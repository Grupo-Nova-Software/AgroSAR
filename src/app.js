// AgroSAR Itapúa — web estática. Lee /data/processed/*.json y /config/umbrales.json.
const RUTA_DATOS = "/data/processed/";
const RUTA_UMBRALES = "/config/umbrales.json";

const estado = { zonas: [], datos: {}, umbrales: null, capas: {}, grafico: null };
const $ = (id) => document.getElementById(id);

async function cargarJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar ${url} (${r.status})`);
  return r.json();
}

async function iniciar() {
  try {
    const [indice, umbrales] = await Promise.all([cargarJSON(RUTA_DATOS + "index.json"), cargarJSON(RUTA_UMBRALES)]);
    estado.umbrales = umbrales;
    estado.zonas = indice.zonas;
    await Promise.all(estado.zonas.map(async (z) => { estado.datos[z.id] = await cargarJSON(RUTA_DATOS + z.archivo); }));
  } catch (e) {
    $("reco-detalle").textContent = "Error cargando datos: " + e.message;
    return;
  }
  iniciarMapa();
  const sel = $("zona");
  estado.zonas.forEach((z) => sel.add(new Option(z.zona, z.id)));
  sel.addEventListener("change", () => seleccionarZona(sel.value));
  $("desde").addEventListener("change", actualizar);
  $("hasta").addEventListener("change", actualizar);
  seleccionarZona(estado.zonas[0].id);
}

function iniciarMapa() {
  const mapa = L.map("mapa", { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap",
  }).addTo(mapa);
  const grupo = [];
  estado.zonas.forEach((z) => {
    const [lo1, la1, lo2, la2] = estado.datos[z.id].bbox;
    const rect = L.rectangle([[la1, lo1], [la2, lo2]], { color: "#2e7d32", weight: 2, fillOpacity: 0.1 })
      .addTo(mapa).bindTooltip(z.zona);
    rect.on("click", () => { $("zona").value = z.id; seleccionarZona(z.id); });
    estado.capas[z.id] = rect;
    grupo.push(rect);
  });
  mapa.fitBounds(L.featureGroup(grupo).getBounds(), { padding: [10, 10] });
  estado.mapa = mapa;
}

function seleccionarZona(id) {
  estado.zonaActual = id;
  Object.entries(estado.capas).forEach(([k, c]) =>
    c.setStyle(k === id ? { color: "#c62828", weight: 3, fillOpacity: 0.25 } : { color: "#2e7d32", weight: 2, fillOpacity: 0.1 }));
  const serie = estado.datos[id].serie;
  const fechas = serie.map((p) => p.fecha);
  ["desde", "hasta"].forEach((k) => { $(k).min = fechas[0]; $(k).max = fechas[fechas.length - 1]; });
  $("desde").value = fechas[0];
  $("hasta").value = fechas[fechas.length - 1];
  actualizar();
}

function actualizar() {
  const d = estado.datos[estado.zonaActual];
  const desde = $("desde").value, hasta = $("hasta").value;
  const serie = d.serie.filter((p) => p.fecha >= desde && p.fecha <= hasta);

  // Aviso: reforzar si el JSON se declara ficticio
  const ficticio = /FICTICIO/i.test(d.fuente || "") || /FICTICIO/i.test(d._aviso || "");
  $("aviso-texto").textContent = ficticio
    ? `"${d.zona}": EJEMPLO FICTICIO, valores inventados, no son datos NASA.`
    : `"${d.zona}": datos NISAR provisionales (${d.fuente || "sin fuente"}), sin validación de campo.`;

  dibujarGrafico(serie);
  recomendar(serie, hasta);
}

function dibujarGrafico(serie) {
  const u = estado.umbrales;
  const lineas = [...new Set(u.reglas.flatMap((r) => [r.min, r.max]).filter((v) => v !== undefined))];
  const datasets = [
    { label: "Humedad del suelo (m³/m³)", data: serie.map((p) => p.humedad_m3m3), yAxisID: "y",
      borderColor: "#1565c0", backgroundColor: "#1565c0", tension: 0.25,
      pointStyle: serie.map((p) => (p.calidad === "buena" ? "circle" : "crossRot")),
      pointRadius: serie.map((p) => (p.calidad === "buena" ? 3 : 6)) },
    { label: "Retrodispersión HV (dB)", data: serie.map((p) => p.hv_db), yAxisID: "y2",
      borderColor: "#8d6e63", backgroundColor: "#8d6e63", borderDash: [4, 4], tension: 0.25, pointRadius: 2 },
    ...lineas.map((v) => ({ label: `umbral ${v} (supuesto)`, data: serie.map(() => v), yAxisID: "y",
      borderColor: "#9e9e9e", borderWidth: 1, borderDash: [2, 3], pointRadius: 0 })),
  ];
  if (estado.grafico) estado.grafico.destroy();
  estado.grafico = new Chart($("grafico"), {
    type: "line",
    data: { labels: serie.map((p) => p.fecha), datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { filter: (i) => !i.text.startsWith("umbral") } },
        tooltip: { callbacks: { afterBody: (it) => `Calidad: ${serie[it[0].dataIndex].calidad}` } } },
      scales: {
        y: { title: { display: true, text: "m³/m³" }, min: 0, max: 0.6 },
        y2: { position: "right", title: { display: true, text: "HV dB" }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

function recomendar(serie, hasta) {
  const u = estado.umbrales;
  const fin = new Date(hasta);
  const inicio = new Date(fin); inicio.setDate(inicio.getDate() - u.ventana_dias);
  const validos = serie.filter((p) => p.calidad === u.calidad_minima && new Date(p.fecha) > inicio && new Date(p.fecha) <= fin
    && typeof p.humedad_m3m3 === "number");
  const el = $("reco-estado");
  el.className = "estado";
  if (validos.length < u.min_observaciones) {
    el.textContent = u.sin_datos.etiqueta;
    el.classList.add(u.sin_datos.estado);
    $("reco-detalle").textContent = `No hay observaciones de calidad "${u.calidad_minima}" en los ${u.ventana_dias} días previos a ${hasta}.`;
    return;
  }
  const media = validos.reduce((s, p) => s + p.humedad_m3m3, 0) / validos.length;
  const regla = u.reglas.find((r) => (r.min === undefined || media >= r.min) && (r.max === undefined || media < r.max));
  el.textContent = regla.etiqueta;
  el.classList.add(regla.estado);
  $("reco-detalle").textContent =
    `Humedad media ${media.toFixed(3)} m³/m³ con ${validos.length} observación(es) válidas en los ${u.ventana_dias} días previos a ${hasta}.`;
}

iniciar();
