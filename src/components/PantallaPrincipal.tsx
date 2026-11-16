"use client";
// Página principal (diseño: public/imagenes/MainScreen.png).
// Móvil: slider horizontal con snap; el fondo "Del cielo a la raíz" muestra el cultivo visible.
// Escritorio: 3 tarjetas en fila; el fondo muestra el último cultivo bajo el cursor/foco.
// Debajo, las recomendaciones de hoy (cielo, superficie, raíces) con datos reales: RecomendacionesInicio.tsx.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { centroDeChacra, fueraDeItapua, useChacras } from "./chacras";
import { CULTIVOS } from "./cultivos";
import { FondoGlobal } from "./FondoCultivoScroll";
import InstalarApp from "./InstalarApp";
import { useIdioma } from "./idioma";
import Marco from "./Marco";
import { useCultivoGuardado, type CultivoId } from "./preferencias";
import RecomendacionesInicio from "./RecomendacionesInicio";

export default function PantallaPrincipal() {
  const { t, tr } = useIdioma();
  const [activo, setActivo] = useState(0); // tarjeta centrada en el slider (móvil)
  // Cultivo compartido con Mi suelo y Clima (se recuerda en el teléfono). En escritorio, pasar el cursor
  // sobre una tarjeta solo muestra ese cultivo en el fondo; tocarla lo elige.
  const [guardado, guardar] = useCultivoGuardado();
  const [vistaPrevia, setVistaPrevia] = useState<CultivoId | null>(null);
  const fondo: CultivoId = vistaPrevia ?? guardado ?? CULTIVOS[0].id;
  // El cielo del fondo es el del lugar del agricultor: su chacra de ese cultivo o, si no tiene, el centro de Itapúa.
  const { chacras } = useChacras();
  const chacraFondo = chacras.find((c) => c.cultivo === fondo && !fueraDeItapua(c));
  const puntoFondo = chacraFondo ? centroDeChacra(chacraFondo) : null;
  const sliderRef = useRef<HTMLUListElement>(null);

  // Al volver a Inicio, el slider abre en el cultivo elegido (una sola vez, sin animación).
  const ubicado = useRef(false);
  const espera = useRef<number | undefined>(undefined);
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
    if (mejor !== activo) setActivo(mejor);
    // Deslizar el slider (celular) es elegir: el fondo y las demás pestañas pasan a ese cultivo.
    // Se espera a que el dedo se detenga: cambiar el fondo entero en cada píxel del deslizamiento trababa el teléfono.
    if (ubicado.current || !guardado) {
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(() => guardar(CULTIVOS[mejor].id), 280);
    }
  };

  const irA = (i: number) => {
    const hijo = sliderRef.current?.children[i] as HTMLElement | undefined;
    hijo?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <Marco fondo={<FondoGlobal cultivo={fondo} punto={puntoFondo} />}>
      <section className="sobre-fondo mx-auto w-fit max-w-full rounded-3xl px-6 py-4 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-texto md:text-6xl">{t("titulo")}</h1>
        <p className="mt-2 text-lg text-texto-suave">{t("subtitulo")}</p>
      </section>
      <InstalarApp className="mt-3" ofrecer />

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
              className="group relative isolate flex aspect-[3/4] flex-col items-center justify-between overflow-hidden rounded-2xl p-5 text-center text-white shadow-suave transition-transform duration-300 md:aspect-[4/3] md:hover:-translate-y-1"
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

      {/* Al bajar: qué hacer hoy, con el clima y el radar NISAR (cada bloque coincide con un estrato del fondo) */}
      <RecomendacionesInicio cultivo={fondo} />

      <p className="sobre-fondo mx-auto mt-[22vh] w-fit max-w-xl rounded-2xl px-4 py-2 text-center text-sm text-texto-suave">{t("pie")}</p>
    </Marco>
  );
}
