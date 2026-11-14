"use client";
// Gráfico de la serie de humedad (SVG propio, sin librerías). Bandas de fondo = umbrales SUPUESTOS
// de config/umbrales.json (lectura; los mantiene Backend). Punto hueco = calidad dudosa.
import umbrales from "../../../config/umbrales.json";
import type { EstadoRecomendacion, PuntoSerie } from "@/types/contratos";
import { useIdioma } from "../idioma";

const W = 640;
const H = 240;
const M = { izq: 44, der: 12, arr: 12, aba: 28 };
const Y_MAX = 0.5;
const COLOR: Record<EstadoRecomendacion, string> = {
  sembrar: "var(--primario)",
  esperar: "var(--dorado)",
  precaucion: "var(--peligro)",
};

type Regla = { estado: EstadoRecomendacion; min?: number; max?: number };

export default function GraficoHumedad({ serie }: { serie: PuntoSerie[] }) {
  const { t, idioma } = useIdioma();
  const puntos = serie.filter((p) => typeof p.humedad_m3m3 === "number");
  if (puntos.length < 2) return <p className="text-sm text-texto-suave">{t("sinDatos")}</p>;

  const t0 = new Date(puntos[0].fecha).getTime();
  const t1 = new Date(puntos.at(-1)!.fecha).getTime();
  const x = (f: string) => M.izq + ((new Date(f).getTime() - t0) / Math.max(1, t1 - t0)) * (W - M.izq - M.der);
  const y = (v: number) => M.arr + (1 - Math.min(v, Y_MAX) / Y_MAX) * (H - M.arr - M.aba);
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(p.fecha).toFixed(1)},${y(p.humedad_m3m3!).toFixed(1)}`).join(" ");
  const fmt = (f: string) => new Date(f + "T12:00:00").toLocaleDateString(idioma === "es" ? "es-PY" : "en-US", { day: "numeric", month: "short" });
  const etiquetasX = [puntos[0], puntos[Math.floor(puntos.length / 2)], puntos.at(-1)!];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("serieTitulo")}>
        {/* Bandas de umbrales */}
        {(umbrales.reglas as Regla[]).map((r, i) => {
          const desde = r.min ?? 0;
          const hasta = Math.min(r.max ?? Y_MAX, Y_MAX);
          return (
            <rect
              key={i}
              x={M.izq}
              width={W - M.izq - M.der}
              y={y(hasta)}
              height={y(desde) - y(hasta)}
              fill={COLOR[r.estado]}
              opacity={0.1}
            />
          );
        })}
        {/* Eje Y */}
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={W - M.der} y1={y(v)} y2={y(v)} stroke="var(--borde)" strokeWidth={1} />
            <text x={M.izq - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--texto-suave)">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {/* Eje X */}
        {etiquetasX.map((p, i) => (
          <text key={i} x={x(p.fecha)} y={H - 8} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize={11} fill="var(--texto-suave)">
            {fmt(p.fecha)}
          </text>
        ))}
        {/* Serie */}
        <path d={linea} fill="none" stroke="var(--acento)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p) => (
          <circle
            key={p.fecha}
            cx={x(p.fecha)}
            cy={y(p.humedad_m3m3!)}
            r={p.calidad === "buena" ? 3.5 : 4.5}
            fill={p.calidad === "buena" ? "var(--acento)" : "var(--fondo)"}
            stroke="var(--acento)"
            strokeWidth={2}
          >
            <title>{`${fmt(p.fecha)}: ${p.humedad_m3m3!.toFixed(3)} m³/m³${p.calidad !== "buena" ? ` (${t("calidadDudosa")})` : ""}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
        <span>m³/m³</span>
        {(["sembrar", "esperar", "precaucion"] as const).map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[e], opacity: 0.6 }} />
            {t(`estado_${e}`)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-acento" />
          {t("calidadDudosa")}
        </span>
      </figcaption>
    </figure>
  );
}
