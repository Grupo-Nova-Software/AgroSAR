"use client";
// Mapa del clima (Leaflet), sobre la vista aérea Esri para reconocer la chacra.
// - Capa de clima: la grilla de pronóstico de /api/clima/mapa interpolada y coloreada (7 capas agrícolas).
// - Línea de tiempo: 48 h en pasos de 3 h o 14 días, con botón de reproducir.
// - Pin: al tocar el mapa muestra temperatura, lluvia, viento y humedad del aire en ese punto y momento.
// - Capas de apoyo: zonas de análisis, mi chacra (la marcada en «Mi suelo»), radar NISAR y puntos de referencia.
// Leaflet maneja el <div> del mapa: React NUNCA le cambia las clases.
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageOverlay, LayerGroup, Map as LMap, Marker, TileLayer } from "leaflet";
import type { SerieHumedad } from "@/types/contratos";
import type { GrillaClima, RespuestaClima } from "@/lib/clima/tipos";
import { CAPAS, cssColor, degradado, ESCALAS, interpolar, pintarCapa, posicionEnEscala, prepararCampos, type CapaId, type Modo } from "./escalas";
import { useChacras } from "../chacras";
import { capaAerea, ESRI_NOMBRES } from "../mapaBase";
import { useClimaTextos, type ClaveClima } from "./textos";
import { animarViento } from "./viento";

const VACIO = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

type Apoyo = "limites" | "chacra" | "nisar" | "nodos" | "nombres" | "viento";
interface IndiceMapa { bbox: [number, number, number, number]; fechas: string[] }

const token = (nombre: string) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

export default function MapaClima({
  grilla,
  errorGrilla,
  areas,
  areaId,
  datos,
  punto,
  alElegirPunto,
}: {
  grilla: GrillaClima | null;
  errorGrilla: boolean;
  areas: SerieHumedad[];
  areaId: string;
  datos: RespuestaClima | null;
  /** Punto que tocó el usuario; null = centro de la zona. */
  punto: { lat: number; lon: number } | null;
  alElegirPunto: (lat: number, lon: number) => void;
}) {
  const { tc, n, diaCorto, rumbo, fecha } = useClimaTextos();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const capas = useRef<{ zonas: LayerGroup; chacra: LayerGroup; nisar: LayerGroup; nodos: LayerGroup; nombres: TileLayer; clima: ImageOverlay } | null>(null);
  const pin = useRef<Marker | null>(null);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const lienzoViento = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  const [capa, setCapa] = useState<CapaId>("lluvia");
  const [modo, setModo] = useState<Modo>("h");
  const [paso, setPaso] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [apoyo, setApoyo] = useState<Record<Apoyo, boolean>>({ limites: true, chacra: true, nisar: false, nodos: true, nombres: true, viento: true });
  const [panel, setPanel] = useState(false);
  const { chacras } = useChacras();
  const [indiceNisar, setIndiceNisar] = useState<IndiceMapa | null>(null);

  const vivo = useRef({ alElegirPunto });
  useEffect(() => {
    vivo.current = { alElegirPunto };
  });

  const campos = useMemo(() => (grilla ? prepararCampos(grilla) : null), [grilla]);
  const pasos = grilla ? (modo === "h" ? grilla.horas.length : grilla.dias.length) : 0;
  const pasoActual = Math.min(paso, Math.max(0, pasos - 1));
  const escala = ESCALAS[capa][modo];
  const valores = campos?.[capa][modo][pasoActual] ?? null;
  const momento = grilla ? (modo === "h" ? grilla.horas[pasoActual] : grilla.dias[pasoActual]) : null;
  const rotuloMomento = (m: string) => (m.length > 10 ? `${diaCorto(m)} · ${m.slice(11, 16)}` : diaCorto(m));

  // La imagen NISAR por fecha se busca recién al encender la capa (puede no estar publicada todavía).
  useEffect(() => {
    if (!apoyo.nisar || indiceNisar) return;
    fetch("/data/mapa_humedad/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setIndiceNisar)
      .catch(() => {});
  }, [apoyo.nisar, indiceNisar]);

  // ---------- Crear el mapa (una sola vez) ----------
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      LRef.current = L;
      const m = L.map(contenedor.current, { maxZoom: 19, zoomControl: true });
      m.createPane("clima").style.zIndex = "350";
      m.getPane("clima")!.style.pointerEvents = "none";
      capaAerea(L, m).addTo(m);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);
      capas.current = {
        clima: L.imageOverlay(VACIO, [[-27.61, -57.05], [-26.09, -54.64]], { opacity: 0.72, pane: "clima", attribution: "Open-Meteo (CC BY 4.0)" }).addTo(m),
        nombres: L.tileLayer(ESRI_NOMBRES, { maxNativeZoom: 17, maxZoom: 19, crossOrigin: true, updateWhenIdle: true, keepBuffer: 1, pane: "overlayPane" }),
        zonas: L.layerGroup().addTo(m),
        nisar: L.layerGroup().addTo(m),
        chacra: L.layerGroup().addTo(m),
        nodos: L.layerGroup().addTo(m),
      };
      m.setView([-26.9, -55.4], 9);
      m.on("click", (e) => vivo.current.alElegirPunto(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4))));
      mapa.current = m;
      setListo(true);
    })();
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      capas.current = null;
      pin.current = null;
      setListo(false);
    };
  }, []);

  // ---------- Zonas de análisis: contorno; al cambiar de zona el mapa va hacia ella ----------
  useEffect(() => {
    const L = LRef.current;
    const c = capas.current;
    if (!listo || !L || !c) return;
    c.zonas.clearLayers();
    if (!apoyo.limites) return;
    for (const a of areas) {
      const [lo1, la1, lo2, la2] = a.bbox;
      const sel = a.id === areaId;
      L.rectangle([[la1, lo1], [la2, lo2]], { color: "#ffffff", weight: sel ? 3.5 : 1.5, dashArray: sel ? undefined : "6 6", opacity: sel ? 1 : 0.8, fill: false, interactive: false })
        .addTo(c.zonas);
    }
  }, [listo, areas, areaId, apoyo.limites]);

  useEffect(() => {
    const L = LRef.current;
    const m = mapa.current;
    const a = areas.find((x) => x.id === areaId);
    if (!listo || !L || !m || !a) return;
    const [lo1, la1, lo2, la2] = a.bbox;
    m.fitBounds([[la1, lo1], [la2, lo2]], { padding: [70, 70], maxZoom: 11 });
  }, [listo, areas, areaId]);

  useEffect(() => {
    const c = capas.current;
    const m = mapa.current;
    if (!listo || !c || !m) return;
    if (apoyo.nombres) c.nombres.addTo(m);
    else c.nombres.remove();
  }, [listo, apoyo.nombres]);

  // ---------- Mi chacra ----------
  useEffect(() => {
    const L = LRef.current;
    const c = capas.current;
    if (!listo || !L || !c) return;
    c.chacra.clearLayers();
    if (!apoyo.chacra) return;
    for (const ch of chacras)
      L.polygon(ch.vertices.map(([lon, lat]) => [lat, lon] as [number, number]), { color: ch.color, weight: 4, fillColor: ch.color, fillOpacity: 0.15, interactive: false })
        .bindTooltip(ch.nombre, { permanent: true, direction: "center", className: "etiqueta-chacra" })
        .addTo(c.chacra);
  }, [listo, apoyo.chacra, chacras]);

  // ---------- Viento en movimiento (rayitas que siguen al viento del momento elegido) ----------
  const hayViento = modo === "h" && !!grilla?.h.dir_grados;
  useEffect(() => {
    const m = mapa.current;
    const cv = lienzoViento.current;
    const dir = grilla?.h.dir_grados?.[pasoActual];
    const vel = grilla?.h.viento_kmh[pasoActual];
    if (!listo || !m || !cv || !grilla || !apoyo.viento || modo !== "h" || !dir || !vel) return;
    return animarViento(m, cv, grilla, vel, dir);
  }, [listo, grilla, apoyo.viento, modo, pasoActual]);

  // ---------- Radar NISAR: imagen de la última pasada (si existe) + valor medio de cada zona ----------
  useEffect(() => {
    const L = LRef.current;
    const c = capas.current;
    if (!listo || !L || !c) return;
    c.nisar.clearLayers();
    if (!apoyo.nisar) return;
    const ultimaFecha = indiceNisar?.fechas.at(-1);
    if (indiceNisar && ultimaFecha) {
      const [lo1, la1, lo2, la2] = indiceNisar.bbox;
      L.imageOverlay(`/data/mapa_humedad/${ultimaFecha}.png`, [[la1, lo1], [la2, lo2]], { opacity: 0.65, pane: "clima", attribution: "NISAR (NASA-ISRO)" }).addTo(c.nisar);
    }
    for (const a of areas) {
      const ultima = a.serie.filter((p) => typeof p.humedad_m3m3 === "number").at(-1);
      if (!ultima) continue;
      const [lo1, la1, lo2, la2] = a.bbox;
      const h = ultima.humedad_m3m3!;
      const color = token(h < 0.2 ? "--agua-seco" : h < 0.35 ? "--agua-bueno" : "--agua-mojado") || "#3f9d57";
      L.rectangle([[la1, lo1], [la2, lo2]], { color, weight: 2, fillColor: color, fillOpacity: ultimaFecha ? 0 : 0.35, interactive: false })
        .bindTooltip(tc("nisarZona", { v: n(h, 2), dia: fecha(ultima.fecha) }), { permanent: true, direction: "center", className: "etiqueta-zona" })
        .addTo(c.nisar);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tc/n/fecha cambian con el idioma, que ya recrea los textos
  }, [listo, apoyo.nisar, areas, indiceNisar]);

  // ---------- Capa de clima: se repinta al cambiar la capa o el momento ----------
  useEffect(() => {
    const c = capas.current;
    if (!listo || !c) return;
    if (!grilla || !valores) {
      c.clima.setUrl(VACIO);
      return;
    }
    lienzo.current ??= document.createElement("canvas");
    const [lo1, la1, lo2, la2] = grilla.bbox;
    c.clima.setBounds([[la1, lo1], [la2, lo2]] as never);
    c.clima.setUrl(pintarCapa(lienzo.current, valores, grilla, escala));
  }, [listo, grilla, valores, escala]);

  // ---------- Puntos de referencia: círculo con el color de la capa y su valor ----------
  useEffect(() => {
    const L = LRef.current;
    const c = capas.current;
    if (!listo || !L || !c) return;
    c.nodos.clearLayers();
    if (!apoyo.nodos || !grilla) return;
    const base = grilla.nx * grilla.ny;
    grilla.nodos.forEach((nodo, i) => {
      const v = valores?.[base + i];
      L.circleMarker([nodo.lat, nodo.lon], { radius: 8, color: "#ffffff", weight: 2.5, fillColor: typeof v === "number" ? cssColor(v, escala.paradas) : "#888", fillOpacity: 1 })
        .bindTooltip(`<b>${nodo.nombre}</b><br>${typeof v === "number" ? `${n(v, 1)} ${escala.unidad}` : "–"}<br><small>${tc("nodoNota")}</small>`, { direction: "top", className: "etiqueta-zona" })
        .on("click", (e) => L.DomEvent.stopPropagation(e))
        .addTo(c.nodos);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tc/n cambian con el idioma; `valores` ya cambia con la capa y el momento
  }, [listo, apoyo.nodos, grilla, valores, escala]);

  // ---------- Pin del punto elegido (o del centro de la zona) ----------
  const latPin = punto?.lat ?? datos?.punto.lat ?? null;
  const lonPin = punto?.lon ?? datos?.punto.lon ?? null;
  const posPin = useMemo(() => (latPin !== null && lonPin !== null ? { lat: latPin, lon: lonPin } : null), [latPin, lonPin]);
  const lecturaPin = useMemo(() => {
    if (!posPin || !momento) return null;
    const delPunto = datos && Math.abs(datos.punto.lat - posPin.lat) < 0.006 && Math.abs(datos.punto.lon - posPin.lon) < 0.006;
    const enGrilla = (c: CapaId | "hr" | "rafaga") => {
      if (!grilla || !campos) return null;
      const fila = c === "hr" ? grilla.h.hr_pct[pasoActual] : c === "rafaga" ? grilla.h.rafaga_kmh[pasoActual] : campos[c][modo][pasoActual];
      return fila ? interpolar(fila, grilla, posPin.lat, posPin.lon) : null;
    };
    if (modo === "h") {
      const i = delPunto ? datos.horario.findIndex((h) => h.t === momento) : -1;
      if (delPunto && i >= 0) {
        const h = datos.horario[i];
        const mm3 = datos.horario.slice(i, i + 3).reduce((s, x) => s + (x.mm ?? 0), 0);
        return { exacto: true, temp: h.temp_c, mm: mm3, viento: h.viento_kmh, rafaga: h.rafaga_kmh, dir: h.dir_grados, hr: h.hr_pct, tmin: null as number | null };
      }
      return { exacto: false, temp: enGrilla("temperatura"), mm: enGrilla("lluvia"), viento: enGrilla("viento"), rafaga: enGrilla("rafaga"), dir: null, hr: enGrilla("hr"), tmin: null };
    }
    const d = delPunto ? datos.diario.find((x) => x.fecha === momento) : undefined;
    if (d) return { exacto: true, temp: d.tmax_c, mm: d.mm, viento: d.viento_max_kmh, rafaga: null, dir: null, hr: null, tmin: d.tmin_c };
    return { exacto: false, temp: enGrilla("temperatura"), mm: enGrilla("lluvia"), viento: enGrilla("viento"), rafaga: null, dir: null, hr: null, tmin: enGrilla("helada") };
  }, [posPin, momento, datos, grilla, campos, modo, pasoActual]);

  useEffect(() => {
    const L = LRef.current;
    const m = mapa.current;
    if (!listo || !L || !m) return;
    if (!posPin) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    const l = lecturaPin;
    const fila = (rotulo: string, valor: string) => `<div class="flex justify-between gap-3"><span class="opacity-75">${rotulo}</span><b>${valor}</b></div>`;
    const cuerpo = l
      ? (modo === "h"
          ? fila(tc("pinTemp"), `${n(l.temp, 0)} °C`) + fila(tc("pinLluvia"), `${n(l.mm, 1)} mm`) +
            fila(tc("pinViento"), `${n(l.viento, 0)} km/h ${rumbo(l.dir)}`) + fila(tc("pinHumedad"), `${n(l.hr, 0)} %`)
          : fila(tc("pinMaxMin"), `${n(l.temp, 0)} / ${n(l.tmin, 0)} °C`) + fila(tc("pinLluvia"), `${n(l.mm, 1)} mm`) + fila(tc("pinViento"), `${n(l.viento, 0)} km/h`))
      : `<div class="opacity-75">…</div>`;
    const html = `
      <div class="pointer-events-none flex flex-col items-center" style="transform: translate(-50%, -100%); width: max-content">
        <div class="rounded-xl border-2 border-[#d9a441] bg-[#101613]/92 px-3 py-2 text-[13px] leading-snug text-white shadow-lg" style="min-width: 9.5rem">
          <div class="mb-0.5 text-[11px] opacity-75">${posPin.lat.toFixed(3)}, ${posPin.lon.toFixed(3)}${momento ? ` · ${rotuloMomento(momento)}` : ""}</div>
          ${cuerpo}
        </div>
        <div style="width: 3px; height: 16px; background: #d9a441"></div>
        <div style="width: 12px; height: 12px; border-radius: 9999px; background: #d9a441; border: 2px solid #fff; margin-top: -2px"></div>
      </div>`;
    const icono = L.divIcon({ className: "", html, iconSize: [0, 0], iconAnchor: [0, -5] });
    if (pin.current) pin.current.setLatLng([posPin.lat, posPin.lon]).setIcon(icono);
    else pin.current = L.marker([posPin.lat, posPin.lon], { icon: icono, interactive: false, zIndexOffset: 800 }).addTo(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- los textos dependen del idioma, que cambia `lecturaPin` vía momento/rotulo
  }, [listo, posPin, lecturaPin, momento, modo]);

  // ---------- Reproducir ----------
  useEffect(() => {
    if (!reproduciendo || pasos < 2) return;
    const id = window.setInterval(() => setPaso((p) => (p + 1) % pasos), 900);
    return () => window.clearInterval(id);
  }, [reproduciendo, pasos]);

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setPaso(0);
  };
  const apoyos: { id: Apoyo; clave: ClaveClima; deshabilitado?: boolean }[] = [
    { id: "limites", clave: "capaLimites" },
    { id: "chacra", clave: chacras.length ? "capaChacra" : "capaChacraSin", deshabilitado: !chacras.length },
    { id: "viento", clave: "capaVientoVivo", deshabilitado: !hayViento },
    { id: "nisar", clave: "capaNisar" },
    { id: "nodos", clave: "capaNodos" },
    { id: "nombres", clave: "capaNombres" },
  ];
  const min = escala.paradas[0][0];
  const max = escala.paradas[escala.paradas.length - 1][0];
  const marcasTiempo = grilla ? (modo === "h" ? grilla.horas : grilla.dias) : [];
  const cadaCuanto = modo === "h" ? 4 : 2;

  return (
    <div>
      <div className="relative">
        {/* El div que maneja Leaflet: clases fijas, nunca cambian */}
        <div ref={contenedor} className="h-[68svh] min-h-[26rem] w-full md:h-[36rem] md:rounded-t-3xl" aria-label={tc("mapaTitulo")} />
        {/* Viento en movimiento: se dibuja encima del mapa y no recibe toques */}
        <canvas ref={lienzoViento} aria-hidden className={`pointer-events-none absolute inset-0 z-[1000] h-full w-full ${apoyo.viento && hayViento ? "" : "hidden"}`} />

        {/* Capas de apoyo (izquierda, plegable) */}
        <div className="absolute left-14 top-3 z-[1100]">
          <button
            type="button"
            onClick={() => setPanel((v) => !v)}
            aria-expanded={panel}
            className="flex h-10 items-center gap-2 rounded-full bg-barra px-4 text-sm font-bold text-texto shadow-suave backdrop-blur"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
              <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
            </svg>
            {tc("capasBase")}
          </button>
          {panel && (
            <fieldset className="mt-2 w-64 rounded-2xl bg-barra p-3 text-sm font-bold text-texto shadow-suave backdrop-blur">
              <legend className="sr-only">{tc("capasBase")}</legend>
              {apoyos.map((a) => (
                <label key={a.id} className={`flex min-h-9 items-center gap-2 ${a.deshabilitado ? "opacity-55" : ""}`}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--primario)]"
                    checked={apoyo[a.id] && !a.deshabilitado}
                    disabled={a.deshabilitado}
                    onChange={(e) => setApoyo((v) => ({ ...v, [a.id]: e.target.checked }))}
                  />
                  {tc(a.clave)}
                </label>
              ))}
            </fieldset>
          )}
        </div>

        {/* Capas de clima (derecha): íconos en el celular, ícono + nombre en pantallas grandes */}
        <div role="radiogroup" aria-label={tc("capaClima")} className="absolute right-2 top-3 z-[1100] flex flex-col gap-1.5">
          {CAPAS.map((c) => {
            const activa = c.id === capa;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={activa}
                aria-label={tc(`capa_${c.id}`)}
                title={tc(`capa_${c.id}`)}
                onClick={() => setCapa(c.id)}
                className={`flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-bold shadow-suave backdrop-blur md:px-3.5 ${
                  activa ? "bg-primario text-sobre-primario" : "bg-barra text-texto"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">{c.icono}</span>
                <span className="hidden md:inline">{tc(`capa_${c.id}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Leyenda de la capa activa */}
        <div className="absolute bottom-3 right-2 z-[1100] w-[min(15rem,calc(100%-7rem))] rounded-2xl bg-barra p-2.5 shadow-suave backdrop-blur">
          <p className="text-sm font-bold leading-tight text-texto">
            {tc(`capa_${capa}`)} <span className="font-normal text-texto-suave">· {escala.unidad}</span>
          </p>
          <p className="text-xs leading-tight text-texto-suave">{tc(`desc_${capa}_${modo}`)}</p>
          <div className="mt-1.5 h-3 rounded-full border border-borde" style={{ background: degradado(escala) }} />
          <div className="relative mt-0.5 h-4 text-xs font-bold text-texto-suave">
            {escala.marcas.map((m) => (
              <span
                key={m}
                className="absolute"
                style={{ left: `${posicionEnEscala(m, escala)}%`, transform: m === min ? undefined : m === max ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {errorGrilla && (
          <p role="alert" className="absolute inset-x-3 top-16 z-[1100] mx-auto max-w-md rounded-2xl bg-black/80 px-4 py-3 text-center text-sm font-bold text-white">
            {tc("mapaSinGrilla")}
          </p>
        )}
      </div>

      {/* Línea de tiempo, pegada al mapa */}
      <div className="border-x border-b border-borde bg-tarjeta px-3 py-3 md:rounded-b-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReproduciendo((v) => !v)}
            disabled={pasos < 2}
            aria-pressed={reproduciendo}
            className="flex h-11 items-center gap-2 rounded-full bg-primario px-4 text-base font-bold text-sobre-primario disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              {reproduciendo ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
            </svg>
            {reproduciendo ? tc("pausar") : tc("reproducir")}
          </button>
          <div role="group" aria-label={tc("momento")} className="flex rounded-full border-2 border-borde p-0.5">
            {(["h", "d"] as Modo[]).map((mo) => (
              <button
                key={mo}
                type="button"
                aria-pressed={modo === mo}
                onClick={() => cambiarModo(mo)}
                className={`h-9 rounded-full px-3.5 text-sm font-bold ${modo === mo ? "bg-tarjeta-2 text-acento" : "text-texto-suave"}`}
              >
                {tc(mo === "h" ? "h48" : "d14")}
              </button>
            ))}
          </div>
          <p className="ml-auto text-lg font-bold text-texto" aria-live="polite">
            {momento ? (modo === "h" && pasoActual === 0 ? `${tc("ahora")} · ${momento.slice(11, 16)}` : rotuloMomento(momento)) : "–"}
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, pasos - 1)}
          step={1}
          value={pasoActual}
          disabled={pasos < 2}
          onChange={(e) => {
            setReproduciendo(false);
            setPaso(Number(e.target.value));
          }}
          aria-label={tc("momento")}
          aria-valuetext={momento ? rotuloMomento(momento) : undefined}
          className="mt-3 h-6 w-full accent-[var(--primario)]"
        />
        <div className="relative h-5 text-xs font-bold text-texto-suave" aria-hidden>
          {marcasTiempo.map((m, i) =>
            i % cadaCuanto === 0 ? (
              <span
                key={m}
                className="absolute whitespace-nowrap"
                style={{ left: `${(i / Math.max(1, pasos - 1)) * 100}%`, transform: i === 0 ? undefined : i >= pasos - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {modo === "h" ? `${m.slice(11, 13)} h` : diaCorto(m)}
              </span>
            ) : null,
          )}
        </div>
        <p className="mt-1 text-xs leading-snug text-texto-suave">
          {tc("mapaAyuda")} {grilla ? tc("modelo", { km: grilla.paso_km_aprox }) : ""}
        </p>
      </div>
    </div>
  );
}
