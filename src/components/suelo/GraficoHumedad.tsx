"use client";
// Gráfico simple del agua en el suelo (SVG propio). Pensado para leerse sin saber de datos:
// tres franjas con nombre (Mojado / Bueno / Seco) según los límites del cultivo, valores en %,
// pocas fechas en el eje (las que entran sin encimarse) y el último valor destacado.
import { useEffect, useRef, useState } from "react";
import type { PuntoSerie } from "@/types/contratos";
import { useIdioma } from "../idioma";
import type { UmbralesHumedad } from "./api";

const M = { izq: 74, der: 46, arr: 14, aba: 30 }; // izq: columna con el nombre de cada franja
const Y_MAX = 0.5;
const ANCHO_ETIQUETA = 64; // px mínimos entre fechas del eje

export default function GraficoHumedad({ serie, umbrales }: { serie: PuntoSerie[]; umbrales: UmbralesHumedad }) {
  const { t, fecha } = useIdioma();
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? 240 : 280;

  const puntos = serie.filter((p) => typeof p.humedad_m3m3 === "number");
  if (puntos.length < 2) return <p ref={caja as never} className="text-base text-texto-suave">{t("sinDatos")}</p>;

  const t0 = new Date(puntos[0].fecha).getTime();
  const t1 = new Date(puntos.at(-1)!.fecha).getTime();
  const anchoUtil = W - M.izq - M.der;
  const x = (f: string) => M.izq + ((new Date(f).getTime() - t0) / Math.max(1, t1 - t0)) * anchoUtil;
  const y = (v: number) => M.arr + (1 - Math.min(v, Y_MAX) / Y_MAX) * (H - M.arr - M.aba);
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(p.fecha).toFixed(1)},${y(p.humedad_m3m3!).toFixed(1)}`).join(" ");

  // Fechas del eje: siempre la última; hacia atrás, solo las que quedan a más de ANCHO_ETIQUETA px de la anterior elegida.
  const elegidas: PuntoSerie[] = [];
  for (let i = puntos.length - 1; i >= 0; i--) {
    const ultimaX = elegidas.length ? x(elegidas[elegidas.length - 1].fecha) : Infinity;
    if (ultimaX - x(puntos[i].fecha) >= ANCHO_ETIQUETA) elegidas.push(puntos[i]);
  }

  const franjas = [
    { desde: umbrales.optimo_max, hasta: Y_MAX, color: "var(--agua-mojado)", nombre: t("mojado") },
    { desde: umbrales.bajo_max, hasta: umbrales.optimo_max, color: "var(--agua-bueno)", nombre: t("bueno") },
    { desde: 0, hasta: umbrales.bajo_max, color: "var(--agua-seco)", nombre: t("seco") },
  ];
  const ultimo = puntos.at(-1)!;

  return (
    <div ref={caja}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full" role="img" aria-label={t("graficoTitulo")}>
        {franjas.map((f) => (
          <g key={f.nombre}>
            <rect x={M.izq} width={anchoUtil} y={y(f.hasta)} height={y(f.desde) - y(f.hasta)} fill={f.color} opacity={0.18} />
            <text x={M.izq - 8} y={(y(f.hasta) + y(f.desde)) / 2 + 5} textAnchor="end" fontSize={14} fontWeight={700} fill={f.color}>
              {f.nombre}
            </text>
          </g>
        ))}
        {/* Eje derecho en % */}
        {[0.1, 0.2, 0.3, 0.4].map((v) => (
          <text key={v} x={W - M.der + 8} y={y(v) + 5} fontSize={13} fill="var(--texto-suave)">
            {Math.round(v * 100)} %
          </text>
        ))}
        {/* Fechas */}
        {elegidas.map((p) => (
          <text key={p.fecha} x={x(p.fecha)} y={H - 8} textAnchor={p === ultimo ? "end" : "middle"} fontSize={13} fontWeight={p === ultimo ? 700 : 400} fill="var(--texto-suave)">
            {fecha(p.fecha)}
          </text>
        ))}
        <path d={linea} fill="none" stroke="var(--texto)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p) => (
          <circle
            key={p.fecha}
            cx={x(p.fecha)}
            cy={y(p.humedad_m3m3!)}
            r={p === ultimo ? 7 : 4.5}
            fill={p.calidad === "buena" ? "var(--texto)" : "var(--tarjeta)"}
            stroke="var(--texto)"
            strokeWidth={2.5}
          >
            <title>{`${fecha(p.fecha, true)}: ${Math.round(p.humedad_m3m3! * 100)} %`}</title>
          </circle>
        ))}
        {/* Último valor destacado */}
        <text x={x(ultimo.fecha) - 12} y={y(ultimo.humedad_m3m3!) - 12} textAnchor="end" fontSize={17} fontWeight={800} fill="var(--texto)">
          {Math.round(ultimo.humedad_m3m3! * 100)} %
        </text>
      </svg>
    </div>
  );
}
