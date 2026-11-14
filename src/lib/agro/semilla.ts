// Recomendación de semilla según suelo, temporada y riesgo hídrico.
// Problemas que cubre: semilla correcta por tipo de suelo, semillas para siembra tardía,
// riesgo de estrés hídrico, baja fertilidad, mala selección de semillas (mandioca).
import type { Ciclo, CultivoConfig, RecomSemilla, ReglaSemilla, SueloInput } from "./tipos";
import { buscarCiclo } from "./ciclo";
import { cicloQueEvitaHeladas } from "./heladas";

export interface ContextoSemilla {
  siembra: string;
  tardia: boolean;
  estres_hidrico: boolean;
}

export function recomendarSemilla(cfg: CultivoConfig, suelo: SueloInput | undefined, ctx: ContextoSemilla): RecomSemilla {
  const porCondicion = (c: ReglaSemilla["condicion"]) => cfg.semillas.find((s) => s.condicion === c);
  const porSuelo = suelo?.tipo ? cfg.semillas.find((s) => s.suelos?.includes(suelo.tipo!)) : undefined;
  const bajaFertilidad = suelo?.fertilidad === "baja" || suelo?.tipo === "degradado";

  // Orden de prioridad (SUPUESTO del equipo): siembra tardía > tipo de suelo > baja fertilidad > estrés hídrico.
  const candidatas = [
    ctx.tardia ? porCondicion("siembra_tardia") : undefined,
    porSuelo,
    bajaFertilidad ? porCondicion("baja_fertilidad") : undefined,
    ctx.estres_hidrico ? porCondicion("estres_hidrico") : undefined,
  ].filter((s): s is ReglaSemilla => !!s);

  const vistas = new Set<string>();
  const unicas = candidatas.filter((s) => (vistas.has(s.semilla) ? false : (vistas.add(s.semilla), true)));
  const principal = unicas[0] ?? cfg.semilla_por_defecto;

  // Ciclo sugerido: el por defecto, o el más corto si la siembra es tardía. Si con ese ciclo el cultivo
  // llegaría a las heladas sin madurar, se baja al ciclo más largo (de igual o menor duración) que sí madura.
  // Cultivos de ciclo largo (mandioca) pasan el invierno igual: no se ajusta por heladas.
  const base = ctx.tardia ? [...cfg.ciclos].sort((a, b) => a.dias - b.dias)[0] : buscarCiclo(cfg);
  let ciclo: Ciclo | null = base;
  if (cfg.heladas.sensible && !cfg.heladas.ciclo_largo) {
    const seguro = cicloQueEvitaHeladas(cfg, ctx.siembra, base.dias);
    ciclo = seguro;
  }

  return {
    semilla: principal.semilla,
    motivo: principal.motivo,
    ciclo_sugerido: ciclo ? { id: ciclo.id, nombre: ciclo.nombre, dias: ciclo.dias } : null,
    alternativas: unicas.slice(1).map((s) => ({ semilla: s.semilla, motivo: s.motivo })),
    ...(cfg.seleccion_semilla ? { seleccion: cfg.seleccion_semilla } : {}),
  };
}
