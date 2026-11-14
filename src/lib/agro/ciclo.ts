// Fechas estimadas del cultivo a partir de la siembra y el ciclo de la semilla.
// Problemas que cubre: cálculo de floración, madurez y cosecha (escenario "calculamos mal la fecha de cosecha"),
// registro por lote (fechas estimadas), y base para heladas y agua en etapas críticas.
import type { Ciclo, CultivoConfig, FechasCultivo } from "./tipos";
import { sumarDias } from "./fechas";

export function buscarCiclo(cfg: CultivoConfig, id?: string | null): Ciclo {
  const ciclo = cfg.ciclos.find((c) => c.id === (id || cfg.ciclo_por_defecto));
  if (!ciclo) {
    throw new Error(`ciclo '${id}' no existe para ${cfg.id}. Opciones: ${cfg.ciclos.map((c) => c.id).join(", ")}`);
  }
  return ciclo;
}

export function estimarFechas(cfg: CultivoConfig, siembra: string, cicloId?: string | null): FechasCultivo {
  const ciclo = buscarCiclo(cfg, cicloId);
  const madurez = sumarDias(siembra, ciclo.dias);
  const cosecha = sumarDias(madurez, cfg.cosecha_dias_despues_madurez);
  return {
    siembra,
    ciclo: { id: ciclo.id, nombre: ciclo.nombre, dias: ciclo.dias },
    emergencia: sumarDias(siembra, cfg.emergencia_dias),
    etapas: cfg.etapas.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      desde: sumarDias(siembra, e.desde * ciclo.dias),
      hasta: sumarDias(siembra, e.hasta * ciclo.dias),
      critica_agua: e.critica_agua,
    })),
    madurez,
    cosecha,
    cosecha_limite: sumarDias(cosecha, cfg.ventana_cosecha_dias),
  };
}
