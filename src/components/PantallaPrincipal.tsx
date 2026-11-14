"use client";
// Página principal (diseño: public/imagenes/MainScreen.png).
// Móvil: slider horizontal con snap; el fondo toma el color del cultivo visible.
// Escritorio: 3 tarjetas en fila; el fondo toma el color del cultivo bajo el cursor/foco.
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { CULTIVOS, fondoDe } from "./cultivos";
import { useIdioma } from "./idioma";
import Marco from "./Marco";

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
    "--fondo-movil": fondoDe(CULTIVOS[activo].id),
    "--fondo-escritorio": enfocado !== null ? fondoDe(CULTIVOS[enfocado].id) : "var(--fondo)",
  } as CSSProperties;

  return (
    <Marco
      className="bg-[var(--fondo-movil)] transition-colors duration-500 ease-out md:bg-[var(--fondo-escritorio)]"
      style={fondos}
    >
      <section className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-texto md:text-6xl">{t("titulo")}</h1>
        <p className="mt-2 text-lg text-texto-suave">{t("subtitulo")}</p>
      </section>

      <ul
        ref={sliderRef}
        onScroll={alDesplazar}
        className="slider-sin-barra -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[9%] pb-2 md:mx-0 md:mt-10 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0"
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
              href={`/suelo?cultivo=${c.id}`}
              aria-label={`${t("irACultivo")} ${tr(c.nombre)}`}
              className="group relative isolate flex aspect-[3/4] flex-col items-center justify-between overflow-hidden rounded-3xl p-5 text-center text-white shadow-suave transition-transform duration-300 md:aspect-[4/3] md:hover:-translate-y-1"
            >
              <Image
                src={c.imagen}
                alt=""
                fill
                priority={i === 0}
                sizes="(max-width: 767px) 82vw, 33vw"
                className="-z-10 object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Degradado para legibilidad del texto sobre la foto */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/5 to-black/45" />

              <div className="mt-3">
                <h2 className="font-display text-4xl font-bold tracking-tight drop-shadow-md">{tr(c.nombre)}</h2>
                <p className="mx-auto mt-1 max-w-[24ch] text-base font-bold text-white drop-shadow-md">{tr(c.descripcion)}</p>
              </div>

              <span className="mb-3 rounded-full bg-white px-6 py-3 text-lg font-bold text-[#1f5936] shadow-lg">
                {t("conocer")}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Puntos de posición del slider (solo móvil) */}
      <div className="mt-4 flex justify-center gap-2 md:hidden">
        {CULTIVOS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => irA(i)}
            aria-label={tr(c.nombre)}
            aria-current={activo === i}
            className={`h-2.5 rounded-full transition-all ${activo === i ? "w-6 bg-primario" : "w-2.5 bg-texto-suave/40"}`}
          />
        ))}
      </div>
      <p className="mt-auto pt-10 text-center text-sm text-texto-suave">{t("pie")}</p>
    </Marco>
  );
}
