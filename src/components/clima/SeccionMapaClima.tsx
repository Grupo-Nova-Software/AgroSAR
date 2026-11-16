"use client";
// El mapa del clima de todo Itapúa, dentro de la pantalla Clima.
// Para no hacer pesada la apertura en el teléfono, el mapa (Leaflet + la grilla de pronóstico) se descarga recién
// cuando esta sección está por entrar en la pantalla.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GrillaClima, RespuestaClima } from "@/lib/clima/tipos";
import { useClimaTextos } from "./textos";

const ALTO = "h-[68svh] min-h-[26rem] w-full md:h-[36rem]";
// Leaflet usa `window`: el mapa se carga solo en el navegador.
const MapaClima = dynamic(() => import("./MapaClima"), { ssr: false, loading: () => <div className={`${ALTO} animate-pulse bg-tarjeta-2 md:rounded-2xl`} /> });

export default function SeccionMapaClima({
  datos,
  punto,
  alElegirPunto,
  alPedirUbicacion,
}: {
  datos: RespuestaClima | null;
  punto: { lat: number; lon: number } | null;
  alElegirPunto: (lat: number, lon: number) => void;
  alPedirUbicacion: () => void;
}) {
  const { tc, idioma } = useClimaTextos();
  const caja = useRef<HTMLElement>(null);
  const [cerca, setCerca] = useState(false);
  const [grilla, setGrilla] = useState<GrillaClima | null>(null);
  const [errorGrilla, setErrorGrilla] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el || cerca) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cerca]);

  useEffect(() => {
    if (!cerca) return;
    fetch("/api/clima/mapa")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setGrilla)
      .catch(() => setErrorGrilla(true));
  }, [cerca]);

  return (
    <section ref={caja} aria-labelledby="mapa-clima" className="md:px-8">
      <div className="sobre-fondo mx-3 mb-2 rounded-xl px-4 py-2.5 md:mx-0">
        <h2 id="mapa-clima" className="font-display text-xl font-bold leading-tight">
          {idioma === "es" ? "Mapa del clima de Itapúa" : "Itapúa weather map"}
        </h2>
        <p className="text-sm text-texto-suave">{tc("mapaAyuda")}</p>
      </div>
      {cerca ? (
        <MapaClima grilla={grilla} errorGrilla={errorGrilla} datos={datos} punto={punto} alElegirPunto={alElegirPunto} alPedirUbicacion={alPedirUbicacion} />
      ) : (
        <div className={`${ALTO} bg-tarjeta-2 md:rounded-2xl`} />
      )}
    </section>
  );
}
