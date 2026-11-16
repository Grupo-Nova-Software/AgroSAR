// La frase que explica la recomendación (sembrar / esperar / precaución), a partir de los CÓDIGOS del motor.
// La usan el cartel de «Mi suelo» y las recomendaciones de Inicio, para que digan lo mismo.
import type { Clave } from "../idioma";
import type { Analisis } from "./api";

type T = (clave: Clave, vars?: Record<string, string | number>) => string;

export function motivoDe(analisis: Analisis, t: T, fecha: (iso: string, largo?: boolean) => string, cultivo: string): string {
  const h = analisis.humedad;
  const te = analisis.temporada;
  if (h.estado === "sin_datos") return t("motivo_sin_datos");
  if (te.estado === "fuera") return te.proxima ? t("motivo_fuera", { cultivo, fecha: fecha(te.proxima.inicio, true) }) : t("motivo_fuera_sin", { cultivo });
  if (te.estado === "temprana") return t("motivo_temprana", { n: te.dias_fuera ?? 0 });
  if (te.estado === "tardia") return t("motivo_tardia", { n: te.dias_fuera ?? 0 });
  if (h.estado === "seco" || h.estado === "bajo") return t("motivo_seco");
  if (h.estado === "saturado") return t("motivo_saturado");
  if (te.estado === "tramo_tardio") return t("motivo_tramo", { n: te.dias_restantes ?? 0 });
  return t("motivo_bien");
}

/** seco / bueno / mojado: los tres tonos con que la app muestra el agua del suelo. */
export const tonoAguaDe = (estado: Analisis["humedad"]["estado"]) =>
  estado === "seco" || estado === "bajo" ? ("seco" as const) : estado === "optimo" ? ("bueno" as const) : ("mojado" as const);
