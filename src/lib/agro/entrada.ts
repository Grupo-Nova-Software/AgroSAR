// Validación de parámetros comunes de las APIs (query string o cuerpo JSON).
import type { EntradaAnalisis } from "./motor";
import type { SueloInput } from "./tipos";
import { TIPOS_SUELO } from "./tipos";
import { esFechaISO } from "./fechas";

export class ErrorEntrada extends Error {}

function fecha(v: unknown, nombre: string): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !esFechaISO(v)) throw new ErrorEntrada(`'${nombre}' debe ser una fecha AAAA-MM-DD`);
  return v;
}

function numero(v: unknown, nombre: string, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ErrorEntrada(`'${nombre}' debe ser un número entre ${min} y ${max}`);
  return n;
}

function opcion<T extends string>(v: unknown, nombre: string, opciones: readonly T[]): T | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (!opciones.includes(v as T)) throw new ErrorEntrada(`'${nombre}' debe ser uno de: ${opciones.join(", ")}`);
  return v as T;
}

function booleano(v: unknown, nombre: string): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  throw new ErrorEntrada(`'${nombre}' debe ser true o false`);
}

export function leerSuelo(o: Record<string, unknown>): SueloInput | undefined {
  const s: SueloInput = {
    tipo: opcion(o.suelo ?? o.tipo, "suelo", TIPOS_SUELO),
    ph: numero(o.ph, "ph", 0, 14),
    fertilidad: opcion(o.fertilidad, "fertilidad", ["baja", "media", "alta"] as const),
    drenaje: opcion(o.drenaje, "drenaje", ["bueno", "malo"] as const),
    compactado: booleano(o.compactado, "compactado"),
    pendiente_pct: numero(o.pendiente_pct, "pendiente_pct", 0, 100),
    materia_organica_pct: numero(o.materia_organica_pct, "materia_organica_pct", 0, 100),
    profundidad: opcion(o.profundidad, "profundidad", ["profundo", "superficial"] as const),
    preparado: booleano(o.preparado, "preparado"),
  };
  const limpio = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as SueloInput;
  return Object.keys(limpio).length ? limpio : undefined;
}

// Acepta el suelo "plano" (suelo=arcilloso&ph=5.2) o anidado en { suelo: { tipo, ph, ... } } (JSON).
export function leerEntrada(o: Record<string, unknown>): EntradaAnalisis {
  const sueloObj = o.suelo && typeof o.suelo === "object" ? (o.suelo as Record<string, unknown>) : o;
  return {
    fecha: fecha(o.fecha ?? o.hasta, "fecha"),
    fecha_siembra: fecha(o.fecha_siembra, "fecha_siembra"),
    ciclo: typeof o.ciclo === "string" && o.ciclo ? o.ciclo : undefined,
    suelo: leerSuelo(sueloObj),
  };
}

export function queryAObjeto(url: URL): Record<string, unknown> {
  return Object.fromEntries(url.searchParams.entries());
}
