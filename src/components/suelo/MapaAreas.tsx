"use client";
// Mapa de áreas (Leaflet). Cada rectángulo se colorea según la recomendación para el cultivo elegido.
// Capas: mapa OSM / satélite Esri + NASA GIBS (NDVI MODIS y HLS 30 m), idea tomada de la demo del backend.
// Dibujo de lote: tocar el mapa para marcar esquinas → `alTerminarLote(poligono GeoJSON)`.
// Leaflet se importa dinámicamente porque necesita `window` (no corre en el servidor).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LMap, Rectangle } from "leaflet";
import type { EstadoRecomendacion, SerieHumedad } from "@/types/contratos";
import { useIdioma } from "../idioma";
import { useTema } from "../tema";

export type PoligonoGeoJSON = { type: "Polygon"; coordinates: [number, number][][] };

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ETIQUETAS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const GIBS_NDVI = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png";
const GIBS_HLS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{time}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png";

/** Resuelve un token CSS (p. ej. --primario) a su color actual, porque Leaflet no entiende var(). */
const colorDe = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#287d45";
export const TOKEN_ESTADO: Record<EstadoRecomendacion, string> = {
  sembrar: "--primario",
  esperar: "--dorado",
  precaucion: "--peligro",
};

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
}: {
  areas: SerieHumedad[];
  estados: Record<string, EstadoRecomendacion | undefined>;
  seleccionada: string;
  alSeleccionar: (id: string) => void;
  fechaCapas: string; // fecha para las capas NASA GIBS (AAAA-MM-DD)
  alTerminarLote: (p: PoligonoGeoJSON | null) => void;
}) {
  const { t } = useIdioma();
  const { tema } = useTema();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const rects = useRef<Record<string, Rectangle>>({});
  const capaDibujo = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const [listo, setListo] = useState(false);

  // Estado del dibujo (refs para que el handler de Leaflet lea siempre el valor actual)
  const [dibujando, setDibujando] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>([]); // [lon, lat]
  const dibujandoRef = useRef(false);
  const alSeleccionarRef = useRef(alSeleccionar);
  useEffect(() => {
    alSeleccionarRef.current = alSeleccionar;
    dibujandoRef.current = dibujando;
  });

  // Crear el mapa, capas y rectángulos (una vez por conjunto de áreas)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      LRef.current = L;
      const m = L.map(contenedor.current, { scrollWheelZoom: false });
      const osm = L.tileLayer(OSM, { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(m);
      const sat = L.layerGroup([
        L.tileLayer(ESRI_SAT, { maxZoom: 18, attribution: "&copy; Esri, Maxar, Earthstar Geographics" }),
        L.tileLayer(ESRI_ETIQUETAS, { maxZoom: 18, opacity: 0.9 }),
      ]);
      const ndvi = L.tileLayer(GIBS_NDVI.replace("{time}", fechaCapas), {
        maxNativeZoom: 9, maxZoom: 18, opacity: 0.6, attribution: "NASA GIBS · MODIS NDVI",
      });
      const hls = L.tileLayer(GIBS_HLS.replace("{time}", fechaCapas), {
        maxNativeZoom: 12, maxZoom: 18, opacity: 0.95, attribution: "NASA GIBS · HLS",
      });
      L.control
        .layers({ [t("capaMapa")]: osm, [t("capaSatelite")]: sat }, { [t("capaNdvi")]: ndvi, [t("capaHls")]: hls }, { position: "topleft" })
        .addTo(m);
      L.control.scale({ imperial: false }).addTo(m);

      const grupo: Rectangle[] = [];
      for (const a of areas) {
        const [lo1, la1, lo2, la2] = a.bbox;
        const r = L.rectangle([[la1, lo1], [la2, lo2]], { weight: 2 })
          .addTo(m)
          .bindTooltip(a.zona, { direction: "top", sticky: true })
          .on("click", () => {
            if (!dibujandoRef.current) alSeleccionarRef.current(a.id);
          });
        rects.current[a.id] = r;
        grupo.push(r);
      }
      capaDibujo.current = L.layerGroup().addTo(m);
      m.on("click", (e) => {
        if (dibujandoRef.current) setVertices((v) => [...v, [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))]]);
      });
      if (grupo.length) m.fitBounds(L.featureGroup(grupo).getBounds(), { padding: [16, 16] });
      mapa.current = m;
      setListo(true);
    })();
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      rects.current = {};
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se recrea solo si cambian las áreas o la fecha de las capas
  }, [areas, fechaCapas]);

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
    if (vertices.length < 3) return;
    setDibujando(false);
    const anillo = [...vertices, vertices[0]];
    alTerminarLote({ type: "Polygon", coordinates: [anillo] });
  };
  const borrar = () => {
    setVertices([]);
    setDibujando(false);
    alTerminarLote(null);
  };

  const boton = "rounded-full border border-borde bg-barra px-3 py-1.5 text-xs font-semibold text-texto shadow-suave backdrop-blur hover:bg-tarjeta-2 disabled:opacity-40";
  return (
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
          {t("ayudaDibujo")}
        </p>
      )}
    </div>
  );
}
