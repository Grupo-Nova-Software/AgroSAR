"use client";
// Clima simple: lo que un agricultor necesita ver de un vistazo.
// Ahora · hoy · mañana → qué conviene hacer → los próximos 7 días. Todo lo demás está en «Datos avanzados».
import type { RespuestaClima } from "@/lib/clima/tipos";
import { consejosDe, fraseDia, iconoDia, type TonoConsejo } from "./simple";
import { useClimaTextos } from "./textos";

const BORDE: Record<TonoConsejo, string> = { bien: "border-primario", aviso: "border-dorado", peligro: "border-peligro" };

export default function ClimaSimple({ datos }: { datos: RespuestaClima }) {
  const { idioma, n, diaCorto } = useClimaTextos();
  const es = idioma === "es";
  const dias = datos.diario.filter((d) => d.fecha >= datos.hoy).slice(0, 7);
  const [hoy, manana] = dias;
  const ahora = datos.horario.find((h) => h.t >= datos.hora_actual) ?? datos.horario[0];
  const consejos = consejosDe(datos, idioma, diaCorto);

  const dia = (d: typeof hoy, titulo: string) =>
    d && (
      <div className="flex flex-1 flex-col items-center rounded-3xl border border-borde bg-tarjeta p-3 text-center">
        <p className="text-base font-bold text-texto-suave">{titulo}</p>
        <p aria-hidden className="my-1 text-5xl leading-none">{iconoDia(d.mm, d.prob_pct)}</p>
        <p className="font-display text-xl font-bold leading-tight">{fraseDia(d, idioma)}</p>
        {Math.round(d.mm ?? 0) >= 1 && <p className="text-base font-bold text-acento">{n(d.mm, 0)} mm</p>}
        <p className="mt-1 text-base">
          <b>{n(d.tmax_c, 0)}°</b> <span className="text-texto-suave">/ {n(d.tmin_c, 0)}°</span>
        </p>
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
              <span className="text-base text-texto-suave">
                💨 {es ? "viento" : "wind"} {n(ahora.viento_kmh, 0)} km/h
              </span>
            )}
          </p>
        )}
        <div className="flex gap-3">
          {dia(hoy, es ? "Hoy" : "Today")}
          {dia(manana, es ? "Mañana" : "Tomorrow")}
        </div>
      </section>

      {/* Qué conviene hacer */}
      <section className="rounded-3xl border border-borde bg-tarjeta p-4">
        <h2 className="font-display text-2xl font-bold">{es ? "Qué te conviene hacer" : "What to do"}</h2>
        <ul className="mt-3 space-y-3">
          {consejos.map((c) => (
            <li key={c.id} className={`flex gap-3 rounded-2xl border-l-8 bg-fondo p-3 ${BORDE[c.tono]}`}>
              <span aria-hidden className="text-3xl leading-none">{c.icono}</span>
              <div>
                <p className="text-lg font-bold leading-snug">{c.titulo}</p>
                <p className="mt-0.5 text-base leading-snug text-texto">{c.texto}</p>
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
      <section className="rounded-3xl border border-borde bg-tarjeta p-4">
        <h2 className="font-display text-2xl font-bold">{es ? "Los próximos días" : "Next days"}</h2>
        <ul className="mt-2 divide-y divide-borde">
          {dias.map((d, i) => (
            <li key={d.fecha} className="flex items-center gap-3 py-2 text-lg">
              <span className="w-20 shrink-0 font-bold capitalize">{i === 0 ? (es ? "Hoy" : "Today") : diaCorto(d.fecha)}</span>
              <span aria-hidden className="text-3xl leading-none">{iconoDia(d.mm, d.prob_pct)}</span>
              <span className="flex-1 leading-tight">
                {fraseDia(d, idioma)}
                {Math.round(d.mm ?? 0) >= 1 && <b className="text-acento"> · {n(d.mm, 0)} mm</b>}
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
