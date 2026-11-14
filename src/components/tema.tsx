"use client";
// Modo claro/oscuro. Por defecto sigue al sistema; si el usuario elige, se guarda en localStorage.
// SCRIPT_TEMA corre en <head> antes de pintar para evitar el destello de color equivocado.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "light" | "dark";

export const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const Ctx = createContext<{ tema: Tema; alternar: () => void }>({ tema: "light", alternar: () => {} });

function temaEfectivo(): Tema {
  const elegido = document.documentElement.dataset.theme;
  if (elegido === "light" || elegido === "dark") return elegido;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el tema real solo se conoce en el navegador
    setTema(temaEfectivo());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiarSistema = () => setTema(temaEfectivo());
    mq.addEventListener("change", alCambiarSistema);
    return () => mq.removeEventListener("change", alCambiarSistema);
  }, []);

  const alternar = () => {
    const nuevo: Tema = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    try {
      localStorage.setItem("tema", nuevo);
    } catch {}
    setTema(nuevo);
  };

  return <Ctx.Provider value={{ tema, alternar }}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);

export function BotonTema({ etiquetaClaro, etiquetaOscuro }: { etiquetaClaro: string; etiquetaOscuro: string }) {
  const { tema, alternar } = useTema();
  const oscuro = tema === "dark";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? etiquetaClaro : etiquetaOscuro}
      title={oscuro ? etiquetaClaro : etiquetaOscuro}
      className="grid h-8 w-8 place-items-center rounded-full border border-borde bg-barra text-acento backdrop-blur transition-colors hover:bg-tarjeta-2"
    >
      {oscuro ? (
        // Sol
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Luna
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
