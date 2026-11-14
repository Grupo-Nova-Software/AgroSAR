// Clasifica una fecha de siembra respecto de las temporadas del cultivo.
// Problemas que cubre: siembra temprana (escenario 1), siembra tardía (escenario 2), fuera de temporada.
import type { ClasifTemporada, CultivoConfig } from "./tipos";
import { diasEntre, ocurrencias } from "./fechas";

export function clasificarTemporada(cfg: CultivoConfig, fecha: string): ClasifTemporada {
  const periodos = cfg.temporadas.flatMap((t) => ocurrencias(t.inicio, t.fin, fecha).map((o) => ({ t, ...o })));
  const resumen = (p: (typeof periodos)[number]) => ({
    id: p.t.id,
    nombre: p.t.nombre,
    ideal: p.t.ideal,
    inicio: p.inicio,
    fin: p.fin,
  });

  const futuras = periodos.filter((p) => p.inicio > fecha).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  const proxima = futuras[0]
    ? { id: futuras[0].t.id, nombre: futuras[0].t.nombre, inicio: futuras[0].inicio, dias_hasta: diasEntre(fecha, futuras[0].inicio) }
    : null;

  // 1) Dentro de una ventana.
  const dentro = periodos.find((p) => p.inicio <= fecha && fecha <= p.fin);
  if (dentro) {
    const restantes = diasEntre(fecha, dentro.fin);
    return {
      fecha,
      estado: restantes <= cfg.tramo_tardio_dias ? "tramo_tardio" : "en_ventana",
      temporada: resumen(dentro),
      dias_restantes: restantes,
      dias_fuera: null,
      proxima,
    };
  }

  // 2) Poco antes de que abra una ventana → temprana.
  if (futuras[0] && diasEntre(fecha, futuras[0].inicio) <= cfg.tolerancia_temprana_dias) {
    return {
      fecha,
      estado: "temprana",
      temporada: resumen(futuras[0]),
      dias_restantes: null,
      dias_fuera: diasEntre(fecha, futuras[0].inicio),
      proxima,
    };
  }

  // 3) Poco después de que cerró una ventana → tardía.
  const pasadas = periodos.filter((p) => p.fin < fecha).sort((a, b) => (a.fin > b.fin ? -1 : 1));
  if (pasadas[0] && diasEntre(pasadas[0].fin, fecha) <= cfg.tardia_max_dias) {
    return {
      fecha,
      estado: "tardia",
      temporada: resumen(pasadas[0]),
      dias_restantes: null,
      dias_fuera: diasEntre(pasadas[0].fin, fecha),
      proxima,
    };
  }

  return { fecha, estado: "fuera", temporada: null, dias_restantes: null, dias_fuera: null, proxima };
}

export function esSiembraTardia(c: ClasifTemporada): boolean {
  return c.estado === "tardia" || c.estado === "tramo_tardio";
}
