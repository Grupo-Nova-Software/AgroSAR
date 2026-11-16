"use client";
// Calidad del fondo animado, para que la app vaya fluida en CUALQUIER teléfono.
//   completo → todo (computadoras y teléfonos que lo mueven bien; en pantallas chicas el CSS ya quita filtros y adornos)
//   minimo   → sin animaciones; la escena no sigue al dedo cuadro a cuadro: salta de estrato (cielo → superficie → raíces)
//              con una transición corta. Se activa solo si el teléfono es de poca memoria o si se midió que va trabado.
//   apagado  → sin fondo (lo elige el usuario en Menú → «Fondo animado»).
// La medición es real: mientras se desliza la pantalla se cuentan los cuadros que tardan más de 34 ms (menos de 30 por
// segundo). Si son muchos, el teléfono no puede con el fondo: se pasa a «mínimo» y se recuerda para la próxima vez.
// El atributo <html data-fondo="…"> lo lee el CSS (globals.css); SCRIPT_FONDO lo pone antes de pintar.
import { useSyncExternalStore } from "react";

export type CalidadFondo = "completo" | "minimo" | "apagado";

const CLAVE_PREF = "agrosar_fondo"; // "apagado" si el usuario lo apagó
const CLAVE_LENTO = "agrosar_fondo_lento"; // cuándo se midió que el teléfono no puede (ms). Vale 7 días: después se mide de nuevo
const VIGENCIA_LENTO_MS = 7 * 24 * 3_600_000;

/** Corre en <head> antes de pintar: evita que el fondo aparezca un instante en quien lo apagó. */
export const SCRIPT_FONDO = `try{var f=localStorage.getItem("${CLAVE_PREF}")==="apagado"?"apagado":Date.now()-Number(localStorage.getItem("${CLAVE_LENTO}")||0)<${VIGENCIA_LENTO_MS}?"minimo":"";if(f)document.documentElement.dataset.fondo=f}catch(e){}`;

const oyentes = new Set<() => void>();
const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};

function pocaPotencia(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (typeof n.deviceMemory === "number" && n.deviceMemory <= 2) || (n.hardwareConcurrency ?? 8) <= 2 || n.connection?.saveData === true;
}

function calcular(): CalidadFondo {
  if (leer(CLAVE_PREF) === "apagado") return "apagado";
  if (Date.now() - Number(leer(CLAVE_LENTO) ?? 0) < VIGENCIA_LENTO_MS || pocaPotencia()) return "minimo";
  return "completo";
}

function aplicar() {
  const c = calcular();
  if (c === "completo") delete document.documentElement.dataset.fondo;
  else document.documentElement.dataset.fondo = c;
  oyentes.forEach((f) => f());
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  window.addEventListener("storage", f);
  return () => {
    oyentes.delete(f);
    window.removeEventListener("storage", f);
  };
};

/** Calidad actual del fondo. En el servidor y al hidratar vale "completo" (después se corrige sola). */
export function useCalidadFondo(): CalidadFondo {
  return useSyncExternalStore(suscribir, calcular, () => "completo" as CalidadFondo);
}

/** Calidad leída en el momento (para el bucle de scroll, que no pasa por React). */
export const calidadAhora = calcular;

/** El usuario enciende o apaga el fondo. Al encenderlo de nuevo se vuelve a medir el teléfono. */
export function elegirFondo(encendido: boolean) {
  try {
    if (encendido) {
      localStorage.removeItem(CLAVE_PREF);
      localStorage.removeItem(CLAVE_LENTO);
    } else localStorage.setItem(CLAVE_PREF, "apagado");
  } catch {}
  aplicar();
}

/** Se midió que el teléfono no puede con el fondo: desde ahora, calidad mínima. */
export function marcarFondoLento() {
  try {
    localStorage.setItem(CLAVE_LENTO, String(Date.now()));
  } catch {}
  aplicar();
}

/** Sincroniza <html data-fondo> con lo calculado (p. ej. teléfono de poca memoria, que el script de <head> no detecta). */
export function sincronizarFondo() {
  const c = calcular();
  if ((document.documentElement.dataset.fondo ?? "completo") !== c) aplicar();
}

/**
 * Medidor de fluidez para usar dentro del bucle de scroll. Devuelve la función que hay que llamar en cada cuadro.
 * Para no confundir un tirón suelto (la página terminando de cargar) con un teléfono lento, hacen falta DOS tandas malas.
 */
export function medidorDeFluidez(alDetectarLento: () => void): (ahora: number) => void {
  const VENTANA = 45; // cuadros por tanda
  const LIMITE_MS = 34; // más que esto = menos de 30 cuadros por segundo
  const TANDAS_MALAS = 2;
  const TANDAS_BUENAS = 5; // después de 5 tandas buenas se deja de medir
  const inicio = performance.now();
  let ultimo = 0;
  let cuadros = 0;
  let lentos = 0;
  let buenas = 0;
  let malas = 0;
  let terminado = false;
  return (ahora) => {
    if (terminado) return;
    const dt = ahora - ultimo;
    ultimo = ahora;
    if (ahora - inicio < 2500) return; // los primeros segundos (carga de la página) no cuentan
    if (dt <= 0 || dt > 250) return; // primer cuadro o pausa entre gestos: no cuenta
    cuadros++;
    if (dt > LIMITE_MS) lentos++;
    if (cuadros < VENTANA) return;
    const mala = lentos / cuadros > 0.35;
    cuadros = 0;
    lentos = 0;
    if (mala) {
      if (++malas >= TANDAS_MALAS) {
        terminado = true;
        alDetectarLento();
      }
    } else if (++buenas >= TANDAS_BUENAS) terminado = true;
  };
}
