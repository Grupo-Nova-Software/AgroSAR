"use client";
// Mapa de campo (Leaflet) con vista aérea, limitado a ITAPÚA.
// - Solo se ve el departamento: contorno marcado, lo de afuera tapado y sin poder salir de sus límites
//   (así tampoco se descargan imágenes de afuera: el mapa abre y se mueve más rápido).
// - Base: Esri World Imagery (satélite) + capa opcional de nombres de lugares; alternativa "Calles" (OSM).
// - Ubicación del usuario con su margen de error (ver ../ubicacion.ts): el mapa solo se centra solo cuando es de GPS.
// - Varias chacras, cada una con su color y su nombre. Se marcan tocando las esquinas en cualquier orden
//   (se acomodan solas), se pueden arrastrar y deshacer. No se puede marcar fuera de Itapúa.
// Leaflet maneja el <div> del mapa: React NUNCA le cambia las clases (si no, el mapa pierde sus estilos y queda liso).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, LayerGroup, Map as LMap, Marker } from "leaflet";
import { dentroDeItapua } from "@/lib/itapua";
import { type Chacra } from "../chacras";
import Icono from "../Icono";
import { useIdioma } from "../idioma";
import { capaAerea, ESRI_NOMBRES, marcoItapua, OPCIONES_RAPIDAS } from "../mapaBase";
import { leerUltimaUbicacion, reintentarUbicacion, textoPrecision, useUbicacion } from "../ubicacion";
import { hectareasDe, insertarEsquina, type LonLat } from "./api";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Tamaño máximo de una chacra (el mismo tope que usa el servidor en /api/lote). */
const HA_MAX = 10_000;

const colorDe = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#287d45";
const ll = (v: LonLat[]) => v.map(([lon, lat]) => [lat, lon] as [number, number]);

export default function MapaCampo({
  chacras,
  chacraSel,
  alElegirChacra,
  alGuardarChacra,
  dibujarAlAbrir = false,
}: {
  chacras: Chacra[];
  chacraSel: string | null;
  alElegirChacra: (id: string) => void;
  alGuardarChacra: (vertices: LonLat[], editandoId: string | null) => void;
  dibujarAlAbrir?: boolean;
}) {
  const { t, idioma } = useIdioma();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const verTodoRef = useRef<(animado?: boolean) => void>(() => {});
  const capaChacras = useRef<LayerGroup | null>(null);
  const capaDibujo = useRef<LayerGroup | null>(null);
  const marcaUbic = useRef<{ punto: Marker; circulo: Circle } | null>(null);
  const [listo, setListo] = useState(false);

  const [dibujando, setDibujando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vertices, setVertices] = useState<LonLat[]>([]);
  const historial = useRef<LonLat[][]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const relojAviso = useRef<number | undefined>(undefined);
  const avisar = (texto: string, ms = 6000) => {
    setAviso(texto);
    window.clearTimeout(relojAviso.current);
    relojAviso.current = window.setTimeout(() => setAviso(null), ms);
  };

  const { ubic, estado: estadoUbic } = useUbicacion();
  /** El usuario ya movió el mapa con el dedo: no se lo vuelve a centrar solo. */
  const tocado = useRef(false);
  const centradoSolo = useRef(false);

  // Valores que los manejadores de Leaflet necesitan leer "al día"
  const vivo = useRef({ dibujando, vertices, alElegirChacra, chacraSel, t });
  useEffect(() => {
    vivo.current = { dibujando, vertices, alElegirChacra, chacraSel, t };
  });

  // ---------- Crear el mapa ----------
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      LRef.current = L;
      const m = L.map(contenedor.current, { maxZoom: 19, zoomControl: false });
      L.control.zoom({ position: "bottomright" }).addTo(m);
      const { limites, verTodo } = marcoItapua(L, m);
      verTodoRef.current = verTodo;

      // crossOrigin: las teselas se piden con CORS, así el service worker puede guardarlas para usar sin internet.
      // bounds: no se piden imágenes de fuera de Itapúa.
      const satelite = capaAerea(L, m, limites).addTo(m);
      const calles = L.tileLayer(OSM, { maxZoom: 19, crossOrigin: true, ...OPCIONES_RAPIDAS, bounds: limites, attribution: "&copy; OpenStreetMap" });
      const nombres = L.tileLayer(ESRI_NOMBRES, { maxNativeZoom: 17, maxZoom: 19, crossOrigin: true, ...OPCIONES_RAPIDAS, bounds: limites, pane: "overlayPane" }).addTo(m);
      L.control.layers({ [t("capaSatelite")]: satelite, [t("capaCalles")]: calles }, { [t("capaNombres")]: nombres }, { position: "topright" }).addTo(m);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);

      capaChacras.current = L.layerGroup().addTo(m);
      capaDibujo.current = L.layerGroup().addTo(m);

      // Vista inicial: la chacra pedida > la última ubicación de GPS guardada > todo Itapúa
      const sel = chacras.find((c) => c.id === vivo.current.chacraSel);
      const ultima = leerUltimaUbicacion();
      if (sel) m.fitBounds(L.latLngBounds(ll(sel.vertices)), { padding: [50, 50], maxZoom: 17 });
      else if (ultima) m.setView([ultima[1], ultima[0]], 15);
      else verTodo();

      const alTocar = () => {
        tocado.current = true;
      };
      for (const ev of ["pointerdown", "wheel", "touchstart"]) contenedor.current.addEventListener(ev, alTocar, { passive: true });

      // Tocar el mapa en modo dibujo = agregar una esquina (solo dentro de Itapúa)
      m.on("click", (e) => {
        if (!vivo.current.dibujando) return;
        const cerca = vivo.current.vertices.some(([lon, lat]) => m.latLngToContainerPoint([lat, lon]).distanceTo(e.containerPoint) < 16);
        if (cerca) return; // doble toque sobre una esquina que ya existe
        if (!dentroDeItapua(e.latlng.lng, e.latlng.lat)) {
          avisar(vivo.current.t("fueraItapua"));
          return;
        }
        const p: LonLat = [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))];
        historial.current.push(vivo.current.vertices);
        setVertices(insertarEsquina(vivo.current.vertices, p));
      });

      mapa.current = m;
      setListo(true);
      if (dibujarAlAbrir) setDibujando(true);
    })();
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      marcaUbic.current = null;
      setListo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se recrea solo si cambia el idioma (nombres de las capas)
  }, [idioma]);

  function irAChacras() {
    const m = mapa.current;
    const L = LRef.current;
    if (!m || !L || !chacras.length) return;
    m.fitBounds(L.latLngBounds(chacras.flatMap((c) => ll(c.vertices))), { padding: [50, 50], maxZoom: 17 });
  }

  // ---------- Ubicación del usuario: punto azul + círculo con el margen de error ----------
  useEffect(() => {
    const L = LRef.current;
    const m = mapa.current;
    if (!listo || !L || !m) return;
    if (!ubic || !ubic.enItapua) {
      marcaUbic.current?.punto.remove();
      marcaUbic.current?.circulo.remove();
      marcaUbic.current = null;
      return;
    }
    const p: [number, number] = [ubic.pos[1], ubic.pos[0]];
    const html = `<div class="punto-ubicacion${ubic.precisa ? "" : " aprox"}"></div>`;
    const icono = L.divIcon({ className: "", html, iconSize: [18, 18], iconAnchor: [9, 9] });
    if (!marcaUbic.current) {
      const circulo = L.circle(p, { radius: ubic.precision_m, color: "#2b7fff", weight: 1.5, fillOpacity: 0.1, interactive: false }).addTo(m);
      const punto = L.marker(p, { icon: icono, interactive: false, zIndexOffset: 500 }).addTo(m);
      marcaUbic.current = { punto, circulo };
    } else {
      marcaUbic.current.punto.setLatLng(p).setIcon(icono);
      marcaUbic.current.circulo.setLatLng(p).setRadius(ubic.precision_m);
    }
    marcaUbic.current.circulo.setStyle({ dashArray: ubic.precisa ? undefined : "6 6" });
    // El mapa se centra solo UNA vez, y solo con una ubicación de GPS (si es aproximada no se confía en ella).
    if (ubic.precisa && !centradoSolo.current && !tocado.current && !vivo.current.chacraSel && !vivo.current.dibujando) {
      centradoSolo.current = true;
      m.setView(p, Math.max(m.getZoom(), 16));
    }
  }, [listo, ubic]);

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
        if (!dentroDeItapua(copia[i][0], copia[i][1])) {
          avisar(t("fueraItapua"));
          setVertices(vertices.map((c) => [...c] as LonLat)); // la esquina vuelve a donde estaba
          return;
        }
        historial.current.push(vertices);
        setVertices(copia.map((c) => [...c] as LonLat));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` y `avisar` cambian en cada render; no hace falta redibujar por eso
  }, [listo, dibujando, vertices]);

  const haActual = hectareasDe(vertices);
  const demasiadoGrande = haActual > HA_MAX;

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
    if (vertices.length < 3 || demasiadoGrande) return;
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
    const L = LRef.current;
    if (!m || !L) return;
    tocado.current = true;
    if (!ubic) {
      if (estadoUbic === "denegada") avisar(t("ubicDenegada"), 9000);
      else if (estadoUbic === "sin_soporte" || estadoUbic === "error") avisar(t("sinUbicacion"), 9000);
      else avisar(t("ubicBuscando"));
      if (estadoUbic !== "buscando") reintentarUbicacion();
      return;
    }
    if (!ubic.enItapua) {
      avisar(t("ubicFuera"), 9000);
      verTodoRef.current(true);
      return;
    }
    const p: [number, number] = [ubic.pos[1], ubic.pos[0]];
    if (ubic.precisa) {
      m.flyTo(p, Math.max(m.getZoom(), 17), { duration: 0.8 });
      return;
    }
    // Aproximada: se muestra toda la zona posible (el círculo), no un punto exacto que puede estar mal.
    avisar(t("ubicAprox", { margen: textoPrecision(ubic.precision_m) }), 11000);
    m.flyToBounds(L.latLng(p).toBounds(Math.max(ubic.precision_m * 2, 600)), { padding: [30, 30], maxZoom: 15, duration: 0.8 });
  };
  const ha = haActual;
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
              <span className={`punto-ubicacion !h-3.5 !w-3.5 !border-2 ${ubic && !ubic.precisa ? "aprox" : ""} ${estadoUbic === "buscando" && !ubic ? "animate-pulse" : ""}`} aria-hidden />
              {t("dondeEstoy")}
            </button>
            <button type="button" onClick={() => verTodoRef.current(true)} className={chip}>
              <Icono nombre="mapa" /> {t("verItapua")}
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
            {demasiadoGrande ? t("chacraMuyGrande") : vertices.length === 0 ? t("ayudaDibujo0") : t("ayudaDibujoN")}
          </p>
        )}
        {aviso && (
          <p role="alert" className="absolute inset-x-3 top-16 z-[1100] mx-auto max-w-md rounded-xl bg-black/85 px-4 py-3 text-center text-sm font-bold leading-snug text-white">
            {aviso}
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
            <button type="button" onClick={terminar} disabled={vertices.length < 3 || demasiadoGrande} className="h-14 flex-1 rounded-xl bg-primario px-5 text-lg font-bold text-sobre-primario shadow-suave disabled:opacity-40">
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
