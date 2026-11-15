"use client";
// Gráfico simple del agua en el suelo (SVG propio). Pensado para leerse sin saber de datos:
// tres franjas con nombre (Mojado / Bueno / Seco) según los límites del cultivo, valores en %,
// pocas fechas en el eje (las que entran sin encimarse) y el último valor destacado.
import { useEffect, useRef, useState } from "react";
import type { PuntoSerie } from "@/types/contratos";
import { useIdioma } from "../idioma";
import type { UmbralesHumedad } from "./api";

const Y_MAX = 0.5;
const ANCHO_ETIQUETA = 62; // px mínimos entre fechas del eje

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
  const angosto = W < 500;
  const H = angosto ? 230 : 280;
  // En el teléfono casi todo el ancho es para el dibujo: los nombres de las franjas van en una columna angosta.
  const M = { izq: angosto ? 52 : 70, der: 12, arr: 26, aba: 28 };
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
    { desde: umbrales.optimo_max, hasta: Y_MAX, tono: "mojado", nombre: t("mojado") },
    { desde: umbrales.bajo_max, hasta: umbrales.optimo_max, tono: "bueno", nombre: t("bueno") },
    { desde: 0, hasta: umbrales.bajo_max, tono: "seco", nombre: t("seco") },
  ];
  const ultimo = puntos.at(-1)!;
  const altoUtil = H - M.arr - M.aba;
  // Fondo: los tres colores se funden de arriba (mojado) hacia abajo (seco), sin cortes duros
  const o = (v: number) => 1 - v / Y_MAX;
  const paradas = [
    [0, "mojado"], [Math.max(0, o(umbrales.optimo_max) - 0.12), "mojado"], [o(umbrales.optimo_max) + 0.08, "bueno"],
    [o(umbrales.bajo_max) - 0.08, "bueno"], [Math.min(1, o(umbrales.bajo_max) + 0.12), "seco"], [1, "seco"],
  ] as const;
  const area = `${linea} L${x(ultimo.fecha).toFixed(1)},${M.arr + altoUtil} L${x(puntos[0].fecha).toFixed(1)},${M.arr + altoUtil} Z`;
  const yUlt = y(ultimo.humedad_m3m3!);
  const rotuloArriba = yUlt - M.arr > 34;

  return (
    <div ref={caja}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full" role="img" aria-label={t("graficoTitulo")}>
        <defs>
          <linearGradient id="franjas-agua" x1="0" x2="0" y1="0" y2="1">
            {paradas.map(([d, tono], i) => (
              <stop key={i} offset={d} stopColor={`var(--agua-${tono})`} />
            ))}
          </linearGradient>
          <linearGradient id="sombra-linea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--texto)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--texto)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={M.izq} y={M.arr} width={anchoUtil} height={altoUtil} rx={10} fill="url(#franjas-agua)" style={{ opacity: "var(--franja-opacidad)" }} />
        {franjas.map((f) => {
          const medio = (y(f.hasta) + y(f.desde)) / 2;
          return (
            <text key={f.tono} x={M.izq - 8} textAnchor="end" fill={`var(--agua-${f.tono}-texto)`}>
              <tspan x={M.izq - 8} y={medio} fontSize={angosto ? 12 : 14} fontWeight={700}>
                {f.nombre}
              </tspan>
              <tspan x={M.izq - 8} y={medio + 14} fontSize={10.5} fill="var(--texto-suave)">
                {f.desde === 0 ? `< ${Math.round(f.hasta * 100)} %` : f.hasta === Y_MAX ? `> ${Math.round(f.desde * 100)} %` : `${Math.round(f.desde * 100)}–${Math.round(f.hasta * 100)} %`}
              </tspan>
            </text>
          );
        })}
        {/* Límites del cultivo: línea fina */}
        {[umbrales.bajo_max, umbrales.optimo_max].map((v) => (
          <line key={v} x1={M.izq} x2={M.izq + anchoUtil} y1={y(v)} y2={y(v)} stroke="var(--tarjeta)" strokeOpacity={0.9} strokeWidth={1.5} />
        ))}
        {/* Fechas */}
        {elegidas.map((p) => (
          <text key={p.fecha} x={x(p.fecha)} y={H - 8} textAnchor={p === ultimo ? "end" : p === puntos[0] ? "start" : "middle"} fontSize={12} fontWeight={p === ultimo ? 700 : 400} fill="var(--texto-suave)">
            {fecha(p.fecha)}
          </text>
        ))}
        <path d={area} fill="url(#sombra-linea)" />
        <path d={linea} fill="none" stroke="var(--texto)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p) => (
          <circle
            key={p.fecha}
            cx={x(p.fecha)}
            cy={y(p.humedad_m3m3!)}
            r={p === ultimo ? 6.5 : 3.5}
            fill={p === ultimo || p.calidad === "buena" ? "var(--texto)" : "var(--tarjeta)"}
            stroke={p === ultimo ? "var(--tarjeta)" : "var(--texto)"}
            strokeWidth={p === ultimo ? 3 : 2}
          >
            <title>{`${fecha(p.fecha, true)}: ${Math.round(p.humedad_m3m3! * 100)} %`}</title>
          </circle>
        ))}
        {/* Último valor destacado */}
        <g transform={`translate(${x(ultimo.fecha) - 2}, ${rotuloArriba ? yUlt - 16 : yUlt + 30})`}>
          <rect x={-50} y={-17} width={52} height={23} rx={11.5} fill="var(--texto)" />
          <text x={-24} y={0} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--tarjeta)">
            {Math.round(ultimo.humedad_m3m3! * 100)} %
          </text>
        </g>
      </svg>
    </div>
  );
}
