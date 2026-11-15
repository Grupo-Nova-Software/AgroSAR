"use client";
// Cartel de recomendación para el agricultor: un color, un título, UNA frase con el motivo y pocos datos simples.
// Los textos se arman acá a partir de los CÓDIGOS del motor (estado, humedad.estado, temporada.estado),
// así salen cortos y en el idioma elegido. El agua se muestra en % (0,22 m³/m³ = 22 % del volumen del suelo).
import Link from "next/link";
import type { ReactNode } from "react";
import Icono, { Dibujo } from "../Icono";
import { useIdioma, type Clave } from "../idioma";
import type { Analisis, UmbralesHumedad } from "./api";

const COLOR = { sembrar: "var(--primario)", esperar: "var(--dorado)", precaucion: "var(--peligro)" } as const;
const ICONO: Record<Analisis["estado"], ReactNode> = {
  sembrar: <path d="M5 13l4.5 4.5L19 7.5" />,
  esperar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  precaucion: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
};
const ESCALA_MAX = 0.5;

export default function Consejo({
  titulo,
  subtitulo,
  analisis,
  umbrales,
  cultivo,
  marca,
  aviso,
  children,
  pie,
}: {
  titulo: string;
  subtitulo?: string;
  analisis?: Analisis;
  umbrales: UmbralesHumedad;
  cultivo: string; // nombre del cultivo para usar dentro de una frase
  marca?: string; // color distintivo de la chacra
  aviso?: ReactNode; // p. ej. "sin internet: dato guardado"
  children?: ReactNode;
  pie?: ReactNode; // al final de la tarjeta (editor de la chacra)
}) {
  const { t, fecha, idioma } = useIdioma();

  const encabezado = (
    <h2 className="flex items-center gap-2 font-display text-xl font-bold leading-tight">
      {marca && <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-texto/15" style={{ background: marca }} aria-hidden />}
      {titulo}
    </h2>
  );

  if (!analisis) {
    return (
      <section className="rounded-2xl border border-borde bg-tarjeta p-4 shadow-suave md:p-5">
        {encabezado}
        {aviso}
        {children}
        <div className="mt-3 h-40 animate-pulse rounded-xl bg-tarjeta-2" />
        {pie}
      </section>
    );
  }

  const h = analisis.humedad;
  const te = analisis.temporada;
  const motivo = (() => {
    if (h.estado === "sin_datos") return t("motivo_sin_datos");
    if (te.estado === "fuera") return te.proxima ? t("motivo_fuera", { cultivo, fecha: fecha(te.proxima.inicio, true) }) : t("motivo_fuera_sin", { cultivo });
    if (te.estado === "temprana") return t("motivo_temprana", { n: te.dias_fuera ?? 0 });
    if (te.estado === "tardia") return t("motivo_tardia", { n: te.dias_fuera ?? 0 });
    if (h.estado === "seco" || h.estado === "bajo") return t("motivo_seco");
    if (h.estado === "saturado") return t("motivo_saturado");
    if (te.estado === "tramo_tardio") return t("motivo_tramo", { n: te.dias_restantes ?? 0 });
    return t("motivo_bien");
  })();

  const pct = h.media_m3m3 === null ? null : Math.round(h.media_m3m3 * 100);
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / ESCALA_MAX) * 100))}%`;
  // Consejos del motor (solo en español por ahora): los importantes que no sean de temporada, que ya se explica arriba.
  const consejos =
    idioma === "es"
      ? analisis.alertas.filter((a) => a.nivel !== "info" && a.categoria !== "temporada" && (a.recomendacion || a.titulo)).slice(0, 2)
      : [];
  const oscuro = analisis.estado === "esperar";

  const tonoAgua = h.estado === "seco" || h.estado === "bajo" ? "seco" : h.estado === "optimo" ? "bueno" : "mojado";
  // Barra del agua: los tres colores se funden de a poco (no hay un corte duro entre seco, bueno y mojado)
  const p1 = (umbrales.bajo_max / ESCALA_MAX) * 100;
  const p2 = (umbrales.optimo_max / ESCALA_MAX) * 100;
  const barra = `linear-gradient(90deg, var(--agua-seco) 0%, var(--agua-seco) ${p1 - 16}%, var(--agua-bueno) ${p1 + 9}%, var(--agua-bueno) ${p2 - 9}%, var(--agua-mojado) ${p2 + 16}%, var(--agua-mojado) 100%)`;
  const fila = "flex items-start gap-3 py-2.5";

  return (
    <section className="rounded-2xl border border-borde bg-tarjeta p-4 shadow-suave md:p-5">
      {encabezado}
      {subtitulo && <p className="text-base text-texto-suave">{subtitulo}</p>}
      {aviso}
      {children}

      {/* Semáforo */}
      <div className={`mt-3 flex items-start gap-3 rounded-xl p-3.5 ${oscuro ? "text-[#2b2410]" : "text-white"}`} style={{ background: COLOR[analisis.estado] }}>
        <svg viewBox="0 0 24 24" className="mt-0.5 h-9 w-9 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONO[analisis.estado]}
        </svg>
        <div>
          <p className="font-display text-2xl font-extrabold leading-tight">{t(`titulo_${analisis.estado}`)}</p>
          <p className="mt-0.5 text-base leading-snug">{motivo}</p>
        </div>
      </div>

      {/* Agua en el suelo: medidor */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-base font-bold text-texto-suave">{t("aguaSuelo")}</p>
          <p className="text-right font-display text-xl font-bold" style={{ color: `var(--agua-${tonoAgua}-texto)` }}>
            {t(`agua_${h.estado}` as Clave)}
            {pct !== null && <span className="ml-2 text-base font-medium text-texto-suave">{pct} %</span>}
          </p>
        </div>
        <div className="relative mt-2 h-3">
          <div className="absolute inset-0 rounded-full" style={{ background: barra }} />
          {h.media_m3m3 !== null && (
            <div className="absolute -top-1.5 h-6 w-6 -translate-x-1/2 rounded-full border-[3px] border-white bg-texto shadow-md" style={{ left: pos(h.media_m3m3) }} />
          )}
        </div>
        <div className="mt-2 grid grid-cols-3 items-end text-sm text-texto-suave">
          {([["seco", "suelo-seco", "text-left"], ["bueno", "suelo-bueno", "text-center"], ["mojado", "suelo-mojado", "text-right"]] as const).map(([k, d, alin]) => (
            <span key={k} className={`flex flex-col gap-0.5 ${k === "seco" ? "items-start" : k === "bueno" ? "items-center" : "items-end"} ${alin} ${tonoAgua === k ? "font-bold text-texto" : ""}`}>
              <Dibujo nombre={d} className={`h-9 w-9 ${tonoAgua === k ? "" : "opacity-55 grayscale-[.4]"}`} />
              {t(k)}
            </span>
          ))}
        </div>
        {h.tendencia && h.estado !== "sin_datos" && <p className="mt-1 text-sm text-texto-suave">{t(`tend_${h.tendencia}` as Clave)}</p>}
      </div>

      {/* Datos cortos: una fila por dato, sin cajas */}
      <dl className="mt-3 divide-y divide-borde border-y border-borde text-base">
        {h.ultima_fecha && (
          <div className={fila}>
            <Icono nombre="satelite" className="mt-0.5 h-5 w-5 text-texto-suave" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-texto-suave">{t("datoDel")}</dt>
                <dd className="font-bold">
                  {fecha(h.ultima_fecha, true)}
                  <span className="ml-1.5 font-normal text-texto-suave">· {h.dias_desde_observacion ? t("haceDias", { n: h.dias_desde_observacion }) : t("hoy")}</span>
                </dd>
              </div>
              {h.desactualizada && <dd className="mt-0.5 text-sm font-bold text-peligro">{t("datoViejo")}</dd>}
            </div>
          </div>
        )}
        {te.estado === "fuera" && te.proxima ? (
          <div className={fila}>
            <Icono nombre="calendario" className="mt-0.5 h-5 w-5 text-texto-suave" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-texto-suave">{t("proximaSiembra")}</dt>
              <dd className="font-bold">{fecha(te.proxima.inicio, true)}</dd>
            </div>
          </div>
        ) : (
          analisis.semilla?.semilla && (
            <div className={fila}>
              <Icono nombre="semilla" className="mt-0.5 h-5 w-5 text-texto-suave" />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                <dt className="text-texto-suave">{t("semilla")}</dt>
                <dd className="font-bold">
                  {analisis.semilla.semilla}
                  {analisis.semilla.ciclo_sugerido && (
                    <span className="ml-1.5 font-normal text-texto-suave">· {t("cicloDias", { n: analisis.semilla.ciclo_sugerido.dias })}</span>
                  )}
                </dd>
              </div>
            </div>
          )
        )}
      </dl>

      {consejos.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-texto-suave">{t("consejos")}</p>
          <ul className="mt-1 space-y-2">
            {consejos.map((a) => (
              <li key={a.id} className="rounded-lg border-l-4 bg-tarjeta-2 px-3 py-2.5 text-base leading-snug" style={{ borderColor: a.nivel === "critico" ? "var(--peligro)" : "var(--dorado)" }}>
                <span className="font-bold">{a.titulo}.</span> {a.recomendacion ?? a.detalle}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pie}

      <Link href="/ayuda" className="mt-3 inline-block text-sm font-bold text-acento underline underline-offset-4">
        {t("masInfo")}
      </Link>
    </section>
  );
}
