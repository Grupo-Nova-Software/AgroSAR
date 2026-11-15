"use client";
// Los próximos meses de la campaña: lluvia NORMAL de cada mes (climatología NASA POWER) y en qué etapa estaría el cultivo.
// Es la normal histórica, NO un pronóstico: se dice arriba y en cada lectura.
import type { RespuestaClima } from "@/lib/clima/tipos";
import Icono from "../Icono";
import { useClimaTextos } from "./textos";

export default function Perspectiva({ datos }: { datos: RespuestaClima }) {
  const { tc, n, mes, etapa } = useClimaTextos();
  const p = datos.perspectiva;
  if (!p) return null;
  const maxMm = Math.max(...p.meses.map((m) => m.normal_mm), 1);
  const anios = p.periodo_normal.match(/\d{4}/g);
  const periodo = anios && anios.length >= 2 ? `${anios[0]}–${anios[anios.length - 1]}` : p.periodo_normal;
  const a = p.mes_actual;

  return (
    <section className="rounded-2xl border border-borde bg-tarjeta p-4">
      <h2 className="font-display text-2xl font-bold">{tc("perspTitulo")}</h2>
      <p className="text-base text-texto-suave">{tc("perspSub", { periodo })}</p>

      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {p.meses.map((m) => (
          <li key={m.mes} className={`rounded-xl border-2 bg-fondo p-3 ${m.mes === p.mes_mas_vulnerable ? "border-dorado" : "border-borde"}`}>
            <p className="font-display text-xl font-bold capitalize">{mes(m.mes)}</p>
            <p className="mt-1 text-sm text-texto-suave">{tc("normalMes")}</p>
            <p className="font-display text-2xl font-bold">{n(m.normal_mm)} mm</p>
            <div className="mt-1 h-2 rounded-full bg-tarjeta-2" aria-hidden>
              <div className="h-2 rounded-full" style={{ width: `${(m.normal_mm / maxMm) * 100}%`, background: "var(--agua-mojado)" }} />
            </div>
            <p className="mt-1 text-sm text-texto-suave">{tc("tempNormal", { t: n(m.normal_t_c, 0) })}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {m.etapas.map((e) => (
                <li key={e.id} className={e.critica_agua ? "font-bold" : ""}>
                  {e.critica_agua ? <Icono nombre="gota" className="mr-1 h-4 w-4 align-[-2px]" /> : "· "}
                  {etapa(e.nombre)}
                  {e.critica_agua && <span className="block text-xs font-normal text-texto-suave">{tc("etapaCritica")}</span>}
                </li>
              ))}
            </ul>
            {m.mes === p.mes_mas_vulnerable && (
              <p className="mt-2 inline-block rounded-full bg-dorado/25 px-2.5 py-0.5 text-xs font-bold">! {tc("masVulnerable")}</p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-3 space-y-1 text-base">
        <p>
          {a.anomalia_pct === null
            ? tc("mesActualSin", { a: n(a.acumulado_mm), n: n(a.normal_a_la_fecha_mm) })
            : tc("mesActual", { a: n(a.acumulado_mm), n: n(a.normal_a_la_fecha_mm), p: `${a.anomalia_pct > 0 ? "+" : ""}${a.anomalia_pct}` })}
        </p>
        {p.ultimos_30d && p.ultimos_30d.anomalia_pct !== null && (
          <p>{tc("ult30", { a: n(p.ultimos_30d.lluvia_mm), n: n(p.ultimos_30d.normal_mm), p: `${p.ultimos_30d.anomalia_pct > 0 ? "+" : ""}${p.ultimos_30d.anomalia_pct}` })}</p>
        )}
        <p className="text-sm text-texto-suave">
          {p.siembra.supuesta ? tc("siembraSupuesta", { ciclo: p.siembra.ciclo, dias: p.siembra.dias }) : ""}{" "}
          {p.requerimiento_mm ? tc("requerimiento", { a: p.requerimiento_mm[0], b: p.requerimiento_mm[1] }) : tc("sinRequerimiento")}
        </p>
      </div>
    </section>
  );
}
