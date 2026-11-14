"use client";
// Pestaña "Clima" — próximamente (pronóstico con NASA POWER / Open-Meteo).
import { useIdioma } from "./idioma";
import Marco from "./Marco";

export default function VistaClima() {
  const { t } = useIdioma();
  return (
    <Marco>
      <section className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-3xl border border-borde bg-tarjeta px-6 py-12 text-center shadow-suave">
        <svg viewBox="0 0 24 24" className="h-14 w-14 text-dorado" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18Z" />
          <path d="M16 3v1.5M20.5 5.5l-1 1M22 10h-1.5" />
          <path d="M9 21l-.5 1M13 21l-.5 1M17 21l-.5 1" className="text-acento" stroke="var(--acento)" />
        </svg>
        <h1 className="mt-4 font-display text-3xl font-semibold">{t("climaTitulo")}</h1>
        <span className="mt-2 rounded-full bg-dorado/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-dorado">
          {t("proximamente")}
        </span>
        <p className="mt-4 text-sm leading-relaxed text-texto-suave">{t("climaTexto")}</p>
      </section>
    </Marco>
  );
}
