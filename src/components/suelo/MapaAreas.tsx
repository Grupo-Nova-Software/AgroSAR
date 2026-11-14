"use client";
// Mapa de áreas (Leaflet). Cada rectángulo se colorea según la recomendación para el cultivo elegido.
// Leaflet se importa dinámicamente porque necesita `window` (no corre en el servidor).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Rectangle, TileLayer } from "leaflet";
import type { EstadoRecomendacion, SerieHumedad } from "@/types/contratos";
import { useTema } from "../tema";

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
    r.setStyle({ color, fillColor: color, weight: sel ? 4 : 1.5, fillOpacity: sel ? 0.45 : 0.22, dashArray: sel ? undefined : "4 4" });
    if (sel) r.bringToFront();
  }
}

export default function MapaAreas({
  areas,
  estados,
  seleccionada,
  alSeleccionar,
}: {
  areas: SerieHumedad[];
  estados: Record<string, EstadoRecomendacion | undefined>;
  seleccionada: string;
  alSeleccionar: (id: string) => void;
}) {
  const { tema } = useTema();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const tiles = useRef<TileLayer | null>(null);
  const rects = useRef<Record<string, Rectangle>>({});
  const [listo, setListo] = useState(false);
  const alSeleccionarRef = useRef(alSeleccionar);
  useEffect(() => {
    alSeleccionarRef.current = alSeleccionar;
  });

  // Crear el mapa y los rectángulos (una vez por conjunto de áreas)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      const m = L.map(contenedor.current, { scrollWheelZoom: false, attributionControl: true });
      tiles.current = L.tileLayer(TILES[tema], {
        attribution: ATRIBUCION,
        subdomains: "abcd",
        maxZoom: 18,
      }).addTo(m);
      const grupo: Rectangle[] = [];
      for (const a of areas) {
        const [lo1, la1, lo2, la2] = a.bbox;
        const r = L.rectangle([[la1, lo1], [la2, lo2]], { weight: 2 })
          .addTo(m)
          .bindTooltip(a.zona, { direction: "top", sticky: true })
          .on("click", () => alSeleccionarRef.current(a.id));
        rects.current[a.id] = r;
        grupo.push(r);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recrea solo si cambian las áreas
  }, [areas]);

  // Colores según estado, selección y tema (el tema cambia los valores de los tokens CSS)
  useEffect(() => {
    if (!listo) return;
    pintar(rects.current, estados, seleccionada);
    tiles.current?.setUrl(TILES[tema]);
  }, [listo, estados, seleccionada, tema]);

  return <div ref={contenedor} className="h-72 w-full overflow-hidden rounded-2xl border border-borde md:h-[26rem]" aria-label="Mapa de zonas" />;
}
