"use client";
// Ubicación del usuario, bien hecha.
// El navegador puede dar dos clases de ubicación muy distintas:
//   - PRECISA: GPS del teléfono (error de pocos metros). Tarda unos segundos en llegar.
//   - APROXIMADA: por la red (antena, wifi o la dirección de internet). En una computadora, o en un teléfono con el GPS
//     apagado o con el permiso en «aproximada», el error puede ser de varios kilómetros… o caer en otra ciudad.
// Antes la app tomaba la primera que llegaba (casi siempre la aproximada) y centraba el mapa ahí como si fuera exacta.
// Ahora: se pide alta precisión, se sigue escuchando y se queda con la mejor; cada ubicación trae su margen de error
// y la app solo la trata como «acá estoy» si el margen es chico. Si es grande, lo dice.
// Un solo seguimiento compartido por toda la app (mapa, clima, inicio).
import { useEffect, useSyncExternalStore } from "react";
import { dentroDeItapua, type LonLat } from "@/lib/itapua";

/** Hasta este margen de error (metros) la ubicación se considera exacta (GPS). SUPUESTO razonable para marcar chacras. */
export const PRECISION_BUENA_M = 100;

export interface Ubicacion {
  pos: LonLat; // [lon, lat]
  precision_m: number; // radio de error que informa el dispositivo
  precisa: boolean;
  enItapua: boolean;
  t: number; // cuándo llegó (ms)
}
export type EstadoUbicacion = "sin_pedir" | "buscando" | "lista" | "denegada" | "sin_soporte" | "error";
interface Foto { ubic: Ubicacion | null; estado: EstadoUbicacion }

let foto: Foto = { ubic: null, estado: "sin_pedir" };
const FOTO_SERVIDOR: Foto = { ubic: null, estado: "sin_pedir" };
const oyentes = new Set<() => void>();
let vigilancia: number | null = null;
let interesados = 0;

const avisar = (nueva: Foto) => {
  foto = nueva;
  oyentes.forEach((f) => f());
};

function alRecibir(g: GeolocationPosition) {
  const nueva: Ubicacion = {
    pos: [Number(g.coords.longitude.toFixed(6)), Number(g.coords.latitude.toFixed(6))],
    precision_m: Math.round(g.coords.accuracy),
    precisa: g.coords.accuracy <= PRECISION_BUENA_M,
    enItapua: dentroDeItapua(g.coords.longitude, g.coords.latitude),
    t: Date.now(),
  };
  const anterior = foto.ubic;
  // No retroceder: si hace poco había una ubicación mucho mejor (GPS) y ahora llega una por red, se ignora.
  if (anterior && Date.now() - anterior.t < 60_000 && nueva.precision_m > anterior.precision_m * 3 && nueva.precision_m > PRECISION_BUENA_M) return;
  if (nueva.precisa) guardarUltima(nueva);
  avisar({ ubic: nueva, estado: "lista" });
}

function alFallar(e: GeolocationPositionError) {
  // Si ya hay una ubicación, un error posterior (se perdió la señal un momento) no la borra.
  if (foto.ubic) return;
  avisar({ ubic: null, estado: e.code === e.PERMISSION_DENIED ? "denegada" : "error" });
}

function empezar() {
  if (vigilancia !== null) return;
  if (!("geolocation" in navigator)) {
    avisar({ ubic: null, estado: "sin_soporte" });
    return;
  }
  if (!foto.ubic) avisar({ ubic: null, estado: "buscando" });
  // enableHighAccuracy: usar el GPS. maximumAge 0: nada de ubicaciones viejas guardadas por el navegador.
  vigilancia = navigator.geolocation.watchPosition(alRecibir, alFallar, { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 });
}

function parar() {
  if (vigilancia === null) return;
  navigator.geolocation.clearWatch(vigilancia);
  vigilancia = null;
}

/** Vuelve a pedir la ubicación (p. ej. después de dar el permiso o encender el GPS). */
export function reintentarUbicacion() {
  parar();
  avisar({ ubic: foto.ubic, estado: foto.ubic ? "lista" : "sin_pedir" });
  if (interesados > 0) empezar();
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
};

/**
 * Ubicación en vivo. `activa = false` no pide permiso ni enciende el GPS (solo devuelve lo que ya se sepa).
 * El GPS se apaga solo cuando ninguna pantalla lo está usando.
 */
export function useUbicacion(activa = true): Foto {
  const actual = useSyncExternalStore(suscribir, () => foto, () => FOTO_SERVIDOR);
  useEffect(() => {
    if (!activa) return;
    interesados++;
    empezar();
    return () => {
      interesados--;
      if (interesados <= 0) parar();
    };
  }, [activa]);
  return actual;
}

/** "± 35 m" / "± 12 km" */
export const textoPrecision = (m: number) => (m < 1000 ? `± ${Math.round(m / 5) * 5 || 5} m` : `± ${(m / 1000).toLocaleString("es-PY", { maximumFractionDigits: m < 10_000 ? 1 : 0 })} km`);

// ---------- Última ubicación PRECISA conocida (para abrir el mapa ahí mientras el GPS se despierta) ----------
const CLAVE = "agrosar.ubicacion.v2"; // v2: solo se guardan ubicaciones de GPS (la v1 guardaba también las de red, a veces en otra ciudad)
const VIGENCIA_MS = 30 * 24 * 3_600_000;

function guardarUltima(u: Ubicacion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ pos: u.pos, t: u.t }));
  } catch {}
}

export function leerUltimaUbicacion(): LonLat | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as { pos?: LonLat; t?: number } | null;
    if (!v || !Array.isArray(v.pos) || v.pos.length !== 2 || Date.now() - (v.t ?? 0) > VIGENCIA_MS) return null;
    return dentroDeItapua(v.pos[0], v.pos[1]) ? v.pos : null;
  } catch {
    return null;
  }
}
