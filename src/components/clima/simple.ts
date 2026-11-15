// Clima simple: convierte la respuesta de /api/clima en pocas frases claras para el agricultor.
// Son reglas fijas sobre los datos (no las escribe una IA en vivo) y usan los umbrales SUPUESTOS del equipo
// que ya trae el backend (regla de pulverización, calor, helada, nivel de sequía). Orientación general: no reemplaza al técnico.
import type { DiaDetalle, RespuestaClima } from "@/lib/clima/tipos";
import type { NombreIcono, TipoClima } from "../Icono";
import type { Idioma } from "../idioma";

export type TonoConsejo = "bien" | "aviso" | "peligro";
export interface ConsejoClima {
  id: string;
  icono: NombreIcono;
  tono: TonoConsejo;
  titulo: string;
  texto: string;
}

/** Dibujo del día según la lluvia esperada (el pronóstico no trae nubosidad). */
export const iconoDia = (mmDia: number | null, prob: number | null): TipoClima => {
  const mm = Math.round(mmDia ?? 0); // redondeado, igual que el número que se muestra
  return mm >= 40 ? "tormenta" : mm >= 10 ? "lluvia" : mm >= 1 ? "llovizna" : (prob ?? 0) >= 50 ? "nube" : (prob ?? 0) >= 25 ? "parcial" : "sol";
};

/** Frase corta del día: "Llueve fuerte", "No llueve"… */
export function fraseDia(d: Pick<DiaDetalle, "mm" | "prob_pct"> | null | undefined, idioma: Idioma): string {
  const mm = Math.round(d?.mm ?? 0);
  const es = idioma === "es";
  if (mm >= 40) return es ? "Llueve fuerte" : "Heavy rain";
  if (mm >= 10) return es ? "Llueve" : "Rain";
  if (mm >= 1) return es ? "Llovizna" : "Light rain";
  if ((d?.prob_pct ?? 0) >= 50) return es ? "Nublado, casi sin lluvia" : "Cloudy, little rain";
  return es ? "No llueve" : "No rain";
}

const hora = (iso: string) => `${Number(iso.slice(11, 13))} h`;

export function consejosDe(datos: RespuestaClima, idioma: Idioma, diaCorto: (iso: string) => string): ConsejoClima[] {
  const es = idioma === "es";
  const lista: ConsejoClima[] = [];
  const hoy = datos.diario.find((d) => d.fecha === datos.hoy) ?? datos.diario[0];
  const manana = datos.lluvia?.manana;
  const mm = (v: number) => Math.round(v);

  // 1) Lluvia fuerte o lluvia que viene
  const lluviaHoy = datos.lluvia?.hoy;
  if (lluviaHoy && lluviaHoy.mm >= 40) {
    lista.push({
      id: "lluvia_fuerte_hoy", icono: "lluvia", tono: "peligro",
      titulo: es ? `Hoy llueve fuerte (${mm(lluviaHoy.mm)} mm)` : `Heavy rain today (${mm(lluviaHoy.mm)} mm)`,
      texto: es
        ? "No pulverices ni abones: el agua se lo lleva y perdés el producto. Revisá que el agua tenga por dónde salir de la chacra."
        : "Do not spray or fertilize: the rain washes the product away. Check that water can drain out of the field.",
    });
  } else if (manana && manana.mm >= 40) {
    lista.push({
      id: "lluvia_fuerte_manana", icono: "lluvia", tono: "aviso",
      titulo: es ? `Mañana llueve fuerte (${mm(manana.mm)} mm)` : `Heavy rain tomorrow (${mm(manana.mm)} mm)`,
      texto: es
        ? "Si pulverizás o abonás hoy, la lluvia lo puede lavar. Mejor esperá a que pase. Con el suelo empapado, no entres con máquinas."
        : "If you spray or fertilize today, the rain may wash it off. Better wait. Keep machinery off soaked soil.",
    });
  } else if (manana && manana.llueve && manana.mm >= 10) {
    lista.push({
      id: "lluvia_manana", icono: "lluvia", tono: "bien",
      titulo: es ? `Mañana llueve (${mm(manana.mm)} mm)` : `Rain tomorrow (${mm(manana.mm)} mm)`,
      texto: es
        ? `Buena lluvia para cargar el suelo${manana.pico ? `, sobre todo de ${Number(manana.pico.desde.slice(0, 2))} a ${Number(manana.pico.hasta.slice(0, 2))} h` : ""}. No pulverices justo antes: se lava.`
        : `Good rain to refill the soil${manana.pico ? `, mostly from ${manana.pico.desde} to ${manana.pico.hasta}` : ""}. Do not spray right before it.`,
    });
  }

  // 2) Pulverizar: cuándo sí y cuándo no (regla supuesta del equipo: viento, lluvia, calor y humedad del aire)
  const pulv = datos.pulverizacion;
  if (pulv) {
    const queda = pulv.hoy.bloques.find((b) => b.hasta > datos.hora_actual);
    const r = pulv.regla;
    if (queda) {
      const desde = queda.desde > datos.hora_actual ? queda.desde : datos.hora_actual;
      lista.push({
        id: "pulverizar_hoy", icono: "pulverizar", tono: "bien",
        titulo: es ? `Para pulverizar hoy: de ${hora(desde)} a ${hora(queda.hasta)}` : `Spray window today: ${desde.slice(11, 16)}–${queda.hasta.slice(11, 16)}`,
        texto: es
          ? "A esa hora hay poco viento, no llueve y no hace tanto calor: el producto queda en la planta y no lo tirás."
          : "Light wind, no rain and milder heat at that time: the product stays on the plant instead of being wasted.",
      });
    } else if (pulv.manana.bloques[0]) {
      const b = pulv.manana.bloques[0];
      lista.push({
        id: "pulverizar_manana", icono: "pulverizar", tono: "aviso",
        titulo: es ? `Hoy no conviene pulverizar. Mañana sí: de ${hora(b.desde)} a ${hora(b.hasta)}` : `Not a good day to spray. Tomorrow: ${b.desde.slice(11, 16)}–${b.hasta.slice(11, 16)}`,
        texto: es
          ? `Hoy hay viento de más de ${r.viento_max_kmh} km/h, lluvia o mucho calor, y el producto se pierde.`
          : `Today has wind above ${r.viento_max_kmh} km/h, rain or too much heat, so the product would be lost.`,
      });
    } else {
      lista.push({
        id: "pulverizar_no", icono: "cerrar", tono: "aviso",
        titulo: es ? "Hoy y mañana no conviene pulverizar" : "Not a good time to spray today or tomorrow",
        texto: es ? "Hay viento, lluvia o mucho calor. Si pulverizás igual, gastás producto de balde." : "Wind, rain or heat. Spraying anyway wastes product.",
      });
    }
  }

  // 3) Días secos seguidos: trabajos de campo
  const seca = datos.ventanas_secas?.find((v) => v.dias >= 3);
  if (seca && !(lluviaHoy && lluviaHoy.mm >= 10)) {
    lista.push({
      id: "dias_secos", icono: "sol", tono: "bien",
      titulo: es ? `${seca.dias} días seguidos sin lluvia (${diaCorto(seca.desde)} a ${diaCorto(seca.hasta)})` : `${seca.dias} dry days in a row (${diaCorto(seca.desde)} to ${diaCorto(seca.hasta)})`,
      texto: es ? "Buenos días para entrar a la chacra con máquinas, cosechar o carpir." : "Good days for field work with machinery, harvesting or weeding.",
    });
  }

  // 4) Calor fuerte
  const temp = datos.temperatura;
  if (temp && (temp.hoy.estres_calor || temp.manana.estres_calor)) {
    lista.push({
      id: "calor", icono: "termometro", tono: "peligro",
      titulo: es ? `Calor fuerte ${temp.hoy.estres_calor ? "hoy" : "mañana"} (más de ${temp.umbral_calor_c} °C)` : `Strong heat ${temp.hoy.estres_calor ? "today" : "tomorrow"} (above ${temp.umbral_calor_c} °C)`,
      texto: es
        ? "Trabajá y pulverizá bien temprano o al atardecer. Tomá mucha agua y descansá a la sombra a la siesta. Con este calor la planta sufre si le falta agua."
        : "Work and spray early or at dusk. Drink water and rest in the shade at midday. Plants suffer in this heat if water is short.",
    });
  }

  // 5) Helada
  const h = temp?.helada;
  if (h && h.riesgo !== "ninguno" && h.minima_pronosticada) {
    lista.push({
      id: "helada", icono: "copo", tono: h.riesgo === "alto" ? "peligro" : "aviso",
      titulo: es
        ? `Puede helar el ${diaCorto(h.minima_pronosticada.fecha)} (mínima ${Math.round(h.minima_pronosticada.c)} °C)`
        : `Frost possible on ${diaCorto(h.minima_pronosticada.fecha)} (low ${Math.round(h.minima_pronosticada.c)} °C)`,
      texto: es
        ? "Si tenés plantas recién nacidas, la helada las puede quemar. Si todavía no sembraste, esperá a que pase el frío."
        : "Frost can burn newly emerged plants. If you have not planted yet, wait until the cold passes.",
    });
  }

  // 6) Viento fuerte
  if (hoy && (hoy.viento_max_kmh ?? 0) >= 30) {
    lista.push({
      id: "viento", icono: "viento", tono: "aviso",
      titulo: es ? `Viento fuerte hoy (hasta ${Math.round(hoy.viento_max_kmh!)} km/h)` : `Strong wind today (up to ${Math.round(hoy.viento_max_kmh!)} km/h)`,
      texto: es ? "No pulverices: el viento se lleva el producto a otra chacra." : "Do not spray: the wind carries the product to the next field.",
    });
  }

  // 7) Falta de agua (nivel calculado por el backend con lluvia, evaporación y radar NISAR)
  const s = datos.sequia;
  if (s.nivel !== "optimo") {
    const lluviaQueViene = datos.diario.slice(0, 7).reduce((a, d) => a + (d.mm ?? 0), 0);
    lista.push({
      id: "sequia", icono: "sequia", tono: s.nivel === "atencion" ? "aviso" : "peligro",
      titulo: es
        ? s.nivel === "atencion" ? "El suelo está perdiendo agua" : "Falta agua en el suelo"
        : s.nivel === "atencion" ? "The soil is losing water" : "The soil is short of water",
      texto: es
        ? `Hace ${s.dias_sin_lluvia} días que no llueve bien. ${lluviaQueViene >= 15 ? `En los próximos 7 días se esperan ${mm(lluviaQueViene)} mm: si vas a sembrar, esperá esa lluvia para no perder la semilla.` : "Y no se ve lluvia importante en los próximos 7 días: si sembrás ahora, la semilla puede no nacer."}`
        : `No good rain for ${s.dias_sin_lluvia} days. ${lluviaQueViene >= 15 ? `About ${mm(lluviaQueViene)} mm expected in the next 7 days: if you plan to plant, wait for that rain.` : "No significant rain in the next 7 days: seed planted now may fail to emerge."}`,
    });
  }

  // 8) Suelo según el radar NISAR (solo si la pasada es reciente)
  const nisar = s.nisar;
  if (nisar && !nisar.desactualizada && (nisar.estado === "saturado" || nisar.estado === "seco")) {
    lista.push(
      nisar.estado === "saturado"
        ? {
            id: "suelo_mojado", icono: "gota", tono: "aviso",
            titulo: es ? "El satélite vio el suelo muy mojado" : "The satellite saw very wet soil",
            texto: es ? "No entres con máquinas pesadas: se hunden y aprietan la tierra. Esperá unos días de sol." : "Keep heavy machinery out: it sinks and compacts the soil. Wait for a few sunny days.",
          }
        : {
            id: "suelo_seco", icono: "semilla", tono: "aviso",
            titulo: es ? "El satélite vio el suelo seco" : "The satellite saw dry soil",
            texto: es ? "Para sembrar conviene esperar una buena lluvia, así la semilla nace pareja." : "Wait for a good rain before planting so the seed emerges evenly.",
          },
    );
  }

  if (!lista.length) {
    lista.push({
      id: "normal", icono: "bien", tono: "bien",
      titulo: es ? "Días normales para trabajar" : "Normal working days",
      texto: es ? "No hay lluvia fuerte, calor ni frío que complique el trabajo." : "No heavy rain, heat or cold to get in the way.",
    });
  }
  return lista;
}
