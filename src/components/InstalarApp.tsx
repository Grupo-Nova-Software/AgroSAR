"use client";
// «Instalar app»: deja AgroSAR en la pantalla del teléfono, con su ícono y su nombre, como cualquier aplicación.
// Cómo funciona de verdad (límites del navegador, no de la app):
// - Android (Chrome, Edge, Samsung Internet): el navegador avisa que la página se puede instalar (`beforeinstallprompt`).
//   Recién ahí una página puede abrir el cartel de instalación; el usuario confirma y queda instalada. No existe
//   forma de instalar sin esa confirmación.
// - iPhone / iPad: Apple no deja que una página abra ese cartel. Solo se puede con Compartir → «Agregar a inicio».
// - Navegadores dentro de otras apps (Instagram, Facebook): no pueden instalar; hay que abrir la página en Chrome o Safari.
// Qué hace esto:
// - `<InstalarApp />` es el botón. Si el navegador ya ofreció instalar, abre el cartel directo. Si no, abre la ventana
//   con los pasos para ese teléfono.
// - Con `ofrecer`, en teléfonos la ventana aparece sola una vez (a los pocos segundos) y no vuelve por 14 días si se cierra.
// - Si la app ya está instalada (se abrió desde su ícono), no aparece nada.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icono from "./Icono";
import { useIdioma } from "./idioma";

interface AvisoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// El aviso del navegador puede llegar antes de que el botón exista: se guarda acá y se avisa a quien esté mirando.
let aviso: AvisoInstalar | null = null;
let instalada = false;
const oyentes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    instalada = true;
    oyentes.forEach((f) => f());
  });
}

const yaInstalada = () =>
  instalada || window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

type Plataforma = "ios" | "android" | "dentro_de_otra_app" | "escritorio";
function plataforma(): Plataforma {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(ua)) return "dentro_de_otra_app";
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "escritorio";
}

const CLAVE_VISTO = "agrosar_instalar_visto";
const DESCANSO_MS = 14 * 24 * 3_600_000;
const yaSeOfrecio = () => {
  try {
    return Date.now() - Number(localStorage.getItem(CLAVE_VISTO) ?? 0) < DESCANSO_MS;
  } catch {
    return true; // sin almacenamiento no se puede recordar: mejor no insistir
  }
};
const recordarOfrecido = () => {
  try {
    localStorage.setItem(CLAVE_VISTO, String(Date.now()));
  } catch {}
};

export default function InstalarApp({ className = "", ofrecer = false }: { className?: string; /** en teléfonos, abrir la ventana sola una vez */ ofrecer?: boolean }) {
  const { idioma } = useIdioma();
  const es = idioma === "es";
  const [visible, setVisible] = useState(false); // false hasta saber (en el navegador) que no está instalada
  const [, refrescar] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const botonInstalar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const f = () => {
      refrescar((n) => n + 1);
      if (yaInstalada()) {
        setVisible(false);
        setAbierta(false);
      }
    };
    oyentes.add(f);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- solo se sabe en el navegador
    setVisible(!yaInstalada());
    return () => {
      oyentes.delete(f);
    };
  }, []);

  // En teléfonos: ofrecerla una vez, sola, a los pocos segundos
  useEffect(() => {
    if (!ofrecer || !visible) return;
    const p = plataforma();
    if (p === "escritorio" || !window.matchMedia("(max-width: 767px)").matches || yaSeOfrecio()) return;
    const id = window.setTimeout(() => {
      if (yaInstalada() || yaSeOfrecio()) return;
      recordarOfrecido();
      setAbierta(true);
    }, 3500);
    return () => window.clearTimeout(id);
  }, [ofrecer, visible]);

  // Ventana abierta: Escape la cierra, y el foco va al botón principal
  useEffect(() => {
    if (!abierta) return;
    botonInstalar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  if (!visible) return null;

  const instalar = async () => {
    if (!aviso) return;
    const a = aviso;
    await a.prompt();
    const { outcome } = await a.userChoice;
    aviso = null;
    if (outcome === "accepted") {
      instalada = true;
      setVisible(false);
    }
    setAbierta(false);
  };
  const alTocarBoton = () => {
    recordarOfrecido();
    if (aviso) void instalar(); // el navegador ya la ofreció: cartel de instalación directo
    else setAbierta(true);
  };

  const p = plataforma();
  const pasos: string[] = aviso
    ? []
    : p === "ios"
      ? es
        ? ["Abajo (o arriba) en Safari, tocá el botón Compartir: el cuadrado con una flecha hacia arriba.", "Bajá en la lista y tocá «Agregar a inicio».", "Tocá «Agregar». AgroSAR queda con su ícono en tu pantalla."]
        : ["In Safari, tap the Share button: the square with an arrow pointing up.", "Scroll the list and tap “Add to Home Screen”.", "Tap “Add”. AgroSAR appears with its icon on your screen."]
      : p === "dentro_de_otra_app"
        ? es
          ? ["Estás viendo esta página dentro de otra app, que no puede instalarla.", "Tocá los tres puntitos (⋮ o ···) y elegí «Abrir en Chrome» o «Abrir en el navegador».", "Ahí tocá de nuevo «Instalar app»."]
          : ["You are viewing this page inside another app, which cannot install it.", "Tap the three dots (⋮ or ···) and choose “Open in Chrome” or “Open in browser”.", "There, tap “Install app” again."]
        : p === "android"
          ? es
            ? ["Tocá los tres puntitos (⋮) arriba a la derecha del navegador.", "Tocá «Instalar app» o «Agregar a pantalla principal».", "Tocá «Instalar». AgroSAR queda con su ícono en tu pantalla."]
            : ["Tap the three dots (⋮) at the top right of the browser.", "Tap “Install app” or “Add to Home screen”.", "Tap “Install”. AgroSAR appears with its icon on your screen."]
          : es
            ? ["En Chrome o Edge: tocá el ícono de instalar (una pantalla con una flecha) a la derecha de la barra de direcciones.", "O abrí el menú (⋮) y elegí «Instalar AgroSAR».", "En el teléfono es más útil: abrí esta misma dirección desde tu celular."]
            : ["In Chrome or Edge: click the install icon (a screen with an arrow) at the right of the address bar.", "Or open the menu (⋮) and choose “Install AgroSAR”.", "It is most useful on the phone: open this same address on your mobile."];

  return (
    <div className={className}>
      <button
        type="button"
        onClick={alTocarBoton}
        aria-haspopup="dialog"
        className="mx-auto flex min-h-12 items-center justify-center gap-2 rounded-full bg-primario px-5 text-base font-bold text-sobre-primario shadow-suave hover:bg-primario-hover"
      >
        <Icono nombre="descargar" />
        {es ? "Instalar app" : "Install app"}
      </button>

      {/* En <body> (portal): así queda por encima de todo, también de la barra de abajo y del menú */}
      {abierta && createPortal(
        <div className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo">
          <button type="button" aria-label={es ? "Cerrar" : "Close"} onClick={() => setAbierta(false)} className="absolute inset-0 bg-black/55" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-tarjeta p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-left text-texto shadow-2xl sm:rounded-3xl">
            <div className="flex items-center gap-4">
              <Image src="/iconos/icono-192.png" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl shadow-suave" />
              <div className="min-w-0">
                <h2 id="instalar-titulo" className="font-display text-2xl font-bold leading-tight">
                  {es ? "Instalar AgroSAR" : "Install AgroSAR"}
                </h2>
                <p className="text-base leading-snug text-texto-suave">
                  {es ? "Gratis. Queda en tu pantalla con su ícono y funciona sin internet." : "Free. It stays on your screen with its icon and works offline."}
                </p>
              </div>
            </div>

            {aviso ? (
              <button
                ref={botonInstalar}
                type="button"
                onClick={instalar}
                className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primario px-6 text-lg font-bold text-sobre-primario shadow-suave hover:bg-primario-hover"
              >
                <Icono nombre="descargar" className="h-6 w-6" />
                {es ? "Instalar ahora" : "Install now"}
              </button>
            ) : (
              <ol className="mt-4 space-y-3">
                {pasos.map((texto, i) => (
                  <li key={i} className="flex gap-3 text-base leading-snug">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primario text-sm font-bold text-sobre-primario">{i + 1}</span>
                    <span>{texto}</span>
                  </li>
                ))}
              </ol>
            )}

            <button
              ref={aviso ? undefined : botonInstalar}
              type="button"
              onClick={() => setAbierta(false)}
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full text-base font-bold text-texto-suave"
            >
              {aviso ? (es ? "Ahora no" : "Not now") : es ? "Entendido" : "Got it"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
