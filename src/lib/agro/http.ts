// Respuestas comunes de las APIs del motor agronómico.
import { obtenerCultivo, CULTIVOS } from "./cultivos";
import { ErrorEntrada } from "./entrada";
import type { CultivoConfig } from "./tipos";

export const AVISO =
  "Datos y umbrales PROVISIONALES (SUPUESTOS del equipo, sin validación agronómica). Las series marcadas es_ejemplo=true son FICTICIAS.";

export function error(status: number, mensaje: string) {
  return Response.json({ error: mensaje }, { status });
}

export function cultivoODevolverError(id: string | null): CultivoConfig | Response {
  const c = obtenerCultivo(id ?? "soja");
  return c ?? error(400, `cultivo '${id}' no disponible. Opciones: ${Object.keys(CULTIVOS).join(", ")}`);
}

// Convierte errores de validación en 400 y el resto en 500, sin filtrar trazas.
export async function manejar(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    // Señales internas de Next.js (prerender, redirect, notFound…) llevan `digest`: hay que dejarlas pasar.
    if (e && typeof e === "object" && "digest" in e) throw e;
    if (e instanceof ErrorEntrada) return error(400, e.message);
    if (e instanceof Error && /^ciclo '/.test(e.message)) return error(400, e.message);
    console.error(e);
    return error(500, "error interno");
  }
}
