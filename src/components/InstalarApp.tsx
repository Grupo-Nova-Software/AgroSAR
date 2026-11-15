"use client";
// Botón «Instalar app»: deja AgroSAR en la pantalla del teléfono, con su ícono y su nombre, como cualquier aplicación.
// - Android / Chrome / Edge: el navegador avisa que se puede instalar (`beforeinstallprompt`) y el botón abre su cartel.
// - iPhone / iPad (Safari) y navegadores sin ese aviso: el botón muestra los dos pasos para hacerlo a mano.
// - Si ya está instalada (se abrió desde el ícono), el botón no aparece.
import { useEffect, useState } from "react";
import Icono from "./Icono";
import { useIdioma } from "./idioma";

interface AvisoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// El aviso del navegador puede llegar antes de que el botón exista: se guarda acá y se avisa a quien esté mirando.
let aviso: AvisoInstalar | null = null;
const oyentes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    oyentes.forEach((f) => f());
  });
}

const yaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function InstalarApp({ className = "" }: { className?: string }) {
  const { idioma } = useIdioma();
  const es = idioma === "es";
  const [estado, setEstado] = useState<"oculto" | "listo" | "instalada">("oculto");
  const [, refrescar] = useState(0);
  const [pasos, setPasos] = useState(false);

  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    const alInstalar = () => setEstado("instalada");
    window.addEventListener("appinstalled", alInstalar);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- solo se sabe en el navegador
    setEstado(yaInstalada() ? "instalada" : "listo");
    return () => {
      oyentes.delete(f);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (estado !== "listo") return null;

  const instalar = async () => {
    if (!aviso) {
      setPasos((v) => !v);
      return;
    }
    await aviso.prompt();
    const { outcome } = await aviso.userChoice;
    aviso = null;
    if (outcome === "accepted") setEstado("instalada");
  };

  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={instalar}
        aria-expanded={aviso ? undefined : pasos}
        className="mx-auto flex min-h-12 items-center justify-center gap-2 rounded-full bg-primario px-5 text-base font-bold text-sobre-primario shadow-suave hover:bg-primario-hover"
      >
        <Icono nombre="descargar" />
        {es ? "Instalar app" : "Install app"}
      </button>
      {pasos && !aviso && (
        <ol className="sobre-fondo mx-auto mt-2 max-w-xs list-decimal space-y-1 rounded-xl bg-tarjeta py-3 pl-8 pr-4 text-left text-base leading-snug text-texto">
          {esIOS ? (
            <>
              <li>{es ? "Tocá el botón Compartir (el cuadrado con una flecha hacia arriba)." : "Tap the Share button (the square with an arrow pointing up)."}</li>
              <li>{es ? "Elegí «Agregar a inicio»." : "Choose “Add to Home Screen”."}</li>
            </>
          ) : (
            <>
              <li>{es ? "Abrí el menú del navegador (los tres puntitos)." : "Open the browser menu (the three dots)."}</li>
              <li>{es ? "Tocá «Instalar app» o «Agregar a pantalla de inicio»." : "Tap “Install app” or “Add to Home screen”."}</li>
            </>
          )}
        </ol>
      )}
    </div>
  );
}
