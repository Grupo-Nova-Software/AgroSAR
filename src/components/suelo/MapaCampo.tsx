"use client";
// Mapa de campo (Leaflet) con vista aérea.
// - Base: Esri World Imagery (satélite) + capa opcional de nombres de lugares; alternativa "Calles" (OSM).
// - Capa "Agua en el suelo": imagen NISAR SME2 por fecha (public/data/mapa_humedad), con flechas para cambiar de pasada.
// - Abre mirando DONDE ESTÁ EL USUARIO (última ubicación guardada + GPS). Botones grandes para ir a: mi ubicación,
//   las zonas con datos del satélite y mis chacras.
// - Varias chacras, cada una con su color y su nombre. Se marcan tocando las esquinas en cualquier orden
//   (se acomodan solas), se pueden arrastrar y deshacer.
// Leaflet maneja el <div> del mapa: React NUNCA le cambia las clases (si no, el mapa pierde sus estilos y queda liso).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, LayerGroup, Map as LMap, Marker, Rectangle } from "leaflet";
import type { EstadoRecomendacion, SerieHumedad } from "@/types/contratos";
import { guardarUbicacion, leerUltimaUbicacion, type Chacra } from "../chacras";
import Icono from "../Icono";
import { useIdioma } from "../idioma";
import { capaAerea, ESRI_NOMBRES } from "../mapaBase";
import { hectareasDe, insertarEsquina, type LonLat } from "./api";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const colorDe = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#287d45";
const TOKEN_ESTADO: Record<EstadoRecomendacion, string> = { sembrar: "--primario", esperar: "--dorado", precaucion: "--peligro" };
const ll = (v: LonLat[]) => v.map(([lon, lat]) => [lat, lon] as [number, number]);

export default function MapaCampo({
  areas,
  estados,
  seleccionada,
  alSeleccionar,
  chacras,
  chacraSel,
  alElegirChacra,
  alGuardarChacra,
  dibujarAlAbrir = false,
  alUbicar,
}: {
  areas: SerieHumedad[];
  estados: Record<string, EstadoRecomendacion | undefined>;
  seleccionada: string;
  alSeleccionar: (id: string) => void;
  chacras: Chacra[];
  chacraSel: string | null;
  alElegirChacra: (id: string) => void;
  alGuardarChacra: (vertices: LonLat[], editandoId: string | null) => void;
  dibujarAlAbrir?: boolean;
  alUbicar?: (p: LonLat) => void;
}) {
  const { t, idioma } = useIdioma();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const rects = useRef<Record<string, Rectangle>>({});
  const capaChacras = useRef<LayerGroup | null>(null);
  const capaDibujo = useRef<LayerGroup | null>(null);
  const ubic = useRef<{ punto: Marker; circulo: Circle; pos: LonLat } | null>(null);
  const [listo, setListo] = useState(false);

  const [dibujando, setDibujando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vertices, setVertices] = useState<LonLat[]>([]);
  const historial = useRef<LonLat[][]>([]);
  const [avisoUbic, setAvisoUbic] = useState(false);

  // Valores que los manejadores de Leaflet necesitan leer "al día"
  const vivo = useRef({ dibujando, vertices, alSeleccionar, alElegirChacra, alUbicar, chacraSel });
  useEffect(() => {
    vivo.current = { dibujando, vertices, alSeleccionar, alElegirChacra, alUbicar, chacraSel };
  });

  // ---------- Crear el mapa ----------
  useEffect(() => {
    let cancelado = false;
    let vigilancia: number | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      LRef.current = L;
      const m = L.map(contenedor.current, { maxZoom: 19, zoomControl: false });
      L.control.zoom({ position: "bottomright" }).addTo(m);

      // crossOrigin: las teselas se piden con CORS, así el service worker puede guardarlas para usar sin internet
      const satelite = capaAerea(L, m).addTo(m);
      const calles = L.tileLayer(OSM, { maxZoom: 19, crossOrigin: true, updateWhenIdle: true, keepBuffer: 1, attribution: "&copy; OpenStreetMap" });
      const nombres = L.tileLayer(ESRI_NOMBRES, { maxNativeZoom: 17, maxZoom: 19, crossOrigin: true, updateWhenIdle: true, keepBuffer: 1, pane: "overlayPane" }).addTo(m);
      L.control.layers({ [t("capaSatelite")]: satelite, [t("capaCalles")]: calles }, { [t("capaNombres")]: nombres }, { position: "topright" }).addTo(m);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);

      // Zonas con datos: primero las más grandes, para que las chicas queden arriba y se puedan tocar
      const tam = (a: SerieHumedad) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
      for (const a of [...areas].sort((x, y) => tam(y) - tam(x))) {
        const [lo1, la1, lo2, la2] = a.bbox;
        rects.current[a.id] = L.rectangle([[la1, lo1], [la2, lo2]], { fillOpacity: 0.01 })
          .addTo(m)
          .bindTooltip(a.zona, { direction: "top", sticky: true, className: "etiqueta-zona" })
          .on("click", () => {
            if (!vivo.current.dibujando) vivo.current.alSeleccionar(a.id);
          });
      }
      capaChacras.current = L.layerGroup().addTo(m);
      capaDibujo.current = L.layerGroup().addTo(m);

      // Vista inicial: la chacra pedida > donde está el usuario (última ubicación conocida) > las zonas
      const sel = chacras.find((c) => c.id === vivo.current.chacraSel);
      const ultima = leerUltimaUbicacion();
      if (sel) m.fitBounds(L.latLngBounds(ll(sel.vertices)), { padding: [50, 50], maxZoom: 17 });
      else if (ultima) m.setView([ultima[1], ultima[0]], 15);
      else irAZonas(m);

      // Tocar el mapa en modo dibujo = agregar una esquina
      m.on("click", (e) => {
        if (!vivo.current.dibujando) return;
        const cerca = vivo.current.vertices.some(([lon, lat]) => m.latLngToContainerPoint([lat, lon]).distanceTo(e.containerPoint) < 16);
        if (cerca) return; // doble toque sobre una esquina que ya existe
        const p: LonLat = [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))];
        historial.current.push(vivo.current.vertices);
        setVertices(insertarEsquina(vivo.current.vertices, p));
      });

      // Ubicación del usuario: punto azul. La primera vez, el mapa se centra ahí (salvo que se pidió una chacra).
      let primera = true;
      if ("geolocation" in navigator) {
        vigilancia = navigator.geolocation.watchPosition(
          (g) => {
            const pos: LonLat = [g.coords.longitude, g.coords.latitude];
            const p: [number, number] = [pos[1], pos[0]];
            if (!ubic.current) {
              const circulo = L.circle(p, { radius: g.coords.accuracy, color: "#2b7fff", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m);
              const punto = L.marker(p, {
                icon: L.divIcon({ className: "", html: '<div class="punto-ubicacion"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
                interactive: false,
                zIndexOffset: 500,
              }).addTo(m);
              ubic.current = { punto, circulo, pos };
            } else {
              ubic.current.punto.setLatLng(p);
              ubic.current.circulo.setLatLng(p).setRadius(g.coords.accuracy);
              ubic.current.pos = pos;
            }
            guardarUbicacion(pos);
            if (primera) {
              primera = false;
              if (!vivo.current.chacraSel && !vivo.current.dibujando) m.setView(p, Math.max(m.getZoom(), 15));
              vivo.current.alUbicar?.(pos);
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
        );
      }

      mapa.current = m;
      setListo(true);
      if (dibujarAlAbrir) setDibujando(true);
    })();
    return () => {
      cancelado = true;
      if (vigilancia !== undefined) navigator.geolocation.clearWatch(vigilancia);
      mapa.current?.remove();
      mapa.current = null;
      rects.current = {};
      ubic.current = null;
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se recrea solo si cambian las áreas o el idioma (nombres de las capas)
  }, [areas, idioma]);

  function irAZonas(m = mapa.current) {
    const L = LRef.current;
    if (!m || !L) return;
    const r = Object.values(rects.current);
    if (r.length) m.fitBounds(L.featureGroup(r).getBounds(), { padding: [12, 12] });
    else m.setView([-26.9, -55.4], 9);
  }
  function irAChacras() {
    const m = mapa.current;
    const L = LRef.current;
    if (!m || !L || !chacras.length) return;
    m.fitBounds(L.latLngBounds(chacras.flatMap((c) => ll(c.vertices))), { padding: [50, 50], maxZoom: 17 });
  }

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

  // ---------- Chacras guardadas (color y nombre propios) ----------
  useEffect(() => {
    const L = LRef.current;
    const capa = capaChacras.current;
    if (!listo || !L || !capa) return;
    capa.clearLayers();
    for (const c of chacras) {
      if (dibujando && c.id === editandoId) continue; // se está redibujando
      const sel = c.id === chacraSel;
      L.polygon(ll(c.vertices), {
        color: c.color,
        weight: sel ? 5 : 3,
        fillColor: c.color,
        fillOpacity: sel ? 0.32 : 0.18,
      })
        .bindTooltip(c.nombre, { permanent: true, direction: "center", className: "etiqueta-chacra" })
        .on("click", () => {
          if (!vivo.current.dibujando) vivo.current.alElegirChacra(c.id);
        })
        .addTo(capa);
    }
  }, [listo, chacras, chacraSel, dibujando, editandoId]);

  // Ir a la chacra elegida desde afuera del mapa (lista, menú)
  const anteriorSel = useRef(chacraSel);
  useEffect(() => {
    const m = mapa.current;
    const L = LRef.current;
    if (!listo || !m || !L || !chacraSel || chacraSel === anteriorSel.current) return;
    anteriorSel.current = chacraSel;
    const c = chacras.find((x) => x.id === chacraSel);
    if (c) m.flyToBounds(L.latLngBounds(ll(c.vertices)), { padding: [50, 50], maxZoom: 17, duration: 0.8 });
  }, [listo, chacraSel, chacras]);

  // ---------- Dibujo de una chacra (nueva o cambiando la forma) ----------
  useEffect(() => {
    const L = LRef.current;
    const capa = capaDibujo.current;
    if (!listo || !L || !capa) return;
    capa.clearLayers();
    if (!dibujando || !vertices.length) return;
    const estilo = { color: "#ffffff", weight: 4, fillColor: colorDe("--primario"), fillOpacity: 0.2, dashArray: "8 8", interactive: false };
    const forma = vertices.length >= 3 ? L.polygon(ll(vertices), estilo) : L.polyline(ll(vertices), estilo);
    forma.addTo(capa);

    // Esquinas arrastrables: durante el arrastre se mueve la figura; al soltar se guarda.
    const copia = vertices.map((p) => [...p] as LonLat);
    vertices.forEach((p, i) => {
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
        historial.current.push(vertices);
        setVertices(copia.map((c) => [...c] as LonLat));
      });
    });
  }, [listo, dibujando, vertices]);

  // ---------- Acciones ----------
  const empezarNueva = () => {
    historial.current = [];
    setEditandoId(null);
    setVertices([]);
    setDibujando(true);
  };
  const cambiarForma = () => {
    const c = chacras.find((x) => x.id === chacraSel);
    if (!c) return;
    historial.current = [];
    setEditandoId(c.id);
    setVertices(c.vertices);
    setDibujando(true);
  };
  const terminar = () => {
    if (vertices.length < 3) return;
    setDibujando(false);
    alGuardarChacra(vertices, editandoId);
    setEditandoId(null);
    setVertices([]);
  };
  const cancelar = () => {
    setDibujando(false);
    setEditandoId(null);
    setVertices([]);
  };
  const deshacer = () => {
    const previo = historial.current.pop();
    if (previo) setVertices(previo);
  };
  const irAMiUbicacion = () => {
    const m = mapa.current;
    if (!m) return;
    if (ubic.current) {
      m.flyTo([ubic.current.pos[1], ubic.current.pos[0]], Math.max(m.getZoom(), 16), { duration: 0.8 });
      return;
    }
    const fallo = () => {
      setAvisoUbic(true);
      setTimeout(() => setAvisoUbic(false), 6000);
    };
    if (!("geolocation" in navigator)) return fallo();
    navigator.geolocation.getCurrentPosition((g) => m.flyTo([g.coords.latitude, g.coords.longitude], 16, { duration: 0.8 }), fallo, {
      enableHighAccuracy: true,
      timeout: 15_000,
    });
  };
  const ha = hectareasDe(vertices);
  const num = (n: number) => n.toLocaleString(idioma === "es" ? "es-PY" : "en-US", { maximumFractionDigits: n < 10 ? 1 : 0 });
  const chip = "flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[15px] font-bold text-[#1e2420] shadow-lg";

  return (
    <div>
      <div className="relative">
        {/* El div que maneja Leaflet: clases fijas, nunca cambian */}
        <div ref={contenedor} className="h-[62svh] min-h-[22rem] w-full md:h-[34rem] md:rounded-2xl" aria-label={t("capaSatelite")} />

        {/* Ir a… (arriba, botones grandes) */}
        {!dibujando && (
          <div className="absolute left-2 right-14 top-2 z-[1100] flex flex-wrap gap-1.5">
            <button type="button" onClick={irAMiUbicacion} className={chip}>
              <span className="punto-ubicacion !h-3.5 !w-3.5 !border-2" aria-hidden />
              {t("dondeEstoy")}
            </button>
            <button type="button" onClick={() => irAZonas()} className={chip}>
              <Icono nombre="satelite" /> {t("zonasConDatos")}
            </button>
            {chacras.length > 0 && (
              <button type="button" onClick={irAChacras} className={chip}>
                <Icono nombre="chacra" /> {t("navChacras")}
              </button>
            )}
          </div>
        )}

        {dibujando && (
          <p className="pointer-events-none absolute inset-x-3 top-3 z-[1100] mx-auto max-w-md rounded-xl bg-black/80 px-4 py-3 text-center text-base font-bold text-white">
            {vertices.length === 0 ? t("ayudaDibujo0") : t("ayudaDibujoN")}
          </p>
        )}
        {avisoUbic && (
          <p role="alert" className="absolute inset-x-3 top-16 z-[1100] mx-auto max-w-md rounded-xl bg-black/85 px-4 py-3 text-center text-sm font-bold text-white">
            {t("sinUbicacion")}
          </p>
        )}

      </div>

      {/* Botones grandes debajo del mapa */}
      <div className="flex flex-wrap gap-2 px-3 pt-3 md:px-0">
        {!dibujando ? (
          <>
            <button type="button" onClick={empezarNueva} className="h-14 flex-1 rounded-xl bg-primario px-5 text-lg font-bold text-sobre-primario shadow-suave hover:bg-primario-hover">
              <Icono nombre="mas" className="mr-1.5 h-6 w-6 align-[-5px]" />
              {chacras.length ? t("agregarOtra") : t("marcarChacra")}
            </button>
            {chacraSel && (
              <button type="button" onClick={cambiarForma} className="h-14 rounded-xl border-2 border-borde bg-tarjeta px-4 text-base font-bold text-texto">
                <Icono nombre="lapiz" className="mr-1.5 h-5 w-5 align-[-4px]" />
                {t("cambiarForma")}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={deshacer} disabled={!vertices.length} className="h-14 rounded-xl border-2 border-borde bg-tarjeta px-4 text-base font-bold text-texto disabled:opacity-40">
              ↶ {t("deshacer")}
            </button>
            <button type="button" onClick={cancelar} className="h-14 rounded-xl border-2 border-borde bg-tarjeta px-4 text-base font-bold text-texto">
              {t("cancelar")}
            </button>
            <button type="button" onClick={terminar} disabled={vertices.length < 3} className="h-14 flex-1 rounded-xl bg-primario px-5 text-lg font-bold text-sobre-primario shadow-suave disabled:opacity-40">
              <Icono nombre="check" className="mr-1.5 h-6 w-6 align-[-5px]" />
              {t("guardar")}
              {vertices.length >= 3 ? ` · ${num(ha)} ${t("ha")}` : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
