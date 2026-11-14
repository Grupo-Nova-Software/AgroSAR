"use client";
// Cartel de recomendación para el agricultor: un color, un título, UNA frase con el motivo y pocos datos simples.
// Los textos se arman acá a partir de los CÓDIGOS del motor (estado, humedad.estado, temporada.estado),
// así salen cortos y en el idioma elegido. El agua se muestra en % (0,22 m³/m³ = 22 % del volumen del suelo).
import Link from "next/link";
import type { ReactNode } from "react";
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
  children,
}: {
  titulo: string;
  subtitulo?: string;
  analisis?: Analisis;
  umbrales: UmbralesHumedad;
  cultivo: string; // nombre del cultivo para usar dentro de una frase
  children?: ReactNode;
}) {
  const { t, fecha, idioma } = useIdioma();

  if (!analisis) {
    return (
      <section className="rounded-3xl border border-borde bg-tarjeta p-5">
        <h2 className="font-display text-2xl font-bold">{titulo}</h2>
        <div className="mt-3 h-40 animate-pulse rounded-2xl bg-tarjeta-2" />
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

  return (
    <section className="rounded-3xl border border-borde bg-tarjeta p-4 md:p-5">
      <h2 className="font-display text-2xl font-bold leading-tight">{titulo}</h2>
      {subtitulo && <p className="text-base text-texto-suave">{subtitulo}</p>}
      {children}

      {/* Semáforo */}
      <div className={`mt-3 flex items-start gap-3 rounded-2xl p-4 ${oscuro ? "text-[#2b2410]" : "text-white"}`} style={{ background: COLOR[analisis.estado] }}>
        <svg viewBox="0 0 24 24" className="mt-0.5 h-11 w-11 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONO[analisis.estado]}
        </svg>
        <div>
          <p className="font-display text-[1.7rem] font-extrabold leading-tight">{t(`titulo_${analisis.estado}`)}</p>
          <p className="mt-1 text-lg leading-snug">{motivo}</p>
        </div>
      </div>

      {/* Agua en el suelo: medidor */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-base font-bold text-texto-suave">{t("aguaSuelo")}</p>
          <p className="text-right font-display text-2xl font-bold text-acento">
            {t(`agua_${h.estado}` as Clave)}
            {pct !== null && <span className="ml-2 text-lg font-medium text-texto-suave">{pct} %</span>}
          </p>
        </div>
        <div className="relative mt-2 h-4">
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            <div style={{ width: pos(umbrales.bajo_max), background: "var(--agua-seco)" }} />
            <div style={{ width: `calc(${pos(umbrales.optimo_max)} - ${pos(umbrales.bajo_max)})`, background: "var(--agua-bueno)" }} />
            <div className="flex-1" style={{ background: "var(--agua-mojado)" }} />
          </div>
          {h.media_m3m3 !== null && (
            <div className="absolute -top-1.5 h-7 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-texto shadow" style={{ left: pos(h.media_m3m3) }} />
          )}
        </div>
        <div className="mt-1 flex justify-between text-sm font-bold text-texto-suave">
          <span>{t("seco")}</span>
          <span>{t("bueno")}</span>
          <span>{t("mojado")}</span>
        </div>
        {h.tendencia && h.estado !== "sin_datos" && <p className="mt-1 text-base text-texto-suave">↕ {t(`tend_${h.tendencia}` as Clave)}</p>}
      </div>

      {/* Datos cortos */}
      <dl className="mt-4 space-y-2 text-base">
        {h.ultima_fecha && (
          <div className="rounded-2xl bg-tarjeta-2 px-4 py-3">
            <dt className="font-bold text-texto-suave">🛰️ {t("datoDel")}</dt>
            <dd className="text-lg font-bold">
              {fecha(h.ultima_fecha, true)}
              <span className="ml-2 font-normal text-texto-suave">
                ({h.dias_desde_observacion ? t("haceDias", { n: h.dias_desde_observacion }) : t("hoy")})
              </span>
            </dd>
            {h.desactualizada && <dd className="mt-1 font-bold text-peligro">⚠️ {t("datoViejo")}</dd>}
          </div>
        )}
        {te.estado === "fuera" && te.proxima ? (
          <div className="rounded-2xl bg-tarjeta-2 px-4 py-3">
            <dt className="font-bold text-texto-suave">📅 {t("proximaSiembra")}</dt>
            <dd className="text-lg font-bold">{fecha(te.proxima.inicio, true)}</dd>
          </div>
        ) : (
          analisis.semilla?.semilla && (
            <div className="rounded-2xl bg-tarjeta-2 px-4 py-3">
              <dt className="font-bold text-texto-suave">🌱 {t("semilla")}</dt>
              <dd className="text-lg font-bold">
                {analisis.semilla.semilla}
                {analisis.semilla.ciclo_sugerido && (
                  <span className="ml-2 font-normal text-texto-suave">({t("cicloDias", { n: analisis.semilla.ciclo_sugerido.dias })})</span>
                )}
              </dd>
            </div>
          )
        )}
      </dl>

      {consejos.length > 0 && (
        <div className="mt-4">
          <p className="text-base font-bold text-texto-suave">{t("consejos")}</p>
          <ul className="mt-1 space-y-2">
            {consejos.map((a) => (
              <li key={a.id} className="rounded-2xl border-l-[6px] bg-tarjeta-2 px-4 py-3 text-base" style={{ borderColor: a.nivel === "critico" ? "var(--peligro)" : "var(--dorado)" }}>
                <span className="font-bold">{a.titulo}.</span> {a.recomendacion ?? a.detalle}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/ayuda" className="mt-4 inline-block text-base font-bold text-acento underline underline-offset-4">
        {t("masInfo")}
      </Link>
    </section>
  );
}
