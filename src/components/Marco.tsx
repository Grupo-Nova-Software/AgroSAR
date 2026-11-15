"use client";
// Estructura común: botón "Menú" arriba a la izquierda, contenido y pestañas abajo.
// variante "inicio": muestra el logo. variante "compacta": sin logo, para dejarle el lugar al mapa
// (muestra el cultivo elegido, que se cambia desde el menú).
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CULTIVOS } from "./cultivos";
import { useIdioma, type Clave, type Idioma } from "./idioma";
import Logo, { MarcaAgroSAR } from "./Logo";
import { useTema } from "./tema";

const ICONOS = {
  inicio: <path d="M12 22V12m0 0C12 7 8 4 3 4c0 5 4 8 9 8Zm0 0c0-4 3-7 8-7 0 4-3 7-8 7Z" />,
  suelo: (
    <>
      <path d="M12 3s-5 5.5-5 9a5 5 0 0 0 10 0c0-3.5-5-9-5-9Z" />
      <path d="M3 21h18" />
    </>
  ),
  chacras: (
    <>
      <path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
      <path d="M3 14h18M9 20v-6M15 20v-6" />
    </>
  ),
  clima: (
    <>
      <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18Z" />
      <path d="M16 3v1.5M20.5 5.5l-1 1M22 10h-1.5" />
    </>
  ),
  ayuda: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
    </>
  ),
};

function Icono({ children, className = "h-6 w-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const PESTANAS: { href: string; clave: Clave; icono: ReactNode }[] = [
  { href: "/", clave: "navCultivos", icono: ICONOS.inicio },
  { href: "/suelo", clave: "navSuelo", icono: ICONOS.suelo },
  { href: "/chacras", clave: "navChacras", icono: ICONOS.chacras },
  { href: "/clima", clave: "navClima", icono: ICONOS.clima },
];

export default function Marco({
  children,
  variante = "inicio",
  cultivo,
  className = "",
  style,
}: {
  children: ReactNode;
  variante?: "inicio" | "compacta";
  cultivo?: string; // cultivo elegido (se muestra en la barra compacta y se marca en el menú)
  className?: string;
  style?: CSSProperties;
}) {
  const { t, tr } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const actual = CULTIVOS.find((c) => c.id === cultivo);

  return (
    <div className={`flex flex-1 flex-col ${className}`} style={style}>
      <header
        className={`relative mx-auto flex w-full max-w-6xl items-center px-3 sm:px-8 ${
          variante === "inicio" ? "justify-center pt-4 md:pt-7" : "justify-between gap-3 py-2 md:py-3"
        }`}
      >
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          className={`flex h-11 items-center gap-2 rounded-full border border-borde bg-barra px-4 text-base font-bold text-texto shadow-suave backdrop-blur ${
            variante === "inicio" ? "absolute left-3 top-4 sm:left-8 md:top-7" : ""
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          {t("menu")}
        </button>

        {variante === "inicio" ? (
          <Link href="/" aria-label="AgroSAR" className="mt-14 sm:mt-0">
            <Logo grande />
          </Link>
        ) : (
          actual && (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              aria-label={`${t("cambiarCultivo")}: ${tr(actual.nombre)}`}
              className="flex h-11 items-center gap-2 rounded-full bg-primario py-1 pl-1 pr-4 text-base font-bold text-sobre-primario shadow-suave"
            >
              <Image src={actual.imagen} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
              {tr(actual.nombre)}
            </button>
          )
        )}
      </header>

      <main className={`mx-auto flex w-full max-w-6xl flex-1 flex-col pb-24 md:pb-28 ${variante === "inicio" ? "px-4 pt-6 sm:px-8" : ""}`}>
        {children}
      </main>

      <BarraPestanas />
      {abierto && <Menu cultivo={cultivo} alCerrar={() => setAbierto(false)} />}
    </div>
  );
}

function BarraPestanas() {
  const { t } = useIdioma();
  const ruta = usePathname();
  return (
    <nav
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-borde bg-barra pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2 md:rounded-full md:border md:px-2 md:shadow-suave"
    >
      <ul className="mx-auto flex max-w-md justify-around md:gap-1">
        {PESTANAS.map((p) => {
          const activa = p.href === "/" ? ruta === "/" : ruta.startsWith(p.href);
          return (
            <li key={p.href} className="flex-1 md:flex-none">
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[13px] font-bold transition-colors md:flex-row md:gap-2 md:rounded-full md:px-5 md:text-sm ${
                  activa ? "text-acento md:bg-tarjeta-2" : "text-texto-suave hover:text-acento"
                }`}
              >
                <Icono className={`h-6 w-6 ${activa ? "" : "opacity-80"}`}>{p.icono}</Icono>
                {t(p.clave)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Menu({ cultivo, alCerrar }: { cultivo?: string; alCerrar: () => void }) {
  const { t, tr, idioma, setIdioma } = useIdioma();
  const { tema, alternar } = useTema();
  const ruta = usePathname();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [alCerrar]);

  const fila = "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-lg font-bold";
  const enlaces: { href: string; clave: Clave; icono: ReactNode }[] = [...PESTANAS, { href: "/ayuda", clave: "navAyuda", icono: ICONOS.ayuda }];

  return (
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label={t("menu")}>
      <button type="button" aria-label={t("cerrar")} onClick={alCerrar} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-y-0 left-0 flex w-[86vw] max-w-sm flex-col overflow-y-auto bg-fondo p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-2xl tracking-tight text-acento">
            <MarcaAgroSAR className="h-8 w-8" />
            <span>
              <span className="font-medium">Agro</span>
              <span className="font-extrabold">SAR</span>
            </span>
          </span>
          <button type="button" onClick={alCerrar} className="flex h-11 items-center gap-1 rounded-full border border-borde px-4 font-bold">
            ✕ {t("cerrar")}
          </button>
        </div>

        <h2 className="mt-6 px-3 text-sm font-bold text-texto-suave">{t("miCultivo")}</h2>
        <ul className="mt-1 space-y-1">
          {CULTIVOS.map((c) => {
            const sel = c.id === cultivo;
            return (
              <li key={c.id}>
                <Link
                  href={`/suelo?cultivo=${c.id}`}
                  onClick={alCerrar}
                  aria-current={sel ? "true" : undefined}
                  className={`${fila} ${sel ? "bg-primario text-sobre-primario" : "bg-tarjeta text-texto hover:bg-tarjeta-2"}`}
                >
                  <Image src={c.imagen} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                  {tr(c.nombre)}
                  {sel && <span className="ml-auto text-xl" aria-hidden>✓</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-6 px-3 text-sm font-bold text-texto-suave">{t("irA")}</h2>
        <ul className="mt-1 space-y-1">
          {enlaces.map((e) => {
            const activa = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
            return (
              <li key={e.href}>
                <Link
                  href={e.href === "/suelo" && cultivo ? `/suelo?cultivo=${cultivo}` : e.href}
                  onClick={alCerrar}
                  className={`${fila} ${activa ? "bg-tarjeta-2 text-acento" : "text-texto hover:bg-tarjeta"}`}
                >
                  <Icono className="h-7 w-7">{e.icono}</Icono>
                  {t(e.clave)}
                </Link>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-6 px-3 text-sm font-bold text-texto-suave">{t("ajustes")}</h2>
        <div className="mt-1 space-y-2 px-1">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("idioma")}>
            {(["es", "en"] as Idioma[]).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdioma(i)}
                aria-pressed={idioma === i}
                className={`h-12 rounded-2xl border-2 text-base font-bold ${
                  idioma === i ? "border-primario bg-tarjeta-2 text-acento" : "border-borde text-texto"
                }`}
              >
                {i === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tema === "dark"}
            onClick={alternar}
            className="flex h-12 w-full items-center justify-between rounded-2xl border-2 border-borde px-4 text-base font-bold"
          >
            {t("modoOscuro")}
            <span className={`relative h-7 w-12 rounded-full transition-colors ${tema === "dark" ? "bg-primario" : "bg-borde"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${tema === "dark" ? "left-6" : "left-1"}`} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
