"use client";
// Mapa de campo (Leaflet) de San Rafael del Paraná y Bella Vista. Versión del mapa del backend (/api/mapa/demo)
// integrada a la pestaña Suelo, manteniendo el contrato de props de antes (areas, estados, seleccionada, …):
//  - Fondo: satélite Esri (por defecto) u OSM. Capas NASA GIBS: NDVI MODIS y HLS 30 m.
//  - Grilla SAR de 200 m (GET /api/mapa/celdas) coloreada por aptitud, humedad o cobertura (zoom ≥ 11).
//  - Distritos de trabajo (GET /api/mapa/zonas) y zonas de análisis NISAR coloreadas por la recomendación (clic = elegir zona).
//  - Dibujo de lote: clics en las esquinas → `alTerminarLote(poligono GeoJSON)`; los sectores del lote se pintan por aptitud.
// Leaflet se importa dinámicamente porque necesita `window` (no corre en el servidor).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSON as CapaGeoJSON, LayerGroup, Map as LMap, Rectangle } from "leaflet";
import type { EstadoRecomendacion, SerieHumedad } from "@/types/contratos";
import { type Texto, useIdioma } from "../idioma";
import { useTema } from "../tema";

export type PoligonoGeoJSON = { type: "Polygon"; coordinates: [number, number][][] };
/** FeatureCollection de celdas que devuelve el backend (`celdas` de POST /api/lote y GET /api/mapa/celdas). */
export type CeldasGeoJSON = { type: "FeatureCollection"; features: unknown[] };

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ETIQUETAS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const GIBS_NDVI = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png";
const GIBS_HLS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{time}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png";
const ZOOM_GRILLA = 11; // por debajo de este zoom la grilla de 200 m tendría demasiadas celdas

/** Resuelve un token CSS (p. ej. --primario) a su color actual, porque Leaflet no entiende var(). */
const colorDe = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#287d45";
export const TOKEN_ESTADO: Record<EstadoRecomendacion, string> = {
  sembrar: "--primario",
  esperar: "--dorado",
  precaucion: "--peligro",
};

// --- Textos propios del mapa (ES/EN) y colores de la grilla ---------------------------------------
type ColorPor = "aptitud" | "humedad" | "cobertura" | "ninguna";
const L10N = {
  grilla: { es: "Grilla SAR 200 m", en: "SAR grid 200 m" },
  distritos: { es: "Distritos", en: "Districts" },
  zonas: { es: "Zonas de análisis NISAR", en: "NISAR analysis areas" },
  sectores: { es: "Sectores de mi lote", en: "Sectors of my plot" },
  colorear: { es: "Colorear grilla por", en: "Colour grid by" },
  aptitud: { es: "Aptitud para plantar", en: "Planting suitability" },
  humedad: { es: "Humedad del suelo (SAR)", en: "Soil moisture (SAR)" },
  cobertura: { es: "Cobertura", en: "Land cover" },
  ninguna: { es: "Ocultar grilla", en: "Hide grid" },
  acercar: { es: "Acercá el mapa para ver la grilla SAR de 200 m.", en: "Zoom in to see the 200 m SAR grid." },
  celdas: { es: "celdas de", en: "cells of" },
  tocaCelda: { es: "Tocá una celda para ver el detalle.", en: "Tap a cell for details." },
  sinGrilla: { es: "No se pudo cargar la grilla", en: "Could not load the grid" },
  pendiente: { es: "Pendiente", en: "Slope" },
  aptitudDe: { es: "Aptitud", en: "Suitability" },
  humedadDe: { es: "Humedad SAR", en: "SAR moisture" },
  fuenteReal: { es: "NISAR SME2 (real, provisional), pasada", en: "NISAR SME2 (real, provisional), pass" },
  fuenteFicticia: { es: "FICTICIA (sin pasada NISAR en la celda)", en: "SAMPLE (no NISAR pass on this cell)" },
  nota: { es: "Cobertura y pendiente: datos de ejemplo.", en: "Land cover and slope: sample data." },
  irA: { es: "Ir a", en: "Go to" },
  cierre: { es: "Doble clic, o tocá el primer punto, para cerrar el lote.", en: "Double-click, or tap the first point, to close the plot." },
} satisfies Record<string, Texto>;
const HUMEDAD_TXT: Record<string, Texto> = {
  seco: { es: "seco", en: "dry" }, bajo: { es: "bajo", en: "low" }, optimo: { es: "óptimo", en: "optimal" },
  humedo: { es: "húmedo", en: "moist" }, saturado: { es: "saturado", en: "saturated" }, sin_datos: { es: "sin datos", en: "no data" },
};
const COBERTURA_TXT: Record<string, Texto> = {
  cultivo: { es: "cultivo", en: "cropland" }, pastura: { es: "pastura", en: "pasture" }, bosque: { es: "bosque", en: "forest" },
  agua: { es: "agua", en: "water" }, urbano: { es: "urbano", en: "built-up" },
};
const COLOR_COBERTURA: Record<string, string> = { cultivo: "#d9a441", pastura: "#a9c47f", bosque: "#1f6b3a", agua: "#3b82c4", urbano: "#8a8a8a" };
const COLOR_HUMEDAD: Record<string, string> = { seco: "#b45309", bajo: "#f59e0b", optimo: "#22c55e", humedo: "#0ea5e9", saturado: "#1d4ed8", sin_datos: "#9ca3af" };
const colorAptitud = (a: number) => (a >= 80 ? "#15803d" : a >= 65 ? "#4ade80" : a >= 50 ? "#facc15" : a > 0 ? "#f97316" : "#6b7280");
const TRAMOS_APTITUD: [string, string][] = [["≥80", "#15803d"], ["65–79", "#4ade80"], ["50–64", "#facc15"], ["1–49", "#f97316"], ["0", "#6b7280"]];

type PropsCelda = {
  cobertura: string; humedad_estado: string; humedad_m3m3: number; pendiente_pct: number; aptitud: number;
  motivos?: string[]; fuente_humedad?: string; fecha_obs?: string;
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Colorea cada rectángulo según su estado; la zona seleccionada va con borde grueso y al frente. */
function pintar(rects: Record<string, Rectangle>, estados: Record<string, EstadoRecomendacion | undefined>, seleccionada: string) {
  for (const [id, r] of Object.entries(rects)) {
    const estado = estados[id];
    const color = estado ? colorDe(TOKEN_ESTADO[estado]) : colorDe("--texto-suave");
    const sel = id === seleccionada;
    r.setStyle({ color, fillColor: color, weight: sel ? 4 : 1.5, fillOpacity: sel ? 0.35 : 0.15, dashArray: sel ? undefined : "4 4" });
    if (sel) r.bringToFront();
  }
}

export default function MapaAreas({
  areas,
  estados,
  seleccionada,
  alSeleccionar,
  fechaCapas,
  alTerminarLote,
  cultivo = "soja",
  celdasLote = null,
}: {
  areas: SerieHumedad[];
  estados: Record<string, EstadoRecomendacion | undefined>;
  seleccionada: string;
  alSeleccionar: (id: string) => void;
  fechaCapas: string; // fecha para las capas NASA GIBS y la grilla (AAAA-MM-DD)
  alTerminarLote: (p: PoligonoGeoJSON | null) => void;
  cultivo?: string; // cultivo para el que se calcula la aptitud de la grilla
  celdasLote?: CeldasGeoJSON | null; // sectores del lote dibujado (respuesta de /api/lote)
}) {
  const { t, tr } = useIdioma();
  const { tema } = useTema();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const rects = useRef<Record<string, Rectangle>>({});
  const capaDibujo = useRef<LayerGroup | null>(null);
  const capaGrilla = useRef<CapaGeoJSON | null>(null);
  const capaSectores = useRef<CapaGeoJSON | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const abortar = useRef<AbortController | null>(null);
  const [listo, setListo] = useState(false);
  const [colorPor, setColorPor] = useState<ColorPor>("aptitud");
  const [estadoGrilla, setEstadoGrilla] = useState("");
  const [listaDistritos, setListaDistritos] = useState<{ id: string; nombre: string; limites: [[number, number], [number, number]] }[]>([]);

  // Estado del dibujo (refs para que los handlers de Leaflet lean siempre el valor actual)
  const [dibujando, setDibujando] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>([]); // [lon, lat]
  const dibujandoRef = useRef(false);
  const verticesRef = useRef<[number, number][]>([]);
  const alSeleccionarRef = useRef(alSeleccionar);
  const terminarRef = useRef<() => void>(() => {});
  const cargarGrillaRef = useRef<() => void>(() => {});
  const colorPorRef = useRef<ColorPor>(colorPor);
  const cultivoRef = useRef(cultivo);
  const fechaRef = useRef(fechaCapas);
  const idiomaTr = useRef(tr);
  useEffect(() => {
    alSeleccionarRef.current = alSeleccionar;
    dibujandoRef.current = dibujando;
    verticesRef.current = vertices;
    colorPorRef.current = colorPor;
    cultivoRef.current = cultivo;
    fechaRef.current = fechaCapas;
    idiomaTr.current = tr;
  });

  // Crear el mapa, capas y rectángulos (una vez por conjunto de áreas y fecha de capas)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      LRef.current = L;
      const m = L.map(contenedor.current, { scrollWheelZoom: false, minZoom: 9, maxZoom: 18 });
      const osm = L.tileLayer(OSM, { maxZoom: 18, attribution: "&copy; OpenStreetMap" });
      const sat = L.layerGroup([
        L.tileLayer(ESRI_SAT, { maxZoom: 18, attribution: "&copy; Esri, Maxar, Earthstar Geographics" }),
        L.tileLayer(ESRI_ETIQUETAS, { maxZoom: 18, opacity: 0.9 }),
      ]).addTo(m);
      const ndvi = L.tileLayer(GIBS_NDVI.replace("{time}", fechaRef.current), {
        maxNativeZoom: 9, maxZoom: 18, opacity: 0.6, attribution: "NASA GIBS · MODIS NDVI",
      });
      const hls = L.tileLayer(GIBS_HLS.replace("{time}", fechaRef.current), {
        maxNativeZoom: 12, maxZoom: 18, opacity: 0.95, attribution: "NASA GIBS · HLS",
      });

      // Grilla SAR: celdas de 200 m. Clic → detalle de la celda.
      const estiloCelda = (f?: { properties: PropsCelda }) => {
        const p = f?.properties;
        const c = colorPorRef.current;
        const fill = !p ? "#6b7280" : c === "humedad" ? COLOR_HUMEDAD[p.humedad_estado] : c === "cobertura" ? COLOR_COBERTURA[p.cobertura] : colorAptitud(p.aptitud);
        return { color: "rgba(255,255,255,.25)", weight: 0.5, fillColor: fill, fillOpacity: 0.55 };
      };
      const popupCelda = (f: { properties: PropsCelda }, capa: import("leaflet").Layer) => {
        const p = f.properties;
        const x = idiomaTr.current;
        const fuente = p.fuente_humedad === "nisar" ? `${x(L10N.fuenteReal)} ${esc(p.fecha_obs)}` : x(L10N.fuenteFicticia);
        capa.bindPopup(
          `<b>${esc(x(COBERTURA_TXT[p.cobertura] ?? { es: p.cobertura, en: p.cobertura }))}</b><br>` +
            `${x(L10N.humedadDe)}: ${esc(p.humedad_m3m3)} m³/m³ (${esc(x(HUMEDAD_TXT[p.humedad_estado] ?? { es: p.humedad_estado, en: p.humedad_estado }))})<br>` +
            `${x(L10N.pendiente)}: ${esc(p.pendiente_pct)} %<br>${x(L10N.aptitudDe)}: <b>${esc(p.aptitud)}/100</b><br>` +
            `<small>${esc((p.motivos ?? []).join(" · "))}</small><br><small>${esc(fuente)} · ${x(L10N.nota)}</small>`,
        );
      };
      const grilla = L.geoJSON(undefined, { style: estiloCelda as never, onEachFeature: popupCelda as never });
      const sectores = L.geoJSON(undefined, {
        style: ((f?: { properties: PropsCelda }) => ({ color: "#ffffff", weight: 1, fillColor: colorAptitud(f?.properties.aptitud ?? 0), fillOpacity: 0.7 })) as never,
        onEachFeature: popupCelda as never,
      });
      const distritos = L.geoJSON(undefined, {
        style: { color: "#ffd166", weight: 2, fill: false, dashArray: "6 4" },
        onEachFeature: ((f: { properties: { nombre: string } }, capa: import("leaflet").Layer) => capa.bindTooltip(f.properties.nombre, { sticky: true })) as never,
      });
      const zonas = L.layerGroup();
      capaGrilla.current = grilla;
      capaSectores.current = sectores;
      grilla.addTo(m);
      distritos.addTo(m);
      zonas.addTo(m);
      sectores.addTo(m);

      L.control
        .layers(
          { [t("capaMapa")]: osm, [t("capaSatelite")]: sat },
          {
            [t("capaNdvi")]: ndvi,
            [t("capaHls")]: hls,
            [tr(L10N.grilla)]: grilla,
            [tr(L10N.distritos)]: distritos,
            [tr(L10N.zonas)]: zonas,
            [tr(L10N.sectores)]: sectores,
          },
          { position: "topleft" },
        )
        .addTo(m);
      L.control.scale({ imperial: false }).addTo(m);

      const grupo: Rectangle[] = [];
      for (const a of areas) {
        const [lo1, la1, lo2, la2] = a.bbox;
        const r = L.rectangle([[la1, lo1], [la2, lo2]], { weight: 2 })
          .addTo(zonas)
          .bindTooltip(a.zona, { direction: "top", sticky: true })
          .on("click", () => {
            if (!dibujandoRef.current) alSeleccionarRef.current(a.id);
          });
        rects.current[a.id] = r;
        grupo.push(r);
      }
      capaDibujo.current = L.layerGroup().addTo(m);

      // Dibujo del lote: cada clic suma una esquina; clic en el primer punto (o doble clic) cierra.
      m.on("click", (e) => {
        if (!dibujandoRef.current) return;
        const v = verticesRef.current;
        if (v.length >= 3 && m.latLngToContainerPoint(e.latlng).distanceTo(m.latLngToContainerPoint([v[0][1], v[0][0]])) < 12) {
          terminarRef.current();
          return;
        }
        const p: [number, number] = [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))];
        const u = v.at(-1);
        if (u && u[0] === p[0] && u[1] === p[1]) return; // el doble clic repite el punto
        setVertices((prev) => [...prev, p]);
      });
      m.on("dblclick", (e) => {
        if (dibujandoRef.current) {
          L.DomEvent.stop(e);
          terminarRef.current();
        }
      });
      m.on("moveend", () => cargarGrillaRef.current());
      m.on("overlayadd", (e) => {
        if (e.layer === grilla) cargarGrillaRef.current();
      });

      if (grupo.length) m.fitBounds(L.featureGroup(grupo).getBounds(), { padding: [16, 16] });
      mapa.current = m;
      setListo(true);

      // Distritos de trabajo: encuadre y límites del mapa
      fetch("/api/mapa/zonas")
        .then((r) => (r.ok ? r.json() : null))
        .then((g) => {
          if (cancelado || !g || mapa.current !== m) return;
          distritos.addData(g);
          setListaDistritos(
            (g.features as { properties: { id: string; nombre: string }; geometry: { coordinates: [number, number][][] } }[]).map((f) => {
              const pts = f.geometry.coordinates[0];
              const lons = pts.map((q) => q[0]);
              const lats = pts.map((q) => q[1]);
              return { id: f.properties.id, nombre: f.properties.nombre, limites: [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]] as [[number, number], [number, number]] };
            }),
          );
          const [w, s, e, n] = g.bbox as [number, number, number, number];
          m.fitBounds([[s, w], [n, e]], { padding: [8, 8] });
          m.setMaxBounds([[s - 0.3, w - 0.3], [n + 0.3, e + 0.3]]);
        })
        .catch(() => {});
    })();
    return () => {
      cancelado = true;
      abortar.current?.abort();
      mapa.current?.remove();
      mapa.current = null;
      capaGrilla.current = null;
      capaSectores.current = null;
      rects.current = {};
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se recrea solo si cambian las áreas o la fecha de las capas
  }, [areas, fechaCapas]);

  // Carga de la grilla SAR para el recuadro visible (se cancela la consulta anterior)
  useEffect(() => {
    cargarGrillaRef.current = async () => {
      const m = mapa.current;
      const g = capaGrilla.current;
      if (!m || !g) return;
      g.clearLayers();
      abortar.current?.abort();
      if (!m.hasLayer(g) || colorPorRef.current === "ninguna" || dibujandoRef.current) return setEstadoGrilla("");
      if (m.getZoom() < ZOOM_GRILLA) return setEstadoGrilla(idiomaTr.current(L10N.acercar));
      const b = m.getBounds();
      const q = new URLSearchParams({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(","), cultivo: cultivoRef.current, fecha: fechaRef.current });
      const ctrl = new AbortController();
      abortar.current = ctrl;
      try {
        const r = await fetch(`/api/mapa/celdas?${q}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        g.addData(d);
        setEstadoGrilla(`${d.features.length} ${idiomaTr.current(L10N.celdas)} ${d.res_m} m. ${idiomaTr.current(L10N.tocaCelda)}`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setEstadoGrilla(idiomaTr.current(L10N.sinGrilla));
      }
    };
  });

  // Cambios de color, cultivo o idioma → repintar o recargar la grilla
  useEffect(() => {
    if (!listo) return;
    const m = mapa.current;
    const g = capaGrilla.current;
    if (!m || !g) return;
    if (colorPor === "ninguna") {
      if (m.hasLayer(g)) m.removeLayer(g);
    } else if (!m.hasLayer(g)) {
      g.addTo(m);
    }
    cargarGrillaRef.current(); // limpia el aviso si la grilla está oculta

  }, [listo, colorPor, cultivo, tr]);

  // Sectores del lote dibujado (aptitud por celda)
  useEffect(() => {
    const s = capaSectores.current;
    if (!listo || !s) return;
    s.clearLayers();
    if (celdasLote) s.addData(celdasLote as never);
  }, [celdasLote, listo]);

  // Mientras se dibuja se oculta la grilla (para que los clics no abran popups) y se desactiva el zoom por doble clic
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m) return;
    m.closePopup();
    if (dibujando) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
    cargarGrillaRef.current();
  }, [dibujando, listo]);

  // Colores según estado, selección y tema (el tema cambia los valores de los tokens CSS)
  useEffect(() => {
    if (!listo) return;
    pintar(rects.current, estados, seleccionada);
  }, [listo, estados, seleccionada, tema]);

  // Redibujar el trazo del lote
  useEffect(() => {
    const L = LRef.current;
    const capa = capaDibujo.current;
    if (!L || !capa) return;
    capa.clearLayers();
    if (!vertices.length) return;
    const ll = vertices.map(([lon, lat]) => [lat, lon] as [number, number]);
    const estilo = { color: "#ffffff", weight: 3, dashArray: dibujando ? "6 6" : undefined, fillOpacity: 0.15, fillColor: colorDe("--primario") };
    (ll.length >= 3 ? L.polygon(ll, estilo) : L.polyline(ll, estilo)).addTo(capa);
    ll.forEach((p) => L.circleMarker(p, { radius: 4, color: "#ffffff", fillColor: colorDe("--primario"), fillOpacity: 1, weight: 2 }).addTo(capa));
  }, [vertices, dibujando, listo]);

  const empezar = () => {
    setVertices([]);
    setDibujando(true);
    alTerminarLote(null);
  };
  const terminar = () => {
    if (verticesRef.current.length < 3) return;
    setDibujando(false);
    const v = verticesRef.current;
    alTerminarLote({ type: "Polygon", coordinates: [[...v, v[0]]] });
  };
  const borrar = () => {
    setVertices([]);
    setDibujando(false);
    alTerminarLote(null);
  };
  useEffect(() => {
    terminarRef.current = terminar;
  });

  const boton = "rounded-full border border-borde bg-barra px-3 py-1.5 text-xs font-semibold text-texto shadow-suave backdrop-blur hover:bg-tarjeta-2 disabled:opacity-40";
  const leyenda: [string, string][] =
    colorPor === "aptitud"
      ? TRAMOS_APTITUD
      : colorPor === "humedad"
        ? Object.entries(COLOR_HUMEDAD).map(([k, c]) => [tr(HUMEDAD_TXT[k]), c] as [string, string])
        : colorPor === "cobertura"
          ? Object.entries(COLOR_COBERTURA).map(([k, c]) => [tr(COBERTURA_TXT[k]), c] as [string, string])
          : [];
  return (
    <div>
      <div className="relative">
        <div
          ref={contenedor}
          className={`h-80 w-full overflow-hidden rounded-2xl border border-borde md:h-[28rem] ${dibujando ? "cursor-crosshair" : ""}`}
          aria-label="Mapa de zonas"
        />
        {/* Controles de dibujo del lote (arriba a la derecha del mapa) */}
        <div className="absolute right-2 top-2 z-[500] flex flex-wrap justify-end gap-1.5">
          {!dibujando ? (
            <button type="button" onClick={empezar} className="rounded-full bg-primario px-3 py-1.5 text-xs font-semibold text-sobre-primario shadow-suave hover:bg-primario-hover">
              ✏️ {t("marcarLote")}
            </button>
          ) : (
            <>
              <button type="button" onClick={terminar} disabled={vertices.length < 3} className="rounded-full bg-primario px-3 py-1.5 text-xs font-semibold text-sobre-primario shadow-suave disabled:opacity-40">
                ✔ {t("terminarLote")}
              </button>
              <button type="button" onClick={() => setVertices((v) => v.slice(0, -1))} disabled={!vertices.length} className={boton}>
                ↶ {t("deshacer")}
              </button>
            </>
          )}
          {(dibujando || vertices.length > 0) && (
            <button type="button" onClick={borrar} className={boton}>
              ✕ {t("borrar")}
            </button>
          )}
        </div>
        {dibujando && (
          <p className="absolute inset-x-2 bottom-8 z-[500] rounded-lg bg-barra px-3 py-2 text-center text-xs text-texto shadow-suave backdrop-blur">
            {t("ayudaDibujo")} {tr(L10N.cierre)}
          </p>
        )}
      </div>

      {/* Grilla SAR: selector de color, leyenda y estado de la carga */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
        <label className="flex items-center gap-2">
          {tr(L10N.colorear)}
          <select value={colorPor} onChange={(e) => setColorPor(e.target.value as ColorPor)} className="rounded-lg border border-borde bg-tarjeta px-2 py-1 text-texto">
            {(["aptitud", "humedad", "cobertura", "ninguna"] as const).map((c) => (
              <option key={c} value={c}>
                {tr(L10N[c])}
              </option>
            ))}
          </select>
        </label>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label={tr(L10N.colorear)}>
          {leyenda.map(([nombre, color]) => (
            <li key={nombre} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
              {nombre}
            </li>
          ))}
        </ul>
        {listaDistritos.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label={tr(L10N.irA)}>
            <span>{tr(L10N.irA)}</span>
            {listaDistritos.map((d) => (
              <button key={d.id} type="button" onClick={() => mapa.current?.fitBounds(d.limites, { padding: [8, 8] })} className="rounded-full border border-borde bg-tarjeta px-3 py-1 font-semibold text-texto hover:border-primario">
                {d.nombre}
              </button>
            ))}
          </div>
        )}
        {estadoGrilla && (
          <p className="w-full" role="status">
            {estadoGrilla}
          </p>
        )}
      </div>
    </div>
  );
}
