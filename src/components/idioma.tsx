"use client";
// Idioma ES/EN. Space Apps exige inglés para el jurado; los agricultores usan español.
// Se elige por: preferencia guardada > idioma del navegador > español.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Idioma = "es" | "en";
export type Texto = Record<Idioma, string>;

const TEXTOS = {
  titulo: { es: "Analizá tu suelo.", en: "Analyze your soil." },
  subtitulo: {
    es: "Descubrí qué cultivos se adaptan mejor a tu terreno.",
    en: "Discover which crops best suit your land.",
  },
  conocer: { es: "Conocer cultivo", en: "Explore crop" },
  irACultivo: { es: "Ver datos del suelo para", en: "See soil data for" },
  aviso: {
    es: "Humedad del suelo NISAR real pero provisional (sin validación de campo) y umbrales supuestos: es una orientación, consultá a tu técnico.",
    en: "Real but provisional NISAR soil moisture (not field-validated) and assumed thresholds: guidance only, consult your agronomist.",
  },
  pie: {
    es: "Datos: NISAR (NASA-ISRO, ASF DAAC) y NASA POWER. Proyecto comunitario, no afiliado ni respaldado por NASA.",
    en: "Data: NASA-ISRO NISAR (ASF DAAC) and NASA POWER. Community project, not affiliated with or endorsed by NASA.",
  },
  cargando: { es: "Cargando…", en: "Loading…" },
  // Navegación
  navCultivos: { es: "Cultivos", en: "Crops" },
  navSuelo: { es: "Suelo", en: "Soil" },
  navClima: { es: "Clima", en: "Weather" },
  modoClaro: { es: "Cambiar a modo claro", en: "Switch to light mode" },
  modoOscuro: { es: "Cambiar a modo oscuro", en: "Switch to dark mode" },
  // Suelo
  sueloTitulo: { es: "Humedad del suelo", en: "Soil moisture" },
  sueloSubtitulo: {
    es: "Elegí tu cultivo y tocá tu zona en el mapa.",
    en: "Pick your crop and tap your area on the map.",
  },
  cultivo: { es: "Cultivo", en: "Crop" },
  zona: { es: "Zona", en: "Area" },
  recomendacion: { es: "Recomendación", en: "Guidance" },
  humedadActual: { es: "Última humedad", en: "Latest moisture" },
  retrodispersion: { es: "Retrodispersión HV", en: "HV backscatter" },
  observaciones: { es: "Observaciones", en: "Observations" },
  serieTitulo: { es: "Evolución de la humedad", en: "Moisture over time" },
  calidadDudosa: { es: "calidad dudosa", en: "low quality" },
  umbralesSupuestos: {
    es: "Umbrales provisionales, sin validación agronómica. Consultá siempre a tu técnico.",
    en: "Provisional thresholds, not agronomically validated. Always consult your agronomist.",
  },
  fuente: { es: "Fuente", en: "Source" },
  sinDatos: { es: "Sin datos", en: "No data" },
  estado_sembrar: { es: "Sembrar", en: "Sow" },
  estado_esperar: { es: "Esperar", en: "Wait" },
  estado_precaucion: { es: "Precaución", en: "Caution" },
  // Análisis (motor del backend)
  humedadSuelo: { es: "Humedad del suelo", en: "Soil moisture" },
  humedad_seco: { es: "Seco", en: "Dry" },
  humedad_bajo: { es: "Bajo", en: "Low" },
  humedad_optimo: { es: "Óptimo", en: "Optimal" },
  humedad_humedo: { es: "Húmedo", en: "Wet" },
  humedad_saturado: { es: "Saturado", en: "Saturated" },
  humedad_sin_datos: { es: "Sin datos", en: "No data" },
  tendencia_subiendo: { es: "subiendo", en: "rising" },
  tendencia_bajando: { es: "bajando", en: "falling" },
  tendencia_estable: { es: "estable", en: "steady" },
  cuandoSembrar: { es: "¿Cuándo sembrar?", en: "When to sow?" },
  sembrarAhora: { es: "Ahora", en: "Now" },
  enDias: { es: "En {n} días", en: "In {n} days" },
  semillaSugerida: { es: "Semilla sugerida", en: "Suggested seed" },
  alertas: { es: "Alertas", en: "Alerts" },
  sinAlertas: { es: "Sin alertas para esta fecha.", en: "No alerts for this date." },
  fechaAnalisis: { es: "Analizado al", en: "Analyzed as of" },
  datoSatelital: { es: "dato satelital", en: "satellite data" },
  // Lote dibujado
  marcarLote: { es: "Marcar mi lote", en: "Draw my plot" },
  terminarLote: { es: "Terminar", en: "Finish" },
  deshacer: { es: "Deshacer", en: "Undo" },
  borrar: { es: "Borrar", en: "Clear" },
  ayudaDibujo: {
    es: "Tocá el mapa para marcar las esquinas de tu lote (mínimo 3) y después «Terminar».",
    en: "Tap the map to mark your plot's corners (at least 3), then «Finish».",
  },
  tuLote: { es: "Tu lote", en: "Your plot" },
  hectareas: { es: "hectáreas", en: "hectares" },
  areaReferencia: { es: "Área NISAR de referencia", en: "Reference NISAR area" },
  analizandoLote: { es: "Analizando tu lote…", en: "Analyzing your plot…" },
  // Capas del mapa
  capaMapa: { es: "Mapa", en: "Map" },
  capaSatelite: { es: "Satélite", en: "Satellite" },
  capaNdvi: { es: "NASA NDVI (vigor vegetal)", en: "NASA NDVI (vegetation vigor)" },
  capaHls: { es: "NASA HLS 30 m (color real)", en: "NASA HLS 30 m (true color)" },
  // Clima
  climaTitulo: { es: "Clima", en: "Weather" },
  proximamente: { es: "Próximamente", en: "Coming soon" },
  climaTexto: {
    es: "Pronóstico de lluvia y temperatura por zona, combinado con la humedad del suelo, para planificar mejor la siembra.",
    en: "Rain and temperature forecast by area, combined with soil moisture, to plan sowing better.",
  },
} satisfies Record<string, Texto>;

export type Clave = keyof typeof TEXTOS;

const Ctx = createContext<{ idioma: Idioma; setIdioma: (i: Idioma) => void }>({ idioma: "es", setIdioma: () => {} });

function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem("idioma");
    if (guardado === "es" || guardado === "en") return guardado;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>("es");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee del navegador solo después de hidratar
    setIdiomaState(idiomaInicial());
  }, []);

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  const setIdioma = (i: Idioma) => {
    setIdiomaState(i);
    try {
      localStorage.setItem("idioma", i);
    } catch {}
  };

  return <Ctx.Provider value={{ idioma, setIdioma }}>{children}</Ctx.Provider>;
}

export function useIdioma() {
  const { idioma, setIdioma } = useContext(Ctx);
  const t = (clave: Clave) => TEXTOS[clave][idioma];
  const tr = (texto: Texto) => texto[idioma];
  return { idioma, setIdioma, t, tr };
}

/** Botón compacto: muestra el idioma al que se cambia. */
export function BotonIdioma() {
  const { idioma, setIdioma } = useIdioma();
  const otro: Idioma = idioma === "es" ? "en" : "es";
  return (
    <button
      type="button"
      onClick={() => setIdioma(otro)}
      aria-label={idioma === "es" ? "Switch to English" : "Cambiar a español"}
      title={idioma === "es" ? "Switch to English" : "Cambiar a español"}
      className="grid h-8 min-w-8 place-items-center rounded-full border border-borde bg-barra px-2 text-[11px] font-bold uppercase tracking-wide text-acento backdrop-blur transition-colors hover:bg-tarjeta-2"
    >
      {otro}
    </button>
  );
}
