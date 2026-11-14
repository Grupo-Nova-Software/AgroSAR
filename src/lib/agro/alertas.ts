// Construcción de alertas a partir del catálogo de problemas de cada cultivo.
// Una alerta solo se emite si el problema está en el catálogo del cultivo (config/cultivos/<id>.json).
import type { Alerta, CultivoConfig, Nivel } from "./tipos";

export function tieneProblema(cfg: CultivoConfig, id: string): boolean {
  return cfg.problemas.some((p) => p.id === id);
}

export function crearAlerta(
  cfg: CultivoConfig,
  problemaId: string,
  nivel: Nivel,
  titulo: string,
  detalle: string,
  recomendacion: string,
  sufijo = "",
): Alerta | null {
  const p = cfg.problemas.find((x) => x.id === problemaId);
  if (!p) return null;
  return {
    id: sufijo ? `${problemaId}:${sufijo}` : problemaId,
    problema_id: problemaId,
    nivel,
    categoria: p.categoria,
    titulo,
    detalle,
    recomendacion,
    fuente_dato: p.dato,
  };
}

const PESO: Record<Nivel, number> = { critico: 0, advertencia: 1, info: 2 };

export function ordenarAlertas(alertas: (Alerta | null)[]): Alerta[] {
  return alertas.filter((a): a is Alerta => a !== null).sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
}
