// Registro de cultivos disponibles (config/cultivos/*.json).
import soja from "../../../config/cultivos/soja.json";
import maiz from "../../../config/cultivos/maiz.json";
import mandioca from "../../../config/cultivos/mandioca.json";
import type { CultivoConfig } from "./tipos";

export const CULTIVOS: Record<string, CultivoConfig> = {
  soja: soja as unknown as CultivoConfig,
  maiz: maiz as unknown as CultivoConfig,
  mandioca: mandioca as unknown as CultivoConfig,
};

export function obtenerCultivo(id: string | null | undefined): CultivoConfig | null {
  return (id && CULTIVOS[id]) || null;
}

// Vista resumida para el frontend (selectores, calendario, tablas de semillas).
export function resumenCultivo(c: CultivoConfig) {
  return {
    id: c.id,
    nombre: c.nombre,
    nombre_en: c.nombre_en,
    supuesto: c.supuesto,
    incompleto: c.incompleto ?? false,
    fuente: c.fuente,
    temporadas: c.temporadas,
    ciclos: c.ciclos,
    ciclo_por_defecto: c.ciclo_por_defecto,
    etapas: c.etapas,
    humedad_umbrales_m3m3: c.humedad,
    heladas: c.heladas,
    suelo_requisitos: c.suelo_requisitos,
    semillas: c.semillas,
    seleccion_semilla: c.seleccion_semilla ?? null,
    registro_lote: c.registro_lote ?? null,
    problemas: c.problemas,
  };
}
