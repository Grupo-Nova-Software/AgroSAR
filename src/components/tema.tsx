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
