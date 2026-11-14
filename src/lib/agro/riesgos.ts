// Riesgos del cultivo: agua (NISAR), temporada, heladas (calendario), etapas críticas, malezas y cosecha.
import type { SerieHumedad } from "@/types/contratos";
import type { Alerta, ClasifTemporada, CultivoConfig, FechasCultivo, ResumenHumedad } from "./tipos";
import { crearAlerta, tieneProblema } from "./alertas";
import { clasificarHumedad, humedadEnPeriodo } from "./humedad";
import { heladaAntesDeMadurez, heladaEnImplantacion, cicloQueEvitaHeladas } from "./heladas";

export interface ContextoRiesgo {
  fecha: string;
  modo: "planificar" | "seguimiento";
  humedad: ResumenHumedad;
  temporada: ClasifTemporada;
  fechas: FechasCultivo;
  serie: SerieHumedad | null;
}

const m3 = (v: number | null) => (v === null ? "s/d" : `${v.toFixed(3)} m³/m³`);

export function riesgoHumedadActual(cfg: CultivoConfig, h: ResumenHumedad): (Alerta | null)[] {
  const media = m3(h.media_m3m3);
  const sube = h.tendencia === "subiendo" ? " y en aumento" : "";
  switch (h.estado) {
    case "seco":
      return [
        crearAlerta(cfg, "falta_agua", "critico", "Suelo muy seco",
          `Humedad NISAR ${media}: dificultad para la germinación, menor desarrollo y estrés hídrico.`,
          "No sembrar todavía; esperar lluvias o elegir una semilla tolerante al déficit hídrico."),
      ];
    case "bajo":
      return [
        crearAlerta(cfg, "falta_agua", "advertencia", "Humedad baja",
          `Humedad NISAR ${media}: la germinación puede ser despareja.`,
          "Esperar a que la humedad suba antes de sembrar."),
      ];
    case "humedo":
      return [
        crearAlerta(cfg, "exceso_agua", "info", "Suelo húmedo",
          `Humedad NISAR ${media}${sube}. Cerca del límite para ingresar con maquinaria.`,
          "Vigilar el ingreso de maquinaria; si sigue subiendo, esperar unos días."),
      ];
    case "saturado":
      return [
        crearAlerta(cfg, "exceso_agua", "critico", "Suelo saturado",
          `Humedad NISAR ${media}${sube}: no se puede ingresar con maquinaria, mala germinación, más riesgo de enfermedades y pérdida de nutrientes por lavado.`,
          "Esperar a que el suelo se oree antes de sembrar."),
      ];
    default:
      return [];
  }
}

export function riesgoTemporada(cfg: CultivoConfig, t: ClasifTemporada, modo: ContextoRiesgo["modo"]): (Alerta | null)[] {
  const e = cfg.escenarios;
  switch (t.estado) {
    case "temprana":
      return [
        crearAlerta(cfg, "temporada", "advertencia", "Siembra temprana",
          `${e.temprana ? e.temprana + ". " : ""}Faltan ${t.dias_fuera} días para que abra la ${t.temporada!.nombre} (${t.temporada!.inicio}).`,
          "Esperar a que abra la temporada."),
      ];
    case "tramo_tardio":
      return [
        crearAlerta(cfg, "temporada", "advertencia", "Final de la temporada",
          `Quedan ${t.dias_restantes} días de la ${t.temporada!.nombre} (cierra el ${t.temporada!.fin}).`,
          "Sembrar cuanto antes o usar una semilla para siembra tardía."),
      ];
    case "tardia":
      return [
        crearAlerta(cfg, "temporada", "advertencia", "Siembra tardía",
          `${e.tardia ? e.tardia + ". " : ""}La ${t.temporada!.nombre} cerró hace ${t.dias_fuera} días (${t.temporada!.fin}).`,
          "Usar una semilla para siembra tardía y un ciclo más corto."),
      ];
    case "fuera":
      return [
        crearAlerta(cfg, "temporada", modo === "planificar" ? "critico" : "advertencia", "Fuera de temporada",
          t.proxima ? `La próxima temporada (${t.proxima.nombre}) abre el ${t.proxima.inicio}, en ${t.proxima.dias_hasta} días.` : "No hay temporadas cercanas.",
          "No sembrar ahora."),
      ];
    default:
      return [];
  }
}

export function riesgoHeladas(cfg: CultivoConfig, f: FechasCultivo): (Alerta | null)[] {
  if (!cfg.heladas.sensible) return [];
  const out: (Alerta | null)[] = [];

  const temprana = heladaEnImplantacion(cfg, f.siembra);
  if (temprana) {
    out.push(
      crearAlerta(cfg, "helada", "advertencia", "Heladas al inicio del cultivo",
        `La siembra cae dentro del período de heladas (hasta ${temprana.fin_heladas}, SUPUESTO por calendario).`,
        "Esperar a que termine el período de heladas.", "inicio"),
    );
  }

  const tardia = heladaAntesDeMadurez(cfg, f.siembra, f.madurez);
  if (tardia) {
    if (cfg.heladas.ciclo_largo) {
      out.push(
        crearAlerta(cfg, "helada", "advertencia", "El ciclo pasa por el invierno",
          `Entre ${tardia.desde} y ${tardia.hasta} hay riesgo de heladas que dañan la parte aérea (SUPUESTO por calendario).`,
          "Planificar la cosecha o la protección antes del invierno.", "invierno"),
      );
    } else {
      const ciclo = cicloQueEvitaHeladas(cfg, f.siembra);
      out.push(
        crearAlerta(cfg, "helada", "critico", "Riesgo de heladas antes de madurar",
          `${cfg.escenarios.helada ? cfg.escenarios.helada + ". " : ""}Con el ciclo ${f.ciclo.nombre} la madurez llegaría el ${f.madurez}, pero las heladas empiezan el ${tardia.inicio_heladas} (SUPUESTO por calendario).`,
          ciclo ? `Usar un ciclo ${ciclo.nombre} (${ciclo.dias} días) o adelantar la siembra.` : "Ningún ciclo madura antes de las heladas: no conviene sembrar en esta fecha.",
          "madurez"),
      );
    }
  }
  return out;
}

function problemaAgua(cfg: CultivoConfig, etapaId: string): string {
  if (etapaId === "floracion" && tieneProblema(cfg, "agua_floracion")) return "agua_floracion";
  if (etapaId !== "implantacion" && etapaId !== "brotacion" && tieneProblema(cfg, "humedad_posterior")) return "humedad_posterior";
  return "falta_agua";
}

// Agua en las etapas críticas: pasadas (con la serie NISAR), en curso (humedad actual) y futuras (aviso).
export function riesgoEtapasCriticas(cfg: CultivoConfig, ctx: ContextoRiesgo): (Alerta | null)[] {
  const out: (Alerta | null)[] = [];
  for (const e of ctx.fechas.etapas) {
    if (!e.critica_agua) continue;
    if (ctx.modo === "planificar" && (e.id === "implantacion" || e.id === "brotacion")) continue; // ya lo cubre la humedad actual
    const pid = problemaAgua(cfg, e.id);

    if (e.hasta < ctx.fecha) {
      const h = humedadEnPeriodo(ctx.serie, e.desde, e.hasta);
      const estado = clasificarHumedad(h.media_m3m3, cfg.humedad);
      if (estado === "seco" || estado === "bajo") {
        out.push(
          crearAlerta(cfg, pid, estado === "seco" ? "critico" : "advertencia", `Falta de agua en ${e.nombre.toLowerCase()}`,
            `Humedad NISAR media ${m3(h.media_m3m3)} entre ${e.desde} y ${e.hasta} (${h.n} obs.). Puede haber pérdidas de producción.`,
            "Registrar el evento en el lote y ajustar la expectativa de rendimiento.", e.id),
        );
      } else if (estado === "saturado") {
        out.push(
          crearAlerta(cfg, "exceso_agua", "advertencia", `Exceso de agua en ${e.nombre.toLowerCase()}`,
            `Humedad NISAR media ${m3(h.media_m3m3)} entre ${e.desde} y ${e.hasta}.`,
            "Revisar enfermedades y el estado de las raíces.", e.id),
        );
      }
    } else if (e.desde <= ctx.fecha) {
      if (ctx.humedad.estado === "seco" || ctx.humedad.estado === "bajo") {
        out.push(
          crearAlerta(cfg, pid, ctx.humedad.estado === "seco" ? "critico" : "advertencia", `Falta de agua en plena ${e.nombre.toLowerCase()}`,
            `El cultivo está en una etapa crítica (hasta ${e.hasta}) y la humedad NISAR es ${m3(ctx.humedad.media_m3m3)}.`,
            "Es el momento más delicado: priorizar riego si hay disponible.", e.id),
        );
      }
    } else {
      out.push(
        crearAlerta(cfg, pid, "info", `Etapa crítica: ${e.nombre}`,
          `Estimada del ${e.desde} al ${e.hasta}. El cultivo necesita agua disponible en ese momento.`,
          "Vigilar la humedad NISAR en esas fechas (revisita aprox. cada 12 días).", e.id),
      );
    }
  }
  return out;
}

export function riesgoManejo(cfg: CultivoConfig, ctx: ContextoRiesgo): (Alerta | null)[] {
  const out: (Alerta | null)[] = [];
  const f = ctx.fechas;

  for (const e of cfg.etapas.filter((x) => x.malezas)) {
    const fe = f.etapas.find((x) => x.id === e.id)!;
    if (fe.hasta >= ctx.fecha) {
      out.push(
        crearAlerta(cfg, "malezas", "info", "Control de malezas",
          `Las malezas compiten más durante ${e.nombre.toLowerCase()} (${fe.desde} a ${fe.hasta}).`,
          "Planificar las carpidas o el control en ese período."),
      );
    }
  }

  if (cfg.seleccion_semilla && ctx.modo === "planificar") {
    out.push(
      crearAlerta(cfg, "semilla", "info", "Selección de la semilla", cfg.seleccion_semilla.join(" · "),
        "Revisar las ramas-semilla antes de plantar."),
    );
  }

  // Cosecha: estimación, cosecha tardía y suelo saturado en la ventana de cosecha.
  const pidTardia = tieneProblema(cfg, "cosecha_tardia") ? "cosecha_tardia" : "cosecha";
  if (ctx.modo === "seguimiento" && ctx.fecha > f.cosecha_limite) {
    out.push(
      crearAlerta(cfg, pidTardia, "critico", "Cosecha atrasada",
        `La cosecha estimada era el ${f.cosecha} y el margen terminó el ${f.cosecha_limite}.`,
        "Cosechar cuanto antes para evitar pérdidas de calidad."),
    );
  } else if (ctx.modo === "seguimiento" && ctx.fecha >= f.cosecha && ctx.humedad.estado === "saturado") {
    out.push(
      crearAlerta(cfg, "exceso_agua", "advertencia", "Suelo saturado en época de cosecha",
        `Humedad NISAR ${m3(ctx.humedad.media_m3m3)}: puede impedir el ingreso de la cosechadora.`,
        "Esperar el oreo, sin pasar el límite del " + f.cosecha_limite + ".", "cosecha"),
    );
  } else {
    out.push(
      crearAlerta(cfg, tieneProblema(cfg, "cosecha") ? "cosecha" : pidTardia, "info", "Cosecha estimada",
        `${cfg.escenarios.cosecha ? cfg.escenarios.cosecha + " — " : ""}madurez ${f.madurez}, cosecha ${f.cosecha} (límite ${f.cosecha_limite}) con ciclo ${f.ciclo.nombre} de ${f.ciclo.dias} días.`,
        "Confirmar el ciclo real de la semilla para ajustar la fecha."),
    );
  }
  return out;
}

export function evaluarRiesgos(cfg: CultivoConfig, ctx: ContextoRiesgo): (Alerta | null)[] {
  const humedadActual =
    ctx.modo === "planificar" || ctx.fecha <= (ctx.fechas.etapas[0]?.hasta ?? ctx.fecha)
      ? riesgoHumedadActual(cfg, ctx.humedad)
      : ctx.humedad.estado === "saturado"
        ? riesgoHumedadActual(cfg, ctx.humedad)
        : [];
  return [
    ...humedadActual,
    ...riesgoTemporada(cfg, ctx.temporada, ctx.modo),
    ...riesgoHeladas(cfg, ctx.fechas),
    ...riesgoEtapasCriticas(cfg, ctx),
    ...riesgoManejo(cfg, ctx),
  ];
}
