"use client";
// Datos avanzados del clima: se cargan recién cuando el usuario los pide (así la pantalla abre rápido en teléfonos
// lentos): las 4 tarjetas con números, hora por hora, balance de agua y los próximos meses de la campaña.
// El mapa del clima ya no está acá: es parte de la pantalla (SeccionMapaClima.tsx).
import type { RespuestaClima } from "@/lib/clima/tipos";
import BalanceHidrico from "./BalanceHidrico";
import DetalleHorario from "./DetalleHorario";
import Perspectiva from "./Perspectiva";
import Tarjetas from "./Tarjetas";
import { useClimaTextos } from "./textos";

export default function ClimaAvanzado({ datos }: { datos: RespuestaClima }) {
  const { tc, fecha } = useClimaTextos();
  return (
    <div className="space-y-4 px-3 md:px-8">
      <Tarjetas datos={datos} />
      <DetalleHorario datos={datos} />
      <BalanceHidrico datos={datos} />
      <Perspectiva datos={datos} />

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
  );
}
