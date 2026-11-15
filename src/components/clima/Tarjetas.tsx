"use client";
// Las 4 respuestas rápidas para el agricultor: ¿llueve mañana?, ¿cuándo no llueve?, calor / frío y sequía.
// El estado nunca va solo en color: siempre lleva un ícono y una palabra.
import type { ReactNode } from "react";
import type { NivelSequia, RespuestaClima } from "@/lib/clima/tipos";
import { useClimaTextos } from "./textos";

type Tono = "bien" | "aviso" | "peligro" | "neutro";
const TONO: Record<Tono, { borde: string; icono: string }> = {
  bien: { borde: "border-primario", icono: "✓" },
  aviso: { borde: "border-dorado", icono: "!" },
  peligro: { borde: "border-peligro", icono: "⚠" },
  neutro: { borde: "border-borde", icono: "•" },
};
const TONO_SEQUIA: Record<NivelSequia, Tono> = { optimo: "bien", atencion: "aviso", moderada: "peligro", severa: "peligro" };

function Tarjeta({ pregunta, titular, tono, children }: { pregunta: string; titular: string; tono: Tono; children: ReactNode }) {
  const t = TONO[tono];
  return (
    <section className={`flex flex-col rounded-3xl border-2 bg-tarjeta p-4 ${t.borde}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-texto-suave">{pregunta}</h2>
      <p className="mt-1 flex items-start gap-2 font-display text-2xl font-bold leading-tight text-texto">
        <span aria-hidden className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-base ${t.borde}`}>{t.icono}</span>
        {titular}
      </p>
      <div className="mt-2 space-y-1 text-base leading-snug text-texto">{children}</div>
    </section>
  );
}

export default function Tarjetas({ datos }: { datos: RespuestaClima }) {
  const { tc, n, conSigno, diaCorto, fecha } = useClimaTextos();
  const { lluvia, ventanas_secas: secas, pulverizacion: pulv, temperatura: temp, sequia } = datos;

  // ¿Llueve mañana?
  const m = lluvia?.manana;
  const notaLluvia = !m || !m.llueve ? tc("notaSinLluvia") : m.mm >= 40 ? tc("notaLluviaFuerte") : m.mm >= 10 ? tc("notaRecarga") : tc("notaLluviaPoca");

  // ¿Cuándo no llueve?: la ventana seca más larga (si empatan, la primera)
  const mejor = secas?.reduce<(typeof secas)[number] | null>((a, b) => (!a || b.dias > a.dias ? b : a), null) ?? null;
  const pulvLinea = (d: NonNullable<typeof pulv>["hoy"], rotulo: string) =>
    d.horas_aptas > 0
      ? `${tc("pulvHoras", { dia: rotulo, n: d.horas_aptas })} (${tc("pulvPrimera", { hora: d.bloques[0].desde.slice(11, 16) })})`
      : tc("pulvNada", { dia: rotulo });

  // Calor / frío
  const h = temp?.helada;
  const calor = temp ? temp.hoy.estres_calor || temp.manana.estres_calor : false;
  const lineaHelada = !h
    ? ""
    : h.riesgo === "ninguno" || !h.minima_pronosticada
      ? tc("heladaNinguno")
      : tc(h.riesgo === "alto" ? "heladaAlto" : "heladaBajo", { c: n(h.minima_pronosticada.c, 0), dia: diaCorto(h.minima_pronosticada.fecha) });
  const extremos = (e: NonNullable<typeof temp>["hoy"], rotulo: string) => (
    <p>
      <b>{rotulo}:</b> {tc("picoCalor")} {n(e.max?.c, 0)} °C {e.max ? tc("aLas", { hora: e.max.hora }) : ""} · {tc("minima")} {n(e.min?.c, 0)} °C{" "}
      {e.min ? tc("aLas", { hora: e.min.hora }) : ""}
    </p>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta
        pregunta={tc("qLluvia")}
        tono={!m ? "neutro" : m.llueve ? (m.mm >= 40 ? "aviso" : "bien") : "neutro"}
        titular={!m ? "–" : m.llueve ? `${tc("si")} · ${n(m.mm, 1)} mm` : tc("no")}
      >
        {m?.pico && <p>{tc("pico", { desde: m.pico.desde, hasta: m.pico.hasta, mm: n(m.pico.mm, 1) })}</p>}
        {m && typeof m.prob_max_pct === "number" && <p>{tc("probabilidad", { p: m.prob_max_pct })}</p>}
        {lluvia && <p>{tc("hoyResto", { mm: n(lluvia.hoy.mm, 1) })}</p>}
        <p className="text-texto-suave">{notaLluvia}</p>
      </Tarjeta>

      <Tarjeta
        pregunta={tc("qSeco")}
        tono={!mejor ? "aviso" : mejor.dias >= 2 ? "bien" : "neutro"}
        titular={!mejor ? "–" : mejor.dias >= 2 ? `${diaCorto(mejor.desde)} → ${diaCorto(mejor.hasta)}` : diaCorto(mejor.desde)}
      >
        <p>{!mejor ? tc("sinVentana") : mejor.dias >= 2 ? tc("diasSecos", { n: mejor.dias }) : tc("unDiaSeco", { dia: diaCorto(mejor.desde) })}</p>
        {pulv && (
          <>
            <p className="pt-1 font-bold">{tc("pulverizar")}</p>
            <p>{pulvLinea(pulv.hoy, tc("hoy"))}</p>
            <p>{pulvLinea(pulv.manana, tc("manana"))}</p>
          </>
        )}
      </Tarjeta>

      <Tarjeta
        pregunta={tc("qTemp")}
        tono={!temp ? "neutro" : h?.riesgo === "alto" || calor ? "peligro" : h?.riesgo === "bajo" ? "aviso" : "bien"}
        titular={temp ? `${n(temp.manana.max?.c ?? temp.hoy.max?.c, 0)} °C / ${n(temp.manana.min?.c ?? temp.hoy.min?.c, 0)} °C` : "–"}
      >
        {temp && (
          <>
            {extremos(temp.hoy, tc("hoy"))}
            {extremos(temp.manana, tc("manana"))}
            {calor && <p className="font-bold">{tc("estresCalor", { u: temp.umbral_calor_c })}</p>}
            <p>
              <b>{tc("helada")}:</b> {lineaHelada}
            </p>
          </>
        )}
      </Tarjeta>

      <Tarjeta pregunta={tc("qSequia")} tono={TONO_SEQUIA[sequia.nivel]} titular={tc(`nivel_${sequia.nivel}`)}>
        {sequia.balance_30d && (
          <p>
            {tc("balance30", { mm: conSigno(sequia.balance_30d.balance_mm) })} <span className="text-texto-suave">({tc("balanceExplica")})</span>
          </p>
        )}
        <p>{tc("diasSinLluvia", { n: sequia.dias_sin_lluvia })}</p>
        {sequia.nisar ? (
          <>
            <p>
              {tc("nisar", { v: n(sequia.nisar.humedad_m3m3, 2) })}{" "}
              <span className="text-texto-suave">({tc("nisarEdad", { dia: fecha(sequia.nisar.fecha), n: sequia.nisar.dias_antiguedad })})</span>
            </p>
            {sequia.nisar.desactualizada && <p className="text-texto-suave">{tc("nisarVieja")}</p>}
          </>
        ) : (
          <p className="text-texto-suave">{tc("nisarSin")}</p>
        )}
      </Tarjeta>
    </div>
  );
}
