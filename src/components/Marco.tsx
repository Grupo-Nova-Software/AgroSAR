"use client";
// Estructura común de todas las páginas: aviso, encabezado (logo centrado + controles en la esquina),
// contenido y barra de pestañas inferior.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import AvisoDatos from "./AvisoDatos";
import { BotonIdioma, useIdioma, type Clave } from "./idioma";
import { BotonTema } from "./tema";

export default function Marco({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { t } = useIdioma();
  return (
    <div className={`flex flex-1 flex-col ${className}`} style={style}>
      <AvisoDatos />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-center px-4 pt-5 sm:px-8 md:pt-8">
        <Link
          href="/"
          className="rounded-xl bg-primario px-7 py-1.5 shadow-suave transition-colors hover:bg-primario-hover md:px-10"
          aria-label="AgroSAR"
        >
          <span className="font-display text-3xl font-semibold tracking-tight text-sobre-primario md:text-4xl">AgroSAR</span>
        </Link>
        <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-6 md:top-5">
          <BotonIdioma />
          <BotonTema etiquetaClaro={t("modoClaro")} etiquetaOscuro={t("modoOscuro")} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-6 sm:px-8 md:pb-32">
        {children}
        <footer className="mt-auto pt-12 text-center text-xs text-texto-suave">{t("pie")}</footer>
      </main>

      <BarraPestanas />
    </div>
  );
}

const PESTANAS: { href: string; clave: Clave; icono: ReactNode }[] = [
  {
    href: "/",
    clave: "navCultivos",
    icono: (
      // Brote
      <path d="M12 22V12m0 0C12 7 8 4 3 4c0 5 4 8 9 8Zm0 0c0-4 3-7 8-7 0 4-3 7-8 7Z" />
    ),
  },
  {
    href: "/suelo",
    clave: "navSuelo",
    icono: (
      // Gota sobre mapa
      <>
        <path d="M12 3s-5 5.5-5 9a5 5 0 0 0 10 0c0-3.5-5-9-5-9Z" />
        <path d="M3 21h18" />
      </>
    ),
  },
  {
    href: "/clima",
    clave: "navClima",
    icono: (
      // Nube con sol
      <>
        <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18Z" />
        <path d="M16 3v1.5M20.5 5.5l-1 1M22 10h-1.5" />
      </>
    ),
  },
];

function BarraPestanas() {
  const { t } = useIdioma();
  const ruta = usePathname();
  return (
    <nav
      aria-label="Menú"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-borde bg-barra pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:rounded-full md:border md:px-2 md:shadow-suave"
    >
      <ul className="mx-auto flex max-w-md justify-around md:gap-1">
        {PESTANAS.map((p) => {
          const activa = p.href === "/" ? ruta === "/" : ruta.startsWith(p.href);
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-5 py-2 text-[11px] font-semibold transition-colors md:flex-row md:gap-2 md:rounded-full md:px-4 md:text-sm ${
                  activa ? "text-acento md:bg-tarjeta-2" : "text-texto-suave hover:text-acento"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {p.icono}
                </svg>
                {t(p.clave)}
                {activa && <span className="mt-0.5 h-1 w-1 rounded-full bg-acento md:hidden" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
