// Problemas de suelo a partir de lo que carga el agricultor (NISAR no mide pH, nutrientes ni textura).
// Problemas que cubre: acidez, nutrientes, materia orgánica, compactación, erosión/pendiente,
// drenaje, profundidad, mala preparación del terreno y falta de análisis de suelo.
import type { Alerta, CultivoConfig, SueloInput } from "./tipos";
import { crearAlerta } from "./alertas";

export function evaluarSuelo(cfg: CultivoConfig, suelo: SueloInput | undefined): (Alerta | null)[] {
  const r = cfg.suelo_requisitos;
  const out: (Alerta | null)[] = [];
  const s = suelo ?? {};

  if (s.ph === undefined && s.fertilidad === undefined) {
    out.push(
      crearAlerta(cfg, "analisis_suelo", "info", "Sin análisis de suelo",
        "Sin análisis no se sabe la cantidad de fertilizante ni los sectores a corregir.",
        "Hacer un análisis de suelo (pH, P, K, Ca, Mg, materia orgánica) y cargarlo en el lote."),
    );
  }

  if (s.ph !== undefined && r.ph_min !== undefined && s.ph < r.ph_min) {
    out.push(
      crearAlerta(cfg, "acidez", "advertencia", "Suelo ácido",
        `pH ${s.ph} por debajo del rango buscado (${r.ph_min}–${r.ph_max}). Un pH bajo limita la disponibilidad de nutrientes.`,
        "Corregir la acidez (encalado) según el análisis de suelo."),
    );
  } else if (s.ph !== undefined && r.ph_max !== undefined && s.ph > r.ph_max) {
    out.push(
      crearAlerta(cfg, "acidez", "advertencia", "pH alto",
        `pH ${s.ph} por encima del rango buscado (${r.ph_min}–${r.ph_max}).`,
        "Consultar con un técnico la corrección según el análisis."),
    );
  }

  if (s.fertilidad === "baja" || s.tipo === "degradado") {
    out.push(
      crearAlerta(cfg, "nutrientes", "advertencia", "Fertilidad baja",
        "El suelo tiene poca disponibilidad de nutrientes (fósforo, potasio, calcio, magnesio).",
        "Fertilizar según el análisis de suelo y elegir una semilla adaptada a ambientes de menor potencial."),
    );
  }

  if (s.materia_organica_pct !== undefined && r.materia_organica_min_pct !== undefined && s.materia_organica_pct < r.materia_organica_min_pct) {
    out.push(
      crearAlerta(cfg, "materia_organica", "advertencia", "Poca materia orgánica",
        `${s.materia_organica_pct} % de materia orgánica (referencia ≥ ${r.materia_organica_min_pct} %): el suelo retiene menos agua.`,
        "Aumentar la cobertura y los rastrojos; considerar abonos verdes."),
    );
  }

  if (s.compactado) {
    out.push(
      crearAlerta(cfg, "compactacion", "advertencia", "Suelo compactado",
        "La compactación dificulta el crecimiento de las raíces y el movimiento del agua.",
        "Descompactar antes de sembrar y no trabajar el suelo cuando está muy húmedo."),
    );
  }

  if (s.pendiente_pct !== undefined && r.pendiente_max_pct !== undefined && s.pendiente_pct > r.pendiente_max_pct) {
    out.push(
      crearAlerta(cfg, "erosion", "advertencia", "Pendiente con riesgo de erosión",
        `Pendiente de ${s.pendiente_pct} % (referencia ≤ ${r.pendiente_max_pct} %).`,
        "Sembrar en curvas de nivel y mantener cobertura vegetal."),
    );
  }

  if (s.drenaje === "malo" || s.tipo === "humedo") {
    out.push(
      crearAlerta(cfg, "drenaje", cfg.id === "maiz" ? "critico" : "advertencia", "Problemas de drenaje",
        "El exceso de agua reduce la aireación de las raíces, dificulta el ingreso de maquinaria y perjudica la germinación.",
        "Corregir el drenaje antes de sembrar: ninguna semilla reemplaza un drenaje adecuado."),
    );
  }

  if (s.profundidad === "superficial" && r.profundidad === "profundo") {
    out.push(
      crearAlerta(cfg, "profundidad", "advertencia", "Suelo poco profundo",
        "El cultivo busca suelos profundos para desarrollar las raíces.",
        "Priorizar los sectores más profundos del lote."),
    );
  }

  if (s.preparado === false) {
    out.push(
      crearAlerta(cfg, "preparacion", "advertencia", "Terreno sin preparar",
        "Una mala preparación del terreno afecta la brotación y el establecimiento.",
        "Preparar el suelo antes de plantar."),
    );
  }

  return out;
}
