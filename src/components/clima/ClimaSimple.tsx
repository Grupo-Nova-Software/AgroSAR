"use client";
// Clima simple: lo que un agricultor necesita ver de un vistazo.
// Ahora · hoy · mañana → qué conviene hacer → los próximos 7 días. Todo lo demás está en «Datos avanzados».
import type { RespuestaClima } from "@/lib/clima/tipos";
import Icono, { IconoClima } from "../Icono";
import { consejosDe, fraseDia, iconoDia, type TonoConsejo } from "./simple";
import { useClimaTextos } from "./textos";

const FONDO: Record<TonoConsejo, string> = { bien: "bg-primario text-sobre-primario", aviso: "bg-dorado text-[#2b2410]", peligro: "bg-peligro text-white" };

export default function ClimaSimple({ datos }: { datos: RespuestaClima }) {
  const { idioma, n, diaCorto } = useClimaTextos();
  const es = idioma === "es";
  const dias = datos.diario.filter((d) => d.fecha >= datos.hoy).slice(0, 7);
  const [hoy, manana] = dias;
  const ahora = datos.horario.find((h) => h.t >= datos.hora_actual) ?? datos.horario[0];
  const consejos = consejosDe(datos, idioma, diaCorto);

  const dia = (d: typeof hoy, titulo: string) =>
    d && (
      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-borde bg-tarjeta p-3 shadow-suave">
        <IconoClima tipo={iconoDia(d.mm, d.prob_pct)} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-texto-suave">{titulo}</p>
          <p className="font-display text-lg font-bold leading-tight">{fraseDia(d, idioma)}</p>
          <p className="text-base leading-tight">
            <b>{n(d.tmax_c, 0)}°</b> <span className="text-texto-suave">/ {n(d.tmin_c, 0)}°</span>
            {Math.round(d.mm ?? 0) >= 1 && <b className="ml-2" style={{ color: "var(--agua-mojado-texto)" }}>{n(d.mm, 0)} mm</b>}
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Ahora, hoy y mañana */}
      <section aria-label={es ? "Hoy y mañana" : "Today and tomorrow"}>
        {ahora && typeof ahora.temp_c === "number" && (
          <p className="mb-2 flex flex-wrap items-baseline gap-x-3 px-1 text-lg">
            <span className="font-bold text-texto-suave">{es ? "Ahora" : "Now"}</span>
            <span className="font-display text-4xl font-bold leading-none">{n(ahora.temp_c, 0)} °C</span>
            {typeof ahora.viento_kmh === "number" && (
              <span className="inline-flex items-center gap-1.5 text-base text-texto-suave">
                <Icono nombre="viento" /> {es ? "viento" : "wind"} {n(ahora.viento_kmh, 0)} km/h
              </span>
            )}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {dia(hoy, es ? "Hoy" : "Today")}
          {dia(manana, es ? "Mañana" : "Tomorrow")}
        </div>
      </section>

      {/* Qué conviene hacer */}
      <section className="rounded-2xl border border-borde bg-tarjeta p-4 shadow-suave">
        <h2 className="font-display text-xl font-bold">{es ? "Qué te conviene hacer" : "What to do"}</h2>
        <ul className="mt-3 space-y-4">
          {consejos.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${FONDO[c.tono]}`}>
                <Icono nombre={c.icono} className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[17px] font-bold leading-snug">{c.titulo}</p>
                <p className="mt-0.5 text-base leading-snug text-texto-suave">{c.texto}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-snug text-texto-suave">
          {es
            ? "Es una orientación con reglas simples del equipo, todavía sin validar con técnicos. Ante la duda, consultá a tu técnico."
            : "Guidance from simple team rules, not yet validated by agronomists. When in doubt, ask your advisor."}
        </p>
      </section>

      {/* Próximos días */}
      <section className="rounded-2xl border border-borde bg-tarjeta p-4 shadow-suave">
        <h2 className="font-display text-xl font-bold">{es ? "Los próximos días" : "Next days"}</h2>
        <ul className="mt-2 divide-y divide-borde">
          {dias.map((d, i) => (
            <li key={d.fecha} className="flex items-center gap-2.5 py-1.5 text-base">
              <span className="w-16 shrink-0 font-bold capitalize">{i === 0 ? (es ? "Hoy" : "Today") : diaCorto(d.fecha)}</span>
              <IconoClima tipo={iconoDia(d.mm, d.prob_pct)} className="h-9 w-9" />
              <span className="flex-1 leading-tight">
                {fraseDia(d, idioma)}
                {Math.round(d.mm ?? 0) >= 1 && <b style={{ color: "var(--agua-mojado-texto)" }}> {n(d.mm, 0)} mm</b>}
              </span>
              <span className="shrink-0 whitespace-nowrap">
                <b>{n(d.tmax_c, 0)}°</b> <span className="text-texto-suave">{n(d.tmin_c, 0)}°</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-texto-suave">
          {es ? "mm = milímetros de lluvia. 10 mm ya moja bien el suelo." : "mm = millimetres of rain. 10 mm already wets the soil well."}
        </p>
      </section>
    </div>
  );
}
