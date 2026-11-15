"use client";
// Datos avanzados del clima: se cargan recién cuando el usuario los pide (así la pantalla simple abre rápido
// en teléfonos lentos): las 4 tarjetas con números, el mapa del clima, hora por hora, balance de agua y la campaña.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { SerieHumedad } from "@/types/contratos";
import type { GrillaClima, RespuestaClima } from "@/lib/clima/tipos";
import BalanceHidrico from "./BalanceHidrico";
import DetalleHorario from "./DetalleHorario";
import Perspectiva from "./Perspectiva";
import Tarjetas from "./Tarjetas";
import { useClimaTextos } from "./textos";

// Leaflet usa `window`: el mapa se carga solo en el navegador.
const MapaClima = dynamic(() => import("./MapaClima"), {
  ssr: false,
  loading: () => <div className="h-[68svh] min-h-[26rem] w-full animate-pulse bg-tarjeta-2 md:h-[36rem] md:rounded-2xl" />,
});

export default function ClimaAvanzado({
  datos,
  areas,
  areaId,
  punto,
  alElegirPunto,
}: {
  datos: RespuestaClima;
  areas: SerieHumedad[];
  areaId: string;
  punto: { lat: number; lon: number } | null;
  alElegirPunto: (lat: number, lon: number) => void;
}) {
  const { tc, fecha } = useClimaTextos();
  const [grilla, setGrilla] = useState<GrillaClima | null>(null);
  const [errorGrilla, setErrorGrilla] = useState(false);

  useEffect(() => {
    fetch("/api/clima/mapa")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setGrilla)
      .catch(() => setErrorGrilla(true));
  }, []);

  return (
    <div className="space-y-4">
      <div className="px-3 md:px-8">
        <Tarjetas datos={datos} />
      </div>

      {/* El mapa ocupa todo el ancho en el celular */}
      <section className="md:px-8" aria-label={tc("mapaTitulo")}>
        <MapaClima grilla={grilla} errorGrilla={errorGrilla} areas={areas} areaId={areaId} datos={datos} punto={punto} alElegirPunto={alElegirPunto} />
      </section>

      <div className="space-y-4 px-3 md:px-8">
        <DetalleHorario datos={datos} />
        <BalanceHidrico datos={datos} />
        <Perspectiva datos={datos} />

        <section className="rounded-2xl border border-borde bg-tarjeta p-4">
          <h2 className="font-display text-2xl font-bold">{tc("nodosTitulo")}</h2>
          <p className="mt-1 text-base leading-snug">{tc("nodosTexto")}</p>
          {grilla && (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {grilla.nodos.map((nodo) => (
                <li key={nodo.id} className="rounded-full border border-borde bg-fondo px-3 py-1">
                  {nodo.nombre} <span className="text-texto-suave">({nodo.lat.toFixed(2)}, {nodo.lon.toFixed(2)})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="rounded-2xl border border-borde bg-tarjeta p-4 text-sm leading-relaxed text-texto-suave">
          <h2 className="text-base font-bold text-texto">{tc("fuentesTitulo")}</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {datos.fuentes.map((f) => (
              <li key={f}>{f}</li>
            ))}
            <li>{tc("fuenteMapa")}</li>
          </ul>
          {datos.estado_fuentes.nasa_power.hasta && <p className="mt-2">{tc("powerHasta", { dia: fecha(datos.estado_fuentes.nasa_power.hasta, true) })}</p>}
          <p className="mt-2 font-bold text-texto">{tc("aviso")}</p>
        </footer>
      </div>
    </div>
  );
}
