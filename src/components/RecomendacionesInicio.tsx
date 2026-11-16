"use client";
// Inicio, al bajar: «qué hacer hoy», con datos reales. Tres bloques que acompañan el fondo (cielo → superficie → raíces):
//   1. El cielo: clima de hoy y mañana + consejos del día (pulverizar, lluvia fuerte, calor, helada…).
//   2. La superficie (0–5 cm): el agua del suelo que midió el radar NISAR y la recomendación de siembra.
//   3. Las raíces: qué hacer con el cultivo (alertas del motor, semilla, próxima siembra) y el balance de agua.
// Lugar: la chacra del agricultor que siembra el cultivo elegido (dato NISAR de esa chacra); si no tiene, todo Itapúa.
// Nada se inventa: si un dato no llegó (sin internet, sin pasada), el bloque lo dice.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ITAPUA_ID } from "@/lib/itapua";
import { centroDeChacra, fueraDeItapua, useChacras, useEnLinea } from "./chacras";
import { consejosDe, fraseDia, iconoDia } from "./clima/simple";
import { CULTIVOS } from "./cultivos";
import { useClimaLugar } from "./fondo/cielo";
import Icono, { Dibujo, IconoClima } from "./Icono";
import { useIdioma, type Clave } from "./idioma";
import type { CultivoId } from "./preferencias";
import { pedirAnalisis, type Analisis } from "./suelo/api";
import { motivoDe, tonoAguaDe } from "./suelo/motivo";
import { useResultados } from "./suelo/useResultados";

const COLOR = { sembrar: "var(--primario)", esperar: "var(--dorado)", precaucion: "var(--peligro)" } as const;
const FONDO_TONO = { bien: "bg-primario text-sobre-primario", aviso: "bg-dorado text-[#2b2410]", peligro: "bg-peligro text-white" } as const;

export default function RecomendacionesInicio({ cultivo }: { cultivo: CultivoId }) {
  const { t, tr, fecha, idioma } = useIdioma();
  const es = idioma === "es";
  const enLinea = useEnLinea();
  const { chacras, cargadas, actualizar } = useChacras();
  useResultados(chacras, actualizar); // mantiene al día el resultado de cada chacra

  const cfg = CULTIVOS.find((c) => c.id === cultivo)!;
  const enFrase = tr(cfg.enFrase);
  const chacra = chacras.find((c) => c.cultivo === cultivo && !fueraDeItapua(c));
  const punto = chacra ? centroDeChacra(chacra) : null;
  const clima = useClimaLugar(cargadas ? punto : null, cultivo);

  // Suelo: el resultado de la chacra (NISAR en esa chacra) o, sin chacra, el promedio de Itapúa
  const [itapua, setItapua] = useState<{ cultivo: string; datos: Analisis } | null>(null);
  useEffect(() => {
    if (!cargadas || chacra) return;
    let vigente = true;
    pedirAnalisis(ITAPUA_ID, cultivo)
      .then((a) => vigente && setItapua({ cultivo, datos: a }))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [cargadas, chacra, cultivo]);
  const analisis = chacra ? chacra.resultado?.analisis : itapua?.cultivo === cultivo ? itapua.datos : undefined;

  const lugar = chacra ? chacra.nombre : "Itapúa";
  const n = (v: number | null | undefined, dec = 0) =>
    typeof v === "number" ? v.toLocaleString(es ? "es-PY" : "en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "–";
  const diaCorto = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(es ? "es-PY" : "en-US", { weekday: "short", day: "numeric" });
  const tarjeta = "sobre-fondo rounded-2xl p-4 shadow-suave md:p-5";
  const titulo = "flex items-center gap-2.5 font-display text-xl font-bold leading-tight text-texto md:text-2xl";
  const sinDato = (texto: string) => <p className="mt-2 text-base text-texto-suave">{texto}</p>;
  const esperando = enLinea ? (es ? "Cargando…" : "Loading…") : es ? "Sin internet: no se pudo traer este dato." : "Offline: this data could not be loaded.";

  // ---------- 1. Cielo ----------
  const dias = clima ? clima.diario.filter((d) => d.fecha >= clima.hoy).slice(0, 2) : [];
  const consejos = clima ? consejosDe(clima, idioma, diaCorto).slice(0, 3) : [];

  // ---------- 2. Superficie (NISAR) ----------
  const h = analisis?.humedad;
  const pct = h && h.media_m3m3 !== null ? Math.round(h.media_m3m3 * 100) : null;
  const tono = h ? tonoAguaDe(h.estado) : "bueno";

  // ---------- 3. Raíces / cultivo ----------
  const alertas = es && analisis ? analisis.alertas.filter((a) => a.nivel !== "info" && (a.recomendacion || a.detalle)).slice(0, 3) : [];
  const balance = clima?.sequia.balance_30d ?? null;
  const proxima = analisis?.temporada.estado === "fuera" ? analisis.temporada.proxima : null;

  return (
    <section aria-labelledby="hoy-en" className="mx-auto w-full max-w-xl">
      <div className={`${tarjeta} mt-10 text-center md:mt-14`}>
        <h2 id="hoy-en" className="font-display text-2xl font-bold tracking-tight text-texto md:text-3xl">
          {es ? `Hoy en ${lugar}` : `Today in ${lugar}`}
        </h2>
        <p className="mt-1 text-base text-texto-suave">
          {es
            ? `Qué te conviene hacer con ${enFrase}, según el clima y el radar NISAR.`
            : `What to do with ${enFrase}, from the weather and the NISAR radar.`}{" "}
          {!chacra && (
            <Link href={`/suelo?cultivo=${cultivo}&nueva=1`} className="font-bold text-acento underline underline-offset-4">
              {es ? "Marcá tu chacra para ver el dato de tu tierra." : "Mark your field to see the data for your land."}
            </Link>
          )}
        </p>
      </div>

      {/* 1. El cielo */}
      <article className={`${tarjeta} mt-8`}>
        <h3 className={titulo}>
          <Dibujo nombre="clima-parcial" className="h-9 w-9" />
          {es ? "El cielo: hoy y mañana" : "The sky: today and tomorrow"}
        </h3>
        {!clima ? (
          sinDato(esperando)
        ) : (
          <>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {dias.map((d, i) => (
                <li key={d.fecha} className="flex items-center gap-2.5 rounded-xl bg-tarjeta-2 p-2.5">
                  <IconoClima tipo={iconoDia(d.mm, d.prob_pct)} className="h-11 w-11" />
                  <div className="min-w-0 leading-tight">
                    <p className="text-sm font-bold text-texto-suave">{i === 0 ? (es ? "Hoy" : "Today") : es ? "Mañana" : "Tomorrow"}</p>
                    <p className="font-bold">{fraseDia(d, idioma)}</p>
                    <p className="text-sm">
                      <b>{n(d.tmax_c)}°</b> <span className="text-texto-suave">/ {n(d.tmin_c)}°</span>
                      {Math.round(d.mm ?? 0) >= 1 && <b className="ml-1.5" style={{ color: "var(--agua-mojado-texto)" }}>{n(d.mm)} mm</b>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="mt-3 space-y-3">
              {consejos.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${FONDO_TONO[c.tono]}`}>
                    <Icono nombre={c.icono} />
                  </span>
                  <div>
                    <p className="font-bold leading-snug">{c.titulo}</p>
                    <p className="text-[15px] leading-snug text-texto-suave">{c.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/clima" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-base font-bold text-acento">
              {es ? "Ver el clima completo" : "See the full forecast"} <Icono nombre="derecha" className="h-4 w-4" />
            </Link>
          </>
        )}
      </article>

      {/* 2. La superficie: lo que mide el radar */}
      <article className={`${tarjeta} mt-[34vh]`}>
        <h3 className={titulo}>
          <Dibujo nombre={`suelo-${tono}`} className="h-9 w-9" />
          {es ? "La tierra: agua de 0 a 5 cm" : "The soil: water from 0 to 5 cm"}
        </h3>
        <p className="text-sm text-texto-suave">{es ? "Medida desde el espacio por el radar NISAR (NASA-ISRO)." : "Measured from space by the NISAR radar (NASA-ISRO)."}</p>
        {!analisis || !h ? (
          sinDato(esperando)
        ) : (
          <>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-3xl font-bold" style={{ color: `var(--agua-${tono}-texto)` }}>
                {t(`agua_${h.estado}` as Clave)}
              </span>
              {pct !== null && <span className="text-lg text-texto-suave">{pct} %</span>}
              {h.tendencia && h.estado !== "sin_datos" && <span className="text-base text-texto-suave">· {t(`tend_${h.tendencia}` as Clave)}</span>}
            </p>
            {h.ultima_fecha && (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[15px] text-texto-suave">
                <Icono nombre="satelite" className="h-4 w-4" />
                {t("datoDel")}: <b className="text-texto">{fecha(h.ultima_fecha, true)}</b>
                <span>· {h.dias_desde_observacion ? t("haceDias", { n: h.dias_desde_observacion }) : t("hoy")}</span>
              </p>
            )}
            {h.desactualizada && <p className="mt-1 text-sm font-bold text-peligro">{t("datoViejo")}</p>}
            <div
              className={`mt-3 rounded-xl p-3 ${analisis.estado === "esperar" ? "text-[#2b2410]" : "text-white"}`}
              style={{ background: COLOR[analisis.estado] }}
            >
              <p className="font-display text-xl font-extrabold leading-tight">{t(`titulo_${analisis.estado}` as Clave)}</p>
              <p className="mt-0.5 text-[15px] leading-snug">{motivoDe(analisis, t, fecha, enFrase)}</p>
            </div>
          </>
        )}
      </article>

      {/* 3. Las raíces: qué hacer con el cultivo */}
      <article className={`${tarjeta} mt-[40vh]`}>
        <h3 className={titulo}>
          <Dibujo nombre={`cultivo-${cultivo}`} className="h-9 w-9" />
          {es ? `Tu ${tr(cfg.nombre).toLowerCase()}: qué hacer` : `Your ${tr(cfg.nombre).toLowerCase()}: what to do`}
        </h3>
        {!analisis && !clima ? (
          sinDato(esperando)
        ) : (
          <ul className="mt-3 space-y-3 text-base">
            {alertas.map((a) => (
              <li key={a.id} className="rounded-lg border-l-4 bg-tarjeta-2 px-3 py-2.5 leading-snug" style={{ borderColor: a.nivel === "critico" ? "var(--peligro)" : "var(--dorado)" }}>
                <b>{a.titulo}.</b> {a.recomendacion ?? a.detalle}
              </li>
            ))}
            {proxima && (
              <li className="flex items-start gap-2.5">
                <Icono nombre="calendario" className="mt-0.5 h-5 w-5 text-texto-suave" />
                <span>
                  {t("proximaSiembra")}: <b>{fecha(proxima.inicio, true)}</b>
                </span>
              </li>
            )}
            {analisis?.semilla?.semilla && !proxima && (
              <li className="flex items-start gap-2.5">
                <Icono nombre="semilla" className="mt-0.5 h-5 w-5 text-texto-suave" />
                <span>
                  {t("semilla")}: <b>{analisis.semilla.semilla}</b>
                  {analisis.semilla.ciclo_sugerido && <span className="text-texto-suave"> · {t("cicloDias", { n: analisis.semilla.ciclo_sugerido.dias })}</span>}
                </span>
              </li>
            )}
            {balance && (
              <li className="flex items-start gap-2.5">
                <Icono nombre="gota" className="mt-0.5 h-5 w-5 text-texto-suave" />
                <span>
                  {es ? "Agua para las raíces (últimos 30 días): " : "Water for the roots (last 30 days): "}
                  <b>
                    {balance.balance_mm > 0 ? "+" : balance.balance_mm < 0 ? "−" : ""}
                    {n(Math.abs(balance.balance_mm))} mm
                  </b>
                  .{" "}
                  <span className="text-texto-suave">
                    {balance.balance_mm >= 0
                      ? es ? "Llovió más de lo que se evaporó: hay reserva más abajo." : "It rained more than evaporated: there is reserve deeper down."
                      : es ? "Se evaporó más de lo que llovió: la reserva de abajo está bajando." : "More evaporated than rained: the deeper reserve is dropping."}
                  </span>
                </span>
              </li>
            )}
          </ul>
        )}
        <p className="mt-3 text-sm leading-snug text-texto-suave">
          {es
            ? "El radar mide los primeros 5 cm. Más abajo es una orientación con lluvia y evaporación (NASA POWER). Reglas del equipo, sin validar con técnicos: consultá a tu técnico."
            : "The radar measures the top 5 cm. Deeper down is guidance from rain and evaporation (NASA POWER). Team rules, not validated by agronomists: ask your advisor."}
        </p>
        <Link
          href={chacra ? `/suelo?chacra=${chacra.id}` : `/suelo?cultivo=${cultivo}`}
          className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-primario px-6 text-base font-bold text-sobre-primario shadow-suave hover:bg-primario-hover"
        >
          {t("conocer")} · {chacra ? chacra.nombre : tr(cfg.nombre)}
        </Link>
      </article>
    </section>
  );
}
