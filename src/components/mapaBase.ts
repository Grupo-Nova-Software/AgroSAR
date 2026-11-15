// Vista aérea compartida por los mapas (Esri World Imagery: la de mejor detalle que se puede usar sin clave).
// - Pantallas de buena densidad y conexión normal: pide las imágenes un nivel más detallado (se ven nítidas).
// - Conexión lenta o «ahorro de datos»: imágenes normales, 4 veces menos descarga.
// - Esri no tiene el mismo detalle en todos lados: en el campo suele llegar a nivel 17 y en algunos lugares a 18.
//   Si se pide un nivel que no existe devuelve un cartel gris («Map data not yet available»). Para no mostrarlo,
//   se prueba una imagen del lugar y se usa el nivel real que haya (verificado el 15-nov-2026 en las 5 zonas).
import type { Map as LMap, TileLayer } from "leaflet";

export const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_NOMBRES = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const BYTES_CARTEL_GRIS = 2521; // tamaño exacto del cartel «sin datos» de Esri
const NIVEL_SEGURO = 17;
const NIVEL_MAXIMO = 18;

/** ¿Conviene gastar pocos datos? (ahorro de datos activado o red 2G/3G) */
export function conexionLenta(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)(2g|3g)$/.test(c.effectiveType ?? ""));
}

export function capaAerea(L: typeof import("leaflet"), m: LMap): TileLayer {
  const nitida = window.devicePixelRatio >= 1.5 && !conexionLenta();
  const extra = nitida ? 1 : 0;
  const capa = L.tileLayer(ESRI_SAT, {
    maxNativeZoom: NIVEL_SEGURO - extra,
    maxZoom: 19,
    tileSize: nitida ? 128 : 256,
    zoomOffset: extra,
    crossOrigin: true, // con CORS el service worker puede guardar las imágenes para usar sin internet
    className: "vista-aerea",
    updateWhenIdle: true,
    keepBuffer: 1,
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
