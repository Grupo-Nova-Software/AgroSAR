"use client";
// Idioma ES/EN. Space Apps exige inglés para el jurado; los agricultores usan español.
// Se elige por: preferencia guardada > idioma del navegador > español.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Idioma = "es" | "en";
export type Texto = Record<Idioma, string>;

const TEXTOS = {
  titulo: { es: "Analizá tu suelo.", en: "Analyze your soil." },
  subtitulo: {
    es: "Descubrí qué cultivos se adaptan mejor a tu terreno.",
    en: "Discover which crops best suit your land.",
  },
  conocer: { es: "Conocer cultivo", en: "Explore crop" },
  aviso: {
    es: "Datos de ejemplo / provisionales: todavía no usar para decisiones reales.",
    en: "Sample / provisional data: not yet for real decisions.",
  },
  volver: { es: "Volver", en: "Back" },
  enConstruccion: {
    es: "Página del cultivo en construcción. Recomendaciones de ejemplo por zona:",
    en: "Crop page under construction. Sample recommendations by area:",
  },
  pie: {
    es: "Datos: NISAR (NASA-ISRO, ASF DAAC) y NASA POWER. Proyecto comunitario, no afiliado ni respaldado por NASA.",
    en: "Data: NASA-ISRO NISAR (ASF DAAC) and NASA POWER. Community project, not affiliated with or endorsed by NASA.",
  },
  irACultivo: { es: "Ir al cultivo", en: "Go to crop" },
  cargando: { es: "Cargando…", en: "Loading…" },
} satisfies Record<string, Texto>;

type Clave = keyof typeof TEXTOS;

const Ctx = createContext<{ idioma: Idioma; setIdioma: (i: Idioma) => void }>({ idioma: "es", setIdioma: () => {} });

function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem("idioma");
    if (guardado === "es" || guardado === "en") return guardado;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>("es");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee del navegador solo después de hidratar
    setIdiomaState(idiomaInicial());
  }, []);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  const setIdioma = (i: Idioma) => {
    setIdiomaState(i);
    try {
      localStorage.setItem("idioma", i);
    } catch {}
  };

  return <Ctx.Provider value={{ idioma, setIdioma }}>{children}</Ctx.Provider>;
}

export function useIdioma() {
  const { idioma, setIdioma } = useContext(Ctx);
  const t = (clave: Clave) => TEXTOS[clave][idioma];
  const tr = (texto: Texto) => texto[idioma];
  return { idioma, setIdioma, t, tr };
}

export function SelectorIdioma() {
  const { idioma, setIdioma } = useIdioma();
  return (
    <div role="group" aria-label="Idioma / Language" className="flex overflow-hidden rounded-full border border-verde-principal text-sm">
      {(["es", "en"] as const).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => setIdioma(i)}
          aria-pressed={idioma === i}
          className={`px-3 py-1 font-semibold uppercase transition-colors ${
            idioma === i ? "bg-verde-principal text-white" : "text-verde-principal hover:bg-verde-suave"
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
