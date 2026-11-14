"use client";
// Mapa de campo (Leaflet) con vista aérea.
// - Base: Esri World Imagery (satélite) + capa opcional de nombres de lugares; alternativa "Calles" (OSM).
// - Capa "Agua en el suelo": imagen NISAR SME2 por fecha (public/data/mapa_humedad), con flechas para cambiar de pasada.
// - Punto azul con la ubicación del usuario y botón para volver a ella.
// - Marcar la chacra: se tocan las esquinas en cualquier orden (se acomodan solas), se pueden arrastrar y deshacer.
// - Zonas de análisis: contorno; al tocar una, se elige.
// Leaflet maneja el <div> del mapa: React NUNCA le cambia las clases (si no, el mapa pierde sus estilos y queda liso).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, ImageOverlay, LayerGroup, Map as LMap, Marker, Rectangle } from "leaflet";
import type { EstadoRecomendacion, SerieHumedad } from "@/types/contratos";
import { useIdioma } from "../idioma";
import { dentroDe, hectareasDe, insertarEsquina, type LonLat } from "./api";

const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_NOMBRES = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ITAPUA: [number, number, number, number] = [-57.05, -27.61, -54.64, -26.09];

const colorDe = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#287d45";
const TOKEN_ESTADO: Record<EstadoRecomendacion, string> = { sembrar: "--primario", esperar: "--dorado", precaucion: "--peligro" };

interface IndiceMapa { bbox: [number, number, number, number]; fechas: string[]; escala: { color: string }[] }

export default function MapaCampo({
  areas,
  estados,
  seleccionada,
  alSeleccionar,
  chacra,
  alCambiarChacra,
  alUbicar,
}: {
  areas: SerieHumedad[];
  estados: Record<string, EstadoRecomendacion | undefined>;
  seleccionada: string;
  alSeleccionar: (id: string) => void;
  chacra: LonLat[] | null;
  alCambiarChacra: (v: LonLat[] | null) => void;
  alUbicar?: (p: LonLat) => void;
}) {
  const { t, fecha, idioma } = useIdioma();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const rects = useRef<Record<string, Rectangle>>({});
  const capaChacra = useRef<LayerGroup | null>(null);
  const capaHumedad = useRef<ImageOverlay | null>(null);
  const ubic = useRef<{ punto: Marker; circulo: Circle; pos: LonLat } | null>(null);
  const [listo, setListo] = useState(false);

  const [dibujando, setDibujando] = useState(false);
  const [vertices, setVertices] = useState<LonLat[]>([]);
  const historial = useRef<LonLat[][]>([]);
  const [indice, setIndice] = useState<IndiceMapa | null>(null);
  const [verHumedad, setVerHumedad] = useState(true);
  const [iFecha, setIFecha] = useState(-1); // -1 = la última
  const [avisoUbic, setAvisoUbic] = useState(false);

  // Valores que los manejadores de Leaflet necesitan leer "al día"
  const vivo = useRef({ dibujando, vertices, chacra, alSeleccionar, alUbicar });
  useEffect(() => {
    vivo.current = { dibujando, vertices, chacra, alSeleccionar, alUbicar };
  });

  useEffect(() => {
    fetch("/data/mapa_humedad/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setIndice)
      .catch(() => {});
  }, []);

  // ---------- Crear el mapa ----------
  useEffect(() => {
    let cancelado = false;
    let vigilancia: number | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      LRef.current = L;
      const m = L.map(contenedor.current, { maxZoom: 19, zoomControl: true });
      m.createPane("humedad").style.zIndex = "350";

      const satelite = L.tileLayer(ESRI_SAT, { maxNativeZoom: 18, maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" }).addTo(m);
      const calles = L.tileLayer(OSM, { maxZoom: 19, attribution: "&copy; OpenStreetMap" });
      const nombres = L.tileLayer(ESRI_NOMBRES, { maxNativeZoom: 18, maxZoom: 19, pane: "overlayPane" }).addTo(m);
      L.control.layers({ [t("capaSatelite")]: satelite, [t("capaCalles")]: calles }, { [t("capaNombres")]: nombres }, { position: "topright" }).addTo(m);
      L.control.scale({ imperial: false, position: "bottomright" }).addTo(m);

      // Zonas: primero las más grandes, para que las chicas queden arriba y se puedan tocar
      const tam = (a: SerieHumedad) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
      const grupo: Rectangle[] = [];
      for (const a of [...areas].sort((x, y) => tam(y) - tam(x))) {
        const [lo1, la1, lo2, la2] = a.bbox;
        const r = L.rectangle([[la1, lo1], [la2, lo2]], { fillOpacity: 0.01 })
          .addTo(m)
          .bindTooltip(a.zona, { direction: "top", sticky: true, className: "etiqueta-zona" })
          .on("click", () => {
            if (!vivo.current.dibujando) vivo.current.alSeleccionar(a.id);
          });
        rects.current[a.id] = r;
        grupo.push(r);
      }
      capaChacra.current = L.layerGroup().addTo(m);

      const guardada = vivo.current.chacra;
      if (guardada && guardada.length >= 3) m.fitBounds(L.latLngBounds(guardada.map(([lon, lat]) => [lat, lon] as [number, number])), { padding: [60, 60], maxZoom: 17 });
      else if (grupo.length) m.fitBounds(L.featureGroup(grupo).getBounds(), { padding: [10, 10] });
      else m.setView([-26.9, -55.4], 9);

      // Tocar el mapa en modo dibujo = agregar una esquina
      m.on("click", (e) => {
        if (!vivo.current.dibujando) return;
        const cerca = vivo.current.vertices.some(([lon, lat]) => m.latLngToContainerPoint([lat, lon]).distanceTo(e.containerPoint) < 16);
        if (cerca) return; // doble toque sobre una esquina que ya existe
        const p: LonLat = [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))];
        historial.current.push(vivo.current.vertices);
        setVertices(insertarEsquina(vivo.current.vertices, p));
      });

      // Ubicación del usuario: punto azul. La primera vez, si está en Itapúa y no tiene chacra guardada, el mapa va ahí.
      let primera = true;
      if ("geolocation" in navigator) {
        vigilancia = navigator.geolocation.watchPosition(
          (g) => {
            const pos: LonLat = [g.coords.longitude, g.coords.latitude];
            const ll: [number, number] = [pos[1], pos[0]];
            if (!ubic.current) {
              const circulo = L.circle(ll, { radius: g.coords.accuracy, color: "#2b7fff", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m);
              const punto = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="punto-ubicacion"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: 500 }).addTo(m);
              ubic.current = { punto, circulo, pos };
            } else {
              ubic.current.punto.setLatLng(ll);
              ubic.current.circulo.setLatLng(ll).setRadius(g.coords.accuracy);
              ubic.current.pos = pos;
            }
            if (primera) {
              primera = false;
              if (dentroDe(pos, ITAPUA)) {
                if (!vivo.current.chacra && !vivo.current.dibujando) m.setView(ll, 15);
                vivo.current.alUbicar?.(pos);
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
        );
      }

      mapa.current = m;
      setListo(true);
    })();
    return () => {
      cancelado = true;
      if (vigilancia !== undefined) navigator.geolocation.clearWatch(vigilancia);
      mapa.current?.remove();
      mapa.current = null;
      rects.current = {};
      capaHumedad.current = null;
      ubic.current = null;
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se recrea solo si cambian las áreas o el idioma (nombres de las capas)
  }, [areas, idioma]);

  // ---------- Contorno de las zonas ----------
  useEffect(() => {
    if (!listo) return;
    for (const [id, r] of Object.entries(rects.current)) {
      const sel = id === seleccionada;
      const estado = estados[id];
      r.setStyle(
        sel
          ? { color: estado ? colorDe(TOKEN_ESTADO[estado]) : "#ffffff", weight: 4, dashArray: undefined, opacity: 1 }
          : { color: "#ffffff", weight: 1.5, dashArray: "6 6", opacity: 0.8 },
      );
    }
  }, [listo, estados, seleccionada]);

  // ---------- Capa de agua en el suelo (NISAR) ----------
  const fechas = indice?.fechas ?? [];
  const fechaSel = fechas.length ? fechas[iFecha < 0 ? fechas.length - 1 : Math.min(iFecha, fechas.length - 1)] : null;
  useEffect(() => {
    const L = LRef.current;
    const m = mapa.current;
    if (!listo || !L || !m) return;
    const mostrar = verHumedad && !dibujando && indice && fechaSel;
    if (!mostrar) {
      capaHumedad.current?.remove();
      capaHumedad.current = null;
      return;
    }
    const url = `/data/mapa_humedad/${fechaSel}.png`;
    if (capaHumedad.current) capaHumedad.current.setUrl(url);
    else {
      const [lo1, la1, lo2, la2] = indice.bbox;
      capaHumedad.current = L.imageOverlay(url, [[la1, lo1], [la2, lo2]], { opacity: 0.62, pane: "humedad", attribution: "NISAR (NASA-ISRO)" }).addTo(m);
    }
  }, [listo, verHumedad, dibujando, indice, fechaSel]);

  // ---------- Dibujo de la chacra ----------
  useEffect(() => {
    const L = LRef.current;
    const capa = capaChacra.current;
    if (!listo || !L || !capa) return;
    capa.clearLayers();
    const pts = dibujando ? vertices : (chacra ?? []);
    if (!pts.length) return;
    const ll = (v: LonLat[]) => v.map(([lon, lat]) => [lat, lon] as [number, number]);
    const primario = colorDe("--primario");
    const estilo = { color: "#ffffff", weight: 4, fillColor: primario, fillOpacity: dibujando ? 0.18 : 0.12, dashArray: dibujando ? "8 8" : undefined, interactive: false };
    const forma = pts.length >= 3 ? L.polygon(ll(pts), estilo) : L.polyline(ll(pts), estilo);
    forma.addTo(capa);
    if (!dibujando) return;

    // Esquinas arrastrables: durante el arrastre se mueve la figura; al soltar se guarda.
    const copia = pts.map((p) => [...p] as LonLat);
    pts.forEach((p, i) => {
      const marcador = L.marker([p[1], p[0]], {
        draggable: true,
        icon: L.divIcon({ className: "", html: '<div class="esquina-chacra"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(capa);
      marcador.on("drag", () => {
        const { lat, lng } = marcador.getLatLng();
        copia[i] = [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
        forma.setLatLngs(ll(copia));
      });
      marcador.on("dragend", () => {
        historial.current.push(pts);
        setVertices(copia.map((c) => [...c] as LonLat));
      });
    });
  }, [listo, dibujando, vertices, chacra]);

  // ---------- Acciones ----------
  const empezar = () => {
    historial.current = [];
    setVertices(chacra ?? []);
    setDibujando(true);
  };
  const terminar = () => {
    if (vertices.length < 3) return;
    setDibujando(false);
    alCambiarChacra(vertices);
  };
  const deshacer = () => {
    const previo = historial.current.pop();
    if (previo) setVertices(previo);
  };
  const borrar = () => {
    historial.current = [];
    setVertices([]);
    if (!dibujando) alCambiarChacra(null);
  };
  const irAMiUbicacion = () => {
    const m = mapa.current;
    if (!m) return;
    if (ubic.current) {
      m.setView([ubic.current.pos[1], ubic.current.pos[0]], Math.max(m.getZoom(), 16));
      return;
    }
    const fallo = () => {
      setAvisoUbic(true);
      setTimeout(() => setAvisoUbic(false), 6000);
    };
    if (!("geolocation" in navigator)) return fallo();
    navigator.geolocation.getCurrentPosition((g) => m.setView([g.coords.latitude, g.coords.longitude], 16), fallo, { enableHighAccuracy: true, timeout: 15_000 });
  };
  const moverFecha = (d: number) => {
    if (!fechas.length) return;
    const actual = iFecha < 0 ? fechas.length - 1 : iFecha;
    setIFecha(Math.max(0, Math.min(fechas.length - 1, actual + d)));
  };

  const ha = hectareasDe(vertices);
  const num = (n: number) => n.toLocaleString(idioma === "es" ? "es-PY" : "en-US", { maximumFractionDigits: n < 10 ? 1 : 0 });
  const degradado = indice ? `linear-gradient(90deg, ${indice.escala.map((e) => e.color).join(", ")})` : undefined;
  const iActual = iFecha < 0 ? fechas.length - 1 : iFecha;
  const botonChico = "grid h-10 w-10 place-items-center rounded-full bg-barra text-xl font-bold text-texto shadow-suave backdrop-blur disabled:opacity-35";

  return (
    <div>
      <div className="relative">
        {/* El div que maneja Leaflet: clases fijas, nunca cambian */}
        <div ref={contenedor} className="h-[62svh] min-h-[22rem] w-full md:h-[34rem] md:rounded-3xl" aria-label={t("capaSatelite")} />

        {dibujando && (
          <p className="pointer-events-none absolute inset-x-3 top-3 z-[1100] mx-auto max-w-md rounded-2xl bg-black/75 px-4 py-3 text-center text-base font-bold text-white">
            {vertices.length === 0 ? t("ayudaDibujo0") : t("ayudaDibujoN")}
          </p>
        )}

        {/* Mi ubicación */}
        <button
          type="button"
          onClick={irAMiUbicacion}
          aria-label={t("miUbicacion")}
          title={t("miUbicacion")}
          className="absolute right-3 top-20 z-[1100] grid h-12 w-12 place-items-center rounded-full bg-white text-[#2b7fff] shadow-lg"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.5" fill="currentColor" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
          </svg>
        </button>
        {avisoUbic && (
          <p role="alert" className="absolute inset-x-3 top-36 z-[1100] mx-auto max-w-md rounded-2xl bg-black/80 px-4 py-3 text-center text-sm font-bold text-white">
            {t("sinUbicacion")}
          </p>
        )}

        {/* Agua en el suelo: encender/apagar, leyenda y fecha de la pasada */}
        {!dibujando && indice && fechaSel && (
          <div className="absolute bottom-3 left-3 z-[1100] w-[min(17rem,calc(100%-5.5rem))] rounded-2xl bg-barra p-2.5 shadow-suave backdrop-blur">
            <button
              type="button"
              role="switch"
              aria-checked={verHumedad}
              onClick={() => setVerHumedad((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left text-base font-bold text-texto"
            >
              <span>💧 {t("verHumedad")}</span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${verHumedad ? "bg-primario" : "bg-borde"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${verHumedad ? "left-[1.35rem]" : "left-0.5"}`} />
              </span>
            </button>
            {verHumedad && (
              <>
                <div className="mt-2 h-3 rounded-full" style={{ background: degradado }} />
                <div className="mt-0.5 flex justify-between text-xs font-bold text-texto-suave">
                  <span>{t("seco")}</span>
                  <span>{t("bueno")}</span>
                  <span>{t("mojado")}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <button type="button" onClick={() => moverFecha(-1)} disabled={iActual <= 0} aria-label={t("anterior")} className={botonChico}>
                    ‹
                  </button>
                  <span className="text-center text-sm font-bold leading-tight text-texto" aria-live="polite">
                    {t("pasadaDel")} {fecha(fechaSel, true)}
                  </span>
                  <button type="button" onClick={() => moverFecha(1)} disabled={iActual >= fechas.length - 1} aria-label={t("siguiente")} className={botonChico}>
                    ›
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Botones grandes debajo del mapa */}
      <div className="flex flex-wrap gap-2 px-3 pt-3 md:px-0">
        {!dibujando ? (
          <>
            <button type="button" onClick={empezar} className="h-14 flex-1 rounded-2xl bg-primario px-5 text-lg font-bold text-sobre-primario shadow-suave hover:bg-primario-hover">
              ✏️ {chacra ? t("cambiarChacra") : t("marcarChacra")}
            </button>
            {chacra && (
              <button type="button" onClick={borrar} className="h-14 rounded-2xl border-2 border-borde bg-tarjeta px-5 text-lg font-bold text-texto">
                ✕ {t("borrar")}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={deshacer} disabled={!vertices.length} className="h-14 rounded-2xl border-2 border-borde bg-tarjeta px-4 text-base font-bold text-texto disabled:opacity-40">
              ↶ {t("deshacer")}
            </button>
            <button type="button" onClick={borrar} disabled={!vertices.length} className="h-14 rounded-2xl border-2 border-borde bg-tarjeta px-4 text-base font-bold text-texto disabled:opacity-40">
              ✕ {t("borrar")}
            </button>
            <button type="button" onClick={terminar} disabled={vertices.length < 3} className="h-14 flex-1 rounded-2xl bg-primario px-5 text-lg font-bold text-sobre-primario shadow-suave disabled:opacity-40">
              ✓ {t("listo")}
              {vertices.length >= 3 ? ` · ${num(ha)} ${t("ha")}` : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
