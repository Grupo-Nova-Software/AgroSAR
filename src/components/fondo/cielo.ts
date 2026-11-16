"use client";
// Estado del cielo del fondo, a partir del clima real del lugar (GET /api/clima: Open-Meteo + NASA POWER).
// Umbrales: SUPUESTOS del equipo para elegir el dibujo (no son alertas agronómicas).
// La API no trae cobertura de nubes: "nublado" se estima con la probabilidad de lluvia y la humedad del aire.
import { useEffect, useState } from "react";
import type { DiaDetalle, HoraDetalle, RespuestaClima } from "@/lib/clima/tipos";
import { ITAPUA_ID } from "@/lib/itapua";

export type EstadoCielo =
  | "soleado_calor"
  | "despejado"
  | "parcial_nublado"
  | "nublado"
  | "lluvia_suave"
  | "tormenta"
  | "helada_frio";

export const UMBRALES_CIELO = {
  calor_c: 32,
  helada_c: 5,
  lluvia_mm: 0.5,
  lluvia_prob_pct: 70,
  tormenta_mm_hora: 4,
  tormenta_mm_dia: 25,
  nublado_prob_pct: 45,
  nublado_hr_pct: 90,
  parcial_prob_pct: 20,
  parcial_hr_pct: 75,
} as const;
const U = UMBRALES_CIELO;

/** Clima de una hora, con la máxima y la mínima de ese día. Orden: tormenta > lluvia > helada > calor > nubes. */
export function cieloDeHora(h: HoraDetalle, dia?: DiaDetalle): EstadoCielo {
  const mm = h.mm ?? 0;
  const prob = h.prob_pct ?? 0;
  const hr = h.hr_pct ?? 0;
  if (mm >= U.tormenta_mm_hora || (dia?.mm ?? 0) >= U.tormenta_mm_dia) return mm > U.lluvia_mm || prob >= U.lluvia_prob_pct ? "tormenta" : "nublado";
  if (mm > U.lluvia_mm || prob >= U.lluvia_prob_pct) return "lluvia_suave";
  if ((h.temp_c ?? 99) <= U.helada_c || (dia?.tmin_c ?? 99) <= U.helada_c) return "helada_frio";
  if ((h.temp_c ?? 0) >= U.calor_c || (dia?.tmax_c ?? 0) >= U.calor_c) return "soleado_calor";
  if (prob >= U.nublado_prob_pct || hr >= U.nublado_hr_pct) return "nublado";
  if (prob >= U.parcial_prob_pct || hr >= U.parcial_hr_pct) return "parcial_nublado";
  return "despejado";
}

/** Clima de un día entero (sin humedad del aire: las nubes salen de la probabilidad de lluvia). */
export function cieloDeDia(d: DiaDetalle): EstadoCielo {
  const mm = d.mm ?? 0;
  const prob = d.prob_pct ?? 0;
  if (mm >= U.tormenta_mm_dia && prob >= 50) return "tormenta";
  if ((mm > U.lluvia_mm && prob >= 50) || prob >= U.lluvia_prob_pct) return "lluvia_suave";
  if ((d.tmin_c ?? 99) <= U.helada_c) return "helada_frio";
  if ((d.tmax_c ?? 0) >= U.calor_c) return "soleado_calor";
  if (prob >= U.nublado_prob_pct) return "nublado";
  if (prob >= U.parcial_prob_pct) return "parcial_nublado";
  return "despejado";
}

/** Cielo de "ahora": la primera hora del pronóstico (empieza en la hora actual). */
export function cieloActual(datos: RespuestaClima | null | undefined): EstadoCielo | null {
  if (!datos) return null;
  const hoy = datos.diario.find((d) => d.fecha === datos.hoy);
  if (datos.horario[0]) return cieloDeHora(datos.horario[0], hoy);
  return hoy ? cieloDeDia(hoy) : null;
}

export type HumedadFondo = "buena" | "baja" | null;

/** Estado de la última pasada NISAR → halos de agua solo si el suelo está bien de agua. */
export function humedadDe(datos: RespuestaClima | null | undefined): HumedadFondo {
  const e = datos?.sequia.nisar?.estado;
  if (e === "optimo" || e === "humedo") return "buena";
  if (e === "seco" || e === "bajo") return "baja";
  return null;
}

// ---------------------------------------------------------------- Clima del lugar (Inicio y Mi suelo)
const VIGENCIA_MS = 20 * 60 * 1000;
const memoria = new Map<string, { t: number; datos: RespuestaClima }>();

function guardado(clave: string): RespuestaClima | null {
  const m = memoria.get(clave);
  if (m && Date.now() - m.t < VIGENCIA_MS) return m.datos;
  try {
    const s = sessionStorage.getItem(`agrosar_clima_${clave}`);
    if (!s) return null;
    const v = JSON.parse(s) as { t: number; datos: RespuestaClima };
    if (Date.now() - v.t > VIGENCIA_MS) return null;
    memoria.set(clave, v);
    return v.datos;
  } catch {
    return null;
  }
}

export interface PuntoLugar { lat: number; lon: number }

/**
 * Clima de un lugar de Itapúa: el punto dado (la chacra) o, sin punto, el centro del departamento.
 * Se pide una vez cada 20 min por lugar y cultivo (memoria + sessionStorage), así pasar de Inicio a Mi suelo
 * no repite la consulta. Sin internet devuelve null (el fondo queda despejado y los consejos avisan).
 */
export function useClimaLugar(punto: PuntoLugar | null, cultivo: string): RespuestaClima | null {
  const [resultado, setResultado] = useState<{ clave: string; datos: RespuestaClima } | null>(null);
  const lat = punto?.lat ?? null;
  const lon = punto?.lon ?? null;
  const clave = `${lat !== null && lon !== null ? `${lat.toFixed(3)},${lon.toFixed(3)}` : ITAPUA_ID}|${cultivo}`;

  useEffect(() => {
    let vigente = true;
    (async () => {
      const enCache = guardado(clave);
      if (enCache) {
        setResultado({ clave, datos: enCache });
        return;
      }
      try {
        const q: Record<string, string> = lat !== null && lon !== null ? { lat: String(lat), lon: String(lon), cultivo } : { area: ITAPUA_ID, cultivo };
        const r = await fetch(`/api/clima?${new URLSearchParams(q).toString()}`);
        if (!r.ok) return;
        const datos = (await r.json()) as RespuestaClima;
        const v = { t: Date.now(), datos };
        memoria.set(clave, v);
        try {
          sessionStorage.setItem(`agrosar_clima_${clave}`, JSON.stringify(v));
        } catch {}
        if (vigente) setResultado({ clave, datos });
      } catch {
        // Sin conexión: el fondo sigue con el último cielo o despejado.
      }
    })();
    return () => {
      vigente = false;
    };
  }, [clave, lat, lon, cultivo]);

  return resultado?.clave === clave ? resultado.datos : null;
}
