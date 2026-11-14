// ¿Conviene sembrar ahora o dentro de cuánto? Hoy usa solo temporada + humedad NISAR + suelo.
// TODO (mañana): sumar el pronóstico de lluvia para estimar los días de espera cuando el suelo está seco.
import type { ClasifTemporada, CuandoSembrar, CultivoConfig, ResumenHumedad, SueloInput } from "./tipos";
import { sumarDias } from "./fechas";

export const REVISITA_NISAR_DIAS = 12; // SUPUESTO: cadencia aproximada de nuevas observaciones.

export function cuandoSembrar(
  cfg: CultivoConfig,
  fecha: string,
  t: ClasifTemporada,
  h: ResumenHumedad,
  suelo?: SueloInput,
): CuandoSembrar {
  const r = (sembrar_ahora: boolean, dias: number | null, motivo: string): CuandoSembrar => ({
    sembrar_ahora,
    dias_espera: dias,
    fecha_estimada: dias === null ? null : sumarDias(fecha, dias),
    motivo,
    revisar_en_dias: REVISITA_NISAR_DIAS,
  });

  if (t.estado === "fuera" || t.estado === "temprana") {
    const dias = t.estado === "temprana" ? t.dias_fuera! : (t.proxima?.dias_hasta ?? null);
    const nombre = t.estado === "temprana" ? t.temporada!.nombre : t.proxima?.nombre;
    return r(false, dias, dias === null ? "No hay temporadas cercanas." : `Esperar a que abra la ${nombre} (en ${dias} días) y revisar la humedad ese día.`);
  }

  const cierre = t.estado === "tardia" ? " La temporada ya cerró: usar semilla para siembra tardía." : "";
  const apurado = t.dias_restantes !== null && t.dias_restantes < REVISITA_NISAR_DIAS
    ? ` La ventana cierra en ${t.dias_restantes} días: si no mejora, usar semilla para siembra tardía.`
    : "";

  switch (h.estado) {
    case "optimo":
      return r(true, 0, `Humedad adecuada dentro de la ventana de siembra.${cierre}`);
    case "humedo":
      return r(true, 0, `Humedad alta pero manejable; verificar el piso para la maquinaria.${cierre}`);
    case "saturado": {
      const dias = cfg.oreo_dias[suelo?.tipo ?? "_default"] ?? cfg.oreo_dias._default;
      return r(false, dias, `Suelo saturado: esperar unos ${dias} días de oreo (SUPUESTO según el tipo de suelo).${apurado}${cierre}`);
    }
    case "seco":
    case "bajo":
      return r(false, null, `Falta humedad: esperar lluvias y revisar la próxima observación NISAR (≈${REVISITA_NISAR_DIAS} días).${apurado}${cierre}`);
    default:
      return r(false, null, `Sin observaciones NISAR recientes: revisar cuando haya una nueva pasada (≈${REVISITA_NISAR_DIAS} días).${cierre}`);
  }
}
