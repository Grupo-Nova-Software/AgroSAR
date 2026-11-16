// Vista aérea compartida por los mapas (Esri World Imagery: la de mejor detalle que se puede usar sin clave).
// - Pantallas de buena densidad y conexión normal: pide las imágenes un nivel más detallado (se ven nítidas).
// - Conexión lenta o «ahorro de datos»: imágenes normales, 4 veces menos descarga.
// - Esri no tiene el mismo detalle en todos lados: en el campo suele llegar a nivel 17 y en algunos lugares a 18.
//   Si se pide un nivel que no existe devuelve un cartel gris («Map data not yet available»). Para no mostrarlo,
//   se prueba una imagen del lugar y se usa el nivel real que haya (verificado el 15-nov-2026 en las 5 zonas).
import type { LatLngBounds, Map as LMap, Polygon, TileLayer } from "leaflet";
import { ITAPUA_ANILLO, ITAPUA_BBOX } from "@/lib/itapua";

export const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_NOMBRES = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const BYTES_CARTEL_GRIS = 2521; // tamaño exacto del cartel «sin datos» de Esri
const NIVEL_SEGURO = 17;
const NIVEL_MAXIMO = 18;

/**
 * Opciones para que el mapa responda rápido al dedo en un teléfono:
 * - no se piden imágenes de los niveles intermedios mientras se hace zoom (solo las del nivel final);
 * - las imágenes nuevas se piden cuando el mapa se detiene, no en cada movimiento;
 * - se guardan pocas filas de imágenes fuera de la pantalla (menos memoria).
 */
export const OPCIONES_RAPIDAS = { updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 1 } as const;

/** ¿Conviene gastar pocos datos? (ahorro de datos activado o red 2G/3G) */
export function conexionLenta(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)(2g|3g)$/.test(c.effectiveType ?? ""));
}

export function capaAerea(L: typeof import("leaflet"), m: LMap, limites?: LatLngBounds): TileLayer {
  const nitida = window.devicePixelRatio >= 1.5 && !conexionLenta();
  const extra = nitida ? 1 : 0;
  const capa = L.tileLayer(ESRI_SAT, {
    maxNativeZoom: NIVEL_SEGURO - extra,
    maxZoom: 19,
    tileSize: nitida ? 128 : 256,
    zoomOffset: extra,
    crossOrigin: true, // con CORS el service worker puede guardar las imágenes para usar sin internet
    className: "vista-aerea",
    ...OPCIONES_RAPIDAS,
    ...(limites ? { bounds: limites } : {}),
    attribution: "Esri, Maxar, Earthstar Geographics",
  });

  const probados = new Map<string, number>();
  const revisar = async () => {
    if (m.getZoom() + extra <= NIVEL_SEGURO) return;
    const { lat, lng } = m.getCenter();
    const n = 2 ** NIVEL_MAXIMO;
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
    const clave = `${x >> 3},${y >> 3}`; // un resultado cada ~1 km
    let nivel = probados.get(clave);
    if (nivel === undefined) {
      try {
        const r = await fetch(ESRI_SAT.replace("{z}", String(NIVEL_MAXIMO)).replace("{y}", String(y)).replace("{x}", String(x)));
        const bytes = (await r.blob()).size;
        nivel = r.ok && bytes !== BYTES_CARTEL_GRIS && bytes > 0 ? NIVEL_MAXIMO : NIVEL_SEGURO;
      } catch {
        nivel = NIVEL_SEGURO;
      }
      probados.set(clave, nivel);
    }
    if (capa.options.maxNativeZoom !== nivel - extra) {
      capa.options.maxNativeZoom = nivel - extra;
      capa.redraw();
    }
  };
  m.on("moveend", revisar);
  return capa;
}

// ---------- Itapúa: el mapa muestra SOLO el departamento ----------
const MARGEN = 0.12; // grados de aire alrededor del departamento

/** Límites [lat, lon] de Itapúa con un poco de margen (para encuadrar y para no pedir imágenes de afuera). */
export function limitesItapua(L: typeof import("leaflet")): LatLngBounds {
  const [lo1, la1, lo2, la2] = ITAPUA_BBOX;
  return L.latLngBounds([la1 - MARGEN, lo1 - MARGEN], [la2 + MARGEN, lo2 + MARGEN]);
}

/**
 * Deja el mapa limitado a Itapúa:
 * - contorno del departamento (negro con un filete blanco, para que se vea sobre selva oscura y sobre campo claro);
 * - todo lo de afuera tapado con un color liso (no distrae y no hace falta descargarlo);
 * - no se puede arrastrar ni alejar el mapa más allá del departamento.
 * Devuelve los límites y una función para encuadrar todo Itapúa.
 */
export function marcoItapua(L: typeof import("leaflet"), m: LMap): { limites: LatLngBounds; verTodo: (animado?: boolean) => void; contorno: Polygon } {
  const limites = limitesItapua(L);
  const anillo = ITAPUA_ANILLO.map(([lon, lat]) => [lat, lon] as [number, number]);
  const [lo1, la1, lo2, la2] = ITAPUA_BBOX;
  const G = 8; // el tapado llega bien lejos; igual no se puede salir de los límites
  const afuera: [number, number][] = [[la1 - G, lo1 - G], [la1 - G, lo2 + G], [la2 + G, lo2 + G], [la2 + G, lo1 - G]];

  // Capas propias: el tapado va por encima de las imágenes, de las capas de datos y de los nombres; el contorno, encima del tapado.
  // (por encima también de los nombres de lugares y de los dibujos: 400; por debajo de los marcadores: 600)
  m.createPane("tapado").style.zIndex = "450";
  m.createPane("contorno").style.zIndex = "460";
  for (const p of ["tapado", "contorno"]) m.getPane(p)!.style.pointerEvents = "none";
  const estilo = getComputedStyle(document.documentElement);
  const colorTapado = estilo.getPropertyValue("--mapa-afuera").trim() || "#e7ebe4";
  L.polygon([afuera, anillo], { pane: "tapado", stroke: false, fillColor: colorTapado, fillOpacity: 1, interactive: false }).addTo(m);
  L.polygon(anillo, { pane: "contorno", color: "#ffffff", weight: 5, opacity: 0.9, fill: false, interactive: false }).addTo(m);
  const contorno = L.polygon(anillo, { pane: "contorno", color: "#111611", weight: 2.4, opacity: 1, fill: false, interactive: false }).addTo(m);

  m.setMaxBounds(limites);
  m.options.maxBoundsViscosity = 1;
  const ajustarMinimo = () => m.setMinZoom(Math.max(6, m.getBoundsZoom(limites, false) - 0.5));
  ajustarMinimo();
  m.on("resize", ajustarMinimo);
  const verTodo = (animado = false) => m.fitBounds(L.latLngBounds(anillo), { padding: [14, 14], animate: animado });
  return { limites, verTodo, contorno };
}
