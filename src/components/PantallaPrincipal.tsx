"use client";
// Página principal (diseño: public/imagenes/MainScreen.png).
// Móvil: slider horizontal con snap; el fondo toma el color del cultivo visible.
// Escritorio: 3 tarjetas en fila; el fondo toma el color del cultivo bajo el cursor/foco.
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { CULTIVOS } from "./cultivos";
import { SelectorIdioma, useIdioma } from "./idioma";
import AvisoDatos from "./AvisoDatos";

const FONDO_BASE = "var(--blanco)";

export default function PantallaPrincipal() {
  const { t, tr } = useIdioma();
  const [activo, setActivo] = useState(0); // tarjeta centrada en el slider (móvil)
  const [enfocado, setEnfocado] = useState<number | null>(null); // hover/foco (escritorio)
  const sliderRef = useRef<HTMLUListElement>(null);

  // Detecta qué tarjeta está más cerca del centro del slider.
  const alDesplazar = () => {
    const el = sliderRef.current;
    if (!el) return;
    const centro = el.scrollLeft + el.clientWidth / 2;
    let mejor = 0;
    let distMin = Infinity;
    Array.from(el.children).forEach((hijo, i) => {
      const h = hijo as HTMLElement;
      const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - centro);
      if (d < distMin) {
        distMin = d;
        mejor = i;
      }
    });
    setActivo(mejor);
  };

  const irA = (i: number) => {
    const hijo = sliderRef.current?.children[i] as HTMLElement | undefined;
    hijo?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  // Móvil y escritorio usan variables distintas: CSS elige según el ancho, sin esperar a JavaScript.
  const fondos = {
    "--fondo-movil": CULTIVOS[activo].fondo,
    "--fondo-escritorio": enfocado !== null ? CULTIVOS[enfocado].fondo : FONDO_BASE,
  } as CSSProperties;

  return (
    <div
      className="flex flex-1 flex-col bg-[var(--fondo-movil)] transition-colors duration-500 ease-out md:bg-[var(--fondo-escritorio)]"
      style={fondos}
    >
      <AvisoDatos />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-8 md:pt-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 max-w-xs items-center justify-center rounded-lg bg-verde-principal px-6 py-2 shadow-sm md:max-w-[18rem]">
            <span className="font-logo text-4xl leading-none text-white">AgroSAR</span>
          </div>
          <div className="shrink-0">
            <SelectorIdioma />
          </div>
        </header>

        <section className="mt-8 text-center md:max-w-[18rem]">
          <h1 className="text-3xl font-semibold text-gris-carbon md:text-[2rem]">{t("titulo")}</h1>
          <p className="mt-1 text-sm text-muted">{t("subtitulo")}</p>
        </section>

        <ul
          ref={sliderRef}
          onScroll={alDesplazar}
          className="slider-sin-barra -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[9%] pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0"
        >
          {CULTIVOS.map((c, i) => (
            <li
              key={c.id}
              className="w-[82%] shrink-0 snap-center md:w-auto"
              onMouseEnter={() => setEnfocado(i)}
              onMouseLeave={() => setEnfocado(null)}
              onFocus={() => setEnfocado(i)}
              onBlur={() => setEnfocado(null)}
            >
              <Link
                href={`/cultivo/${c.id}`}
                aria-label={`${t("irACultivo")}: ${tr(c.nombre)}`}
                className="group relative isolate flex aspect-[3/4] flex-col items-center justify-between overflow-hidden rounded-2xl p-5 text-center text-white shadow-md transition-transform duration-300 md:aspect-[4/3] md:hover:-translate-y-1 md:hover:shadow-lg"
              >
                <Image
                  src={c.imagen}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="(max-width: 767px) 82vw, 33vw"
                  className="-z-10 object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Degradado para legibilidad del texto sobre la foto */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/10 to-black/30" />

                <div className="mt-2">
                  <h2 className="text-3xl font-bold drop-shadow-md md:text-[1.75rem]">{tr(c.nombre)}</h2>
                  {c.descripcion && <p className="mt-1 text-sm font-semibold drop-shadow-md">{tr(c.descripcion)}</p>}
                </div>

                <span className="mb-4 rounded-lg bg-verde-suave/90 px-4 py-1.5 text-sm font-semibold text-verde-profundo shadow transition-colors group-hover:bg-white">
                  {t("conocer")}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Puntos de posición del slider (solo móvil) */}
        <nav aria-label="Slider" className="mt-4 flex justify-center gap-2 md:hidden">
          {CULTIVOS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => irA(i)}
              aria-label={tr(c.nombre)}
              aria-current={activo === i}
              className={`h-2.5 rounded-full transition-all ${activo === i ? "w-6 bg-verde-principal" : "w-2.5 bg-verde-profundo/30"}`}
            />
          ))}
        </nav>

        <footer className="mt-auto pt-12 text-center text-xs text-muted">{t("pie")}</footer>
      </main>
    </div>
  );
}
