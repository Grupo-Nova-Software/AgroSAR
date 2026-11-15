"use client";
// Cultivo y zona elegidos, compartidos entre Inicio, Mi suelo y Clima (y entre pestañas del navegador).
// Se guardan en el teléfono (localStorage: agrosar_cultivo, agrosar_zona). Los parámetros de la URL
// mandan cuando están; esto solo recuerda la última elección para cuando se entra sin parámetros.
//
// useSyncExternalStore: en el servidor y en la hidratación vale null (no hay localStorage), después React
// vuelve a renderizar con el valor guardado. Así no hay diferencias de hidratación.
import { useCallback, useSyncExternalStore } from "react";
import { CULTIVOS, type Cultivo } from "./cultivos";

export type CultivoId = Cultivo["id"];

const CLAVE_CULTIVO = "agrosar_cultivo";
const CLAVE_ZONA = "agrosar_zona";
const EVENTO = "agrosar:preferencias";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string) {
  try {
    if (localStorage.getItem(clave) === valor) return;
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): igual se avisa, para que la pantalla actual se actualice.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso); // cambios hechos en otra pestaña
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

const sinValor = () => null;

export const esCultivo = (v: unknown): v is CultivoId => CULTIVOS.some((c) => c.id === v);

/** Último cultivo elegido (null mientras no se sabe o si nunca se eligió). */
export function useCultivoGuardado(): [CultivoId | null, (c: CultivoId) => void] {
  const valor = useSyncExternalStore(suscribir, () => leer(CLAVE_CULTIVO), sinValor);
  const guardar = useCallback((c: CultivoId) => escribir(CLAVE_CULTIVO, c), []);
  return [esCultivo(valor) ? valor : null, guardar];
}

/** Última zona elegida (id de public/data/humedad). */
export function useZonaGuardada(): [string | null, (z: string) => void] {
  const valor = useSyncExternalStore(suscribir, () => leer(CLAVE_ZONA), sinValor);
  const guardar = useCallback((z: string) => escribir(CLAVE_ZONA, z), []);
  return [valor && /^[a-z0-9_]+$/.test(valor) ? valor : null, guardar];
}
