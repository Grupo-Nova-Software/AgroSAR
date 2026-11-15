"use client";
// Agua de los últimos 30 días (NASA POWER) y de los próximos 14 (pronóstico), en dos paneles con el mismo eje de fechas:
//   arriba, la lluvia de cada día (barras); abajo, el balance acumulado lluvia − evaporación (línea).
// Son dos paneles y no un gráfico con dos ejes: cada medida tiene su propia escala y se lee sola.
// Al pasar el dedo o el mouse se ve el detalle del día. Debajo, los mismos datos en una tabla.
import { useEffect, useRef, useState } from "react";
import type { RespuestaClima } from "@/lib/clima/tipos";
import { useClimaTextos } from "./textos";

const M = { izq: 44, der: 16 };
const ALTO_A = 150; // lluvia
const ALTO_B = 150; // balance
const SEP = 46;

interface Dia {
  fecha: string;
  mm: number | null;
  et0: number | null;
  tipo: "medido" | "relleno" | "pronostico";
  acum: number | null;
}

export default function BalanceHidrico({ datos }: { datos: RespuestaClima }) {
  const { tc, n, conSigno, diaCorto, fecha } = useClimaTextos();
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(680);
  const [sobre, setSobre] = useState<number | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Serie única: 30 días de historia + 14 de pronóstico, con el balance acumulado desde el primer día
  const dias: Dia[] = [];
  let acum = 0;
  // Un día sin lluvia o sin ET0 no suma ni resta: el balance sigue igual ese día.
  const agregar = (f: string, mm: number | null, et0: number | null, tipo: Dia["tipo"]) => {
    if (typeof mm === "number" && typeof et0 === "number") acum += mm - et0;
    dias.push({ fecha: f, mm, et0, tipo, acum: Number(acum.toFixed(1)) });
  };
  const valorFactor = (f: RespuestaClima["sequia"]["factores"][number]) =>
    f.codigo === "nisar_estado"
      ? tc(`estado_${f.valor as "seco" | "bajo"}`)
      : typeof f.valor !== "number"
        ? f.valor
        : f.codigo === "balance_30d" || f.codigo === "balance_15d"
          ? conSigno(f.valor)
          : n(Math.abs(f.valor), f.codigo === "nisar_baja" ? 2 : 0);
  for (const d of datos.historico) agregar(d.fecha, d.mm, d.et0_mm, d.fuente === "open_meteo" ? "relleno" : "medido");
  const nHist = dias.length;
  for (const d of datos.diario) agregar(d.fecha, d.mm, d.et0_mm, "pronostico");
  if (dias.length < 5) return null;

  const util = W - M.izq - M.der;
  const paso = util / dias.length;
  const cx = (i: number) => M.izq + paso * (i + 0.5);
  const anchoBarra = Math.max(2, Math.min(14, paso - 2));

  const mmMax = Math.max(10, ...dias.map((d) => d.mm ?? 0));
  const yA = (v: number) => 20 + (1 - v / mmMax) * (ALTO_A - 20);
  const acums = dias.map((d) => d.acum).filter((v): v is number => v !== null);
  const bMin = Math.min(0, ...acums);
  const bMax = Math.max(0, ...acums);
  const margen = Math.max(10, (bMax - bMin) * 0.12);
  const y0B = ALTO_A + SEP;
  const yB = (v: number) => y0B + 14 + (1 - (v - (bMin - margen)) / (bMax + margen - (bMin - margen))) * (ALTO_B - 14);
  const H = y0B + ALTO_B + 28;

  const tramo = (desde: number, hasta: number) =>
    dias
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => i >= desde && i < hasta && d.acum !== null)
      .map(({ d, i }, k) => `${k ? "L" : "M"}${cx(i).toFixed(1)},${yB(d.acum!).toFixed(1)}`)
      .join(" ");

  const color = { medido: "var(--agua-mojado)", relleno: "var(--agua-mojado)", pronostico: "var(--agua-mojado)" };
  const opacidad = { medido: 1, relleno: 0.6, pronostico: 0.35 };
  const nisar = datos.nisar_serie.filter((p) => typeof p.humedad_m3m3 === "number" && p.fecha >= dias[0].fecha && p.fecha <= dias[nHist - 1].fecha);
  const iDe = (f: string) => dias.findIndex((d) => d.fecha === f);
  const ejeFechas = dias.map((d, i) => ({ d, i })).filter(({ i }) => i % Math.ceil(dias.length / Math.max(3, Math.floor(util / 78))) === 0);
  const ultHist = dias[nHist - 1];
  const fin = [...dias].reverse().find((d) => d.acum !== null);
  const s = datos.sequia;
  const fuenteDe = (t: Dia["tipo"]) => tc(t === "medido" ? "medido" : t === "relleno" ? "relleno" : "pronostico");

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = Math.floor((x - M.izq) / paso);
    setSobre(i >= 0 && i < dias.length ? i : null);
  };
  const dSobre = sobre !== null ? dias[sobre] : null;

  const dato = (rotulo: string, valor: string) => (
    <div className="rounded-2xl bg-fondo px-3 py-2">
      <p className="text-xs font-bold text-texto-suave">{rotulo}</p>
      <p className="font-display text-xl font-bold text-texto">{valor}</p>
    </div>
  );

  return (
    <section className="rounded-3xl border border-borde bg-tarjeta p-4">
      <h2 className="font-display text-2xl font-bold">{tc("balanceTitulo")}</h2>
      <p className="text-base text-texto-suave">{tc("balanceSub")}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {s.balance_30d && dato(tc("tLluvia30"), `${n(s.balance_30d.lluvia_mm)} mm`)}
        {s.balance_30d && dato(tc("tEt030"), `${n(s.balance_30d.et0_mm)} mm`)}
        {s.balance_30d && dato(tc("tBalance30"), `${conSigno(s.balance_30d.balance_mm)} mm`)}
        {s.balance_15d && dato(tc("tBalance15"), `${conSigno(s.balance_15d.balance_mm)} mm`)}
        {s.balance_prox_14d && dato(tc("tProx14"), `${conSigno(s.balance_prox_14d.balance_mm)} mm`)}
      </div>

      {/* Leyenda: la identidad nunca va solo en el color */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto">
        {(["medido", "relleno", "pronostico"] as const).map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: color[t], opacity: opacidad[t] }} />
            {fuenteDe(t)}
          </li>
        ))}
        {nisar.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-0 border-l-2 border-dashed border-texto" />
            {tc("pasadaNisar")}
          </li>
        )}
      </ul>

      <div ref={caja} className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block h-auto w-full touch-pan-y"
          role="img"
          aria-label={`${tc("lluviaDiaria")}. ${tc("balanceAcum")}`}
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setSobre(null)}
        >
          {/* ---- Panel A: lluvia diaria ---- */}
          <text x={M.izq} y={12} fontSize={13} fontWeight={700} fill="var(--texto)">{tc("lluviaDiaria")}</text>
          {[0, mmMax / 2, mmMax].map((v) => (
            <g key={v}>
              <line x1={M.izq} x2={W - M.der} y1={yA(v)} y2={yA(v)} stroke="var(--borde)" strokeWidth={1} />
              <text x={M.izq - 6} y={yA(v) + 4} textAnchor="end" fontSize={12} fill="var(--texto-suave)">{n(v)}</text>
            </g>
          ))}
          {dias.map((d, i) =>
            typeof d.mm === "number" && d.mm > 0 ? (
              <rect key={d.fecha} x={cx(i) - anchoBarra / 2} width={anchoBarra} y={yA(d.mm)} height={Math.max(1, yA(0) - yA(d.mm))} rx={Math.min(3, anchoBarra / 2)} fill={color[d.tipo]} opacity={opacidad[d.tipo]} />
            ) : null,
          )}
          {nisar.map((p) => {
            const i = iDe(p.fecha);
            return i < 0 ? null : (
              <g key={p.fecha}>
                <line x1={cx(i)} x2={cx(i)} y1={24} y2={yA(0)} stroke="var(--texto)" strokeWidth={1.5} strokeDasharray="4 3" />
                <text x={cx(i) + 5} y={34} fontSize={12} fontWeight={700} fill="var(--texto)">NISAR {n(p.humedad_m3m3, 2)} m³/m³</text>
              </g>
            );
          })}

          {/* ---- Panel B: balance acumulado ---- */}
          <text x={M.izq} y={y0B + 4} fontSize={13} fontWeight={700} fill="var(--texto)">{tc("balanceAcum")}</text>
          {[...new Set([bMin, 0, bMax])].map((v) => (
            <g key={v}>
              <line x1={M.izq} x2={W - M.der} y1={yB(v)} y2={yB(v)} stroke={v === 0 ? "var(--texto-suave)" : "var(--borde)"} strokeWidth={v === 0 ? 1.5 : 1} />
              <text x={M.izq - 6} y={yB(v) + 4} textAnchor="end" fontSize={12} fill="var(--texto-suave)">{conSigno(v)}</text>
            </g>
          ))}
          <path d={tramo(0, nHist)} fill="none" stroke="var(--texto)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={tramo(nHist - 1, dias.length)} fill="none" stroke="var(--texto)" strokeWidth={2.5} strokeDasharray="5 5" strokeLinejoin="round" />
          {ultHist?.acum !== null && ultHist && (
            <>
              <circle cx={cx(nHist - 1)} cy={yB(ultHist.acum!)} r={5} fill="var(--texto)" stroke="var(--tarjeta)" strokeWidth={2} />
              <text x={cx(nHist - 1) - 8} y={yB(ultHist.acum!) - 9} textAnchor="end" fontSize={14} fontWeight={800} fill="var(--texto)">{conSigno(ultHist.acum!)} mm</text>
            </>
          )}
          {fin && fin !== ultHist && fin.acum !== null && (
            <text x={W - M.der} y={yB(fin.acum) - 9} textAnchor="end" fontSize={13} fontWeight={700} fill="var(--texto-suave)">{conSigno(fin.acum)} mm</text>
          )}

          {/* "Hoy": separa lo registrado del pronóstico en los dos paneles */}
          <line x1={M.izq + paso * nHist} x2={M.izq + paso * nHist} y1={18} y2={y0B + ALTO_B} stroke="var(--dorado)" strokeWidth={2} />
          <text x={M.izq + paso * nHist + 4} y={y0B - 14} fontSize={12} fontWeight={700} fill="var(--texto)">{tc("hoy")} →</text>

          {/* Fechas */}
          {ejeFechas.map(({ d, i }) => (
            <text key={d.fecha} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--texto-suave)">{fecha(d.fecha)}</text>
          ))}

          {sobre !== null && <line x1={cx(sobre)} x2={cx(sobre)} y1={18} y2={y0B + ALTO_B} stroke="var(--texto-suave)" strokeWidth={1} />}
        </svg>

        {dSobre && sobre !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-48 rounded-xl border border-borde bg-fondo px-3 py-2 text-sm shadow-suave"
            style={{ left: `clamp(0px, calc(${(cx(sobre) / W) * 100}% - 6rem), calc(100% - 12rem))` }}
          >
            <p className="font-bold">{diaCorto(dSobre.fecha)} · {fecha(dSobre.fecha)}</p>
            <p>{tc("colLluvia")}: <b>{n(dSobre.mm, 1)}</b></p>
            <p>{tc("colEt0")}: <b>{n(dSobre.et0, 1)}</b></p>
            <p>{tc("colBalance")}: <b>{dSobre.acum === null ? "–" : conSigno(dSobre.acum)}</b></p>
            <p className="text-xs text-texto-suave">{fuenteDe(dSobre.tipo)}</p>
          </div>
        )}
      </div>

      <h3 className="mt-3 text-base font-bold">{tc("factores")}: {tc(`nivel_${s.nivel}`)}</h3>
      {s.factores.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-base">
          {s.factores.map((f) => (
            <li key={f.codigo}>{tc(`factor_${f.codigo}`, { v: valorFactor(f) })}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-base">{tc("sinFactores")}</p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-base font-bold text-acento">{tc("verTabla")}</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-tarjeta">
              <tr>
                {[tc("colFecha"), tc("colLluvia"), tc("colEt0"), tc("colBalance"), tc("colFuente")].map((c) => (
                  <th key={c} scope="col" className="py-1 pr-3">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d.fecha} className="border-t border-borde">
                  <td className="py-1 pr-3">{fecha(d.fecha)}</td>
                  <td className="pr-3">{n(d.mm, 1)}</td>
                  <td className="pr-3">{n(d.et0, 1)}</td>
                  <td className="pr-3">{d.acum === null ? "–" : conSigno(d.acum, 1)}</td>
                  <td>{fuenteDe(d.tipo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-3 text-sm leading-snug text-texto-suave">{tc("et0Nota")} {tc("gwettop")}</p>
      <p className="mt-1 text-sm leading-snug text-texto-suave">{tc("nivelesNota")}</p>
    </section>
  );
}
