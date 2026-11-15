"use client";
// Página principal (diseño: public/imagenes/MainScreen.png).
// Móvil: slider horizontal con snap; el fondo "Del cielo a la raíz" muestra el cultivo visible.
// Escritorio: 3 tarjetas en fila; el fondo muestra el último cultivo bajo el cursor/foco.
// Debajo, tres secciones (cielo, superficie, raíces) que acompañan la bajada del fondo con el scroll.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CULTIVOS } from "./cultivos";
import { FondoGlobal } from "./FondoCultivoScroll";
import { useIdioma, type Clave } from "./idioma";
import Marco from "./Marco";
import { useCultivoGuardado, useZonaGuardada, type CultivoId } from "./preferencias";

const CAPAS: { icono: string; titulo: Clave; texto: Clave; clase: string }[] = [
  { icono: "☀️", titulo: "capaCieloTitulo", texto: "capaCieloTexto", clase: "mt-10 md:mt-16" },
  { icono: "🌱", titulo: "capaSuperficieTitulo", texto: "capaSuperficieTexto", clase: "mt-[38vh]" },
  { icono: "🪱", titulo: "capaRaizTitulo", texto: "capaRaizTexto", clase: "mt-[48vh]" },
];

export default function PantallaPrincipal() {
  const { t, tr } = useIdioma();
  const [activo, setActivo] = useState(0); // tarjeta centrada en el slider (móvil)
  // Cultivo compartido con Mi suelo y Clima (se recuerda en el teléfono). En escritorio, pasar el cursor
  // sobre una tarjeta solo muestra ese cultivo en el fondo; tocarla lo elige.
  const [guardado, guardar] = useCultivoGuardado();
  const [zona] = useZonaGuardada();
  const [vistaPrevia, setVistaPrevia] = useState<CultivoId | null>(null);
  const fondo: CultivoId = vistaPrevia ?? guardado ?? CULTIVOS[0].id;
  const sliderRef = useRef<HTMLUListElement>(null);

  // Al volver a Inicio, el slider abre en el cultivo elegido (una sola vez, sin animación).
  const ubicado = useRef(false);
  useEffect(() => {
    const el = sliderRef.current;
    if (!guardado || ubicado.current || !el) return;
    ubicado.current = true;
    const i = CULTIVOS.findIndex((c) => c.id === guardado);
    const hijo = el.children[i] as HTMLElement | undefined;
    if (hijo && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: hijo.offsetLeft + hijo.offsetWidth / 2 - el.clientWidth / 2, behavior: "instant" });
    }
  }, [guardado]);

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
    // Deslizar el slider (celular) es elegir: el fondo y las demás pestañas pasan a ese cultivo.
    if (ubicado.current || !guardado) guardar(CULTIVOS[mejor].id);
  };

  const irA = (i: number) => {
    const hijo = sliderRef.current?.children[i] as HTMLElement | undefined;
    hijo?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <Marco fondo={<FondoGlobal cultivo={fondo} zona={zona} />}>
      <section className="sobre-fondo mx-auto w-fit max-w-full rounded-3xl px-6 py-4 text-center">
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
            onMouseEnter={() => setVistaPrevia(c.id)}
            onMouseLeave={() => setVistaPrevia(null)}
            onFocus={() => setVistaPrevia(c.id)}
            onBlur={() => setVistaPrevia(null)}
          >
            <Link
              href={`/suelo?cultivo=${c.id}`}
              onClick={() => guardar(c.id)}
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

      {/* Del cielo a la raíz: cada sección coincide con un estrato del fondo */}
      <section aria-labelledby="historia" className="mx-auto w-full max-w-xl">
        <div className="sobre-fondo mt-10 rounded-3xl px-5 py-4 text-center md:mt-14">
          <h2 id="historia" className="font-display text-2xl font-bold tracking-tight text-texto md:text-3xl">
            {t("historiaTitulo")}
          </h2>
          <p className="mt-1 text-base text-texto-suave">
            {t("historiaBajar")} <span aria-hidden>↓</span>
          </p>
        </div>
        {CAPAS.map((c) => (
          <article key={c.titulo} className={`sobre-fondo rounded-3xl p-5 ${c.clase}`}>
            <h3 className="flex items-center gap-2 font-display text-xl font-bold text-texto md:text-2xl">
              <span aria-hidden>{c.icono}</span>
              {t(c.titulo)}
            </h3>
            <p className="mt-2 text-lg leading-snug text-texto">{t(c.texto)}</p>
          </article>
        ))}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/suelo?cultivo=${fondo}`}
            className="flex min-h-14 items-center rounded-full bg-primario px-7 text-lg font-bold text-sobre-primario shadow-suave hover:bg-primario-hover"
          >
            {t("conocer")} · {tr(CULTIVOS.find((c) => c.id === fondo)!.nombre)}
          </Link>
        </div>
      </section>

      <p className="sobre-fondo mx-auto mt-[22vh] w-fit max-w-xl rounded-2xl px-4 py-2 text-center text-sm text-texto-suave">{t("pie")}</p>
    </Marco>
  );
}
