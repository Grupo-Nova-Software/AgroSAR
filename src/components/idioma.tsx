"use client";
// Idioma ES/EN. Space Apps exige inglés para el jurado; los agricultores usan español.
// Se elige por: preferencia guardada > idioma del navegador > español.
// Los textos están escritos para gente de campo: frases cortas, sin términos técnicos.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Idioma = "es" | "en";
export type Texto = Record<Idioma, string>;

const TEXTOS = {
  // Inicio
  titulo: { es: "Analizá tu suelo.", en: "Check your soil." },
  subtitulo: { es: "Elegí tu cultivo para empezar.", en: "Pick your crop to start." },
  conocer: { es: "Ver mi suelo", en: "See my soil" },
  irACultivo: { es: "Ver el suelo para", en: "See the soil for" },
  pie: {
    es: "Datos del satélite NISAR (NASA-ISRO). Proyecto comunitario, no afiliado ni respaldado por NASA.",
    en: "Data from the NISAR satellite (NASA-ISRO). Community project, not affiliated with or endorsed by NASA.",
  },
  cargando: { es: "Cargando…", en: "Loading…" },

  // Inicio: historia "Del cielo a la raíz" (acompaña al fondo que baja con el scroll)
  historiaTitulo: { es: "Del cielo a la raíz", en: "From sky to root" },
  historiaBajar: { es: "Bajá para ver qué pasa con el agua debajo de tu cultivo.", en: "Scroll down to see what happens to the water below your crop." },
  capaCieloTitulo: { es: "El cielo", en: "The sky" },
  capaCieloTexto: {
    es: "Lluvia, calor y viento. El pronóstico es de Open-Meteo (un modelo, no es dato de NASA) y la lluvia de los últimos días, de NASA POWER.",
    en: "Rain, heat and wind. The forecast comes from Open-Meteo (a model, not NASA data) and recent rain from NASA POWER.",
  },
  capaSuperficieTitulo: { es: "La superficie: 0 a 5 cm", en: "The surface: 0 to 5 cm" },
  capaSuperficieTexto: {
    es: "El radar NISAR (NASA-ISRO) mide el agua en los primeros centímetros del suelo, en cuadros de 200 m. Es un dato nuevo y todavía provisional.",
    en: "The NISAR radar (NASA-ISRO) measures the water in the top few centimeters of soil, in 200 m squares. It is new and still provisional data.",
  },
  capaRaizTitulo: { es: "Las raíces", en: "The roots" },
  capaRaizTexto: {
    es: "Las raíces toman agua más abajo, donde el radar no llega. Por eso AgroSAR te da una orientación, no una medición: mirá también tu suelo.",
    en: "Roots take water from deeper down, where the radar cannot reach. That is why AgroSAR gives you guidance, not a measurement: check your soil too.",
  },

  // Menú y navegación
  menu: { es: "Menú", en: "Menu" },
  cerrar: { es: "Cerrar", en: "Close" },
  navCultivos: { es: "Inicio", en: "Home" },
  navSuelo: { es: "Mi suelo", en: "My soil" },
  navClima: { es: "Clima", en: "Weather" },
  navAyuda: { es: "Ayuda", en: "Help" },
  miCultivo: { es: "Mi cultivo", en: "My crop" },
  irA: { es: "Ir a", en: "Go to" },
  ajustes: { es: "Ajustes", en: "Settings" },
  idioma: { es: "Idioma", en: "Language" },
  modoOscuro: { es: "Modo oscuro", en: "Dark mode" },
  cambiarCultivo: { es: "Cambiar cultivo", en: "Change crop" },

  // Mapa
  capaSatelite: { es: "Vista aérea", en: "Aerial view" },
  capaCalles: { es: "Calles", en: "Streets" },
  capaNombres: { es: "Nombres de lugares", en: "Place names" },
  verHumedad: { es: "Agua en el suelo", en: "Soil water" },
  seco: { es: "Seco", en: "Dry" },
  bueno: { es: "Bueno", en: "Good" },
  mojado: { es: "Mojado", en: "Wet" },
  pasadaDel: { es: "Satélite:", en: "Satellite:" },
  anterior: { es: "Fecha anterior", en: "Earlier date" },
  siguiente: { es: "Fecha siguiente", en: "Later date" },
  miUbicacion: { es: "Ir a mi ubicación", en: "Go to my location" },
  sinUbicacion: {
    es: "No pudimos ver tu ubicación. Activá la ubicación del teléfono y probá de nuevo.",
    en: "We couldn't get your location. Turn on location on your phone and try again.",
  },
  marcarChacra: { es: "Marcar mi chacra", en: "Mark my field" },
  cambiarChacra: { es: "Cambiar mi chacra", en: "Change my field" },
  ayudaDibujo0: { es: "Tocá el mapa en cada esquina de tu chacra.", en: "Tap the map on each corner of your field." },
  ayudaDibujoN: {
    es: "Seguí tocando las esquinas. Podés arrastrar un punto para corregirlo.",
    en: "Keep tapping the corners. Drag a point to fix it.",
  },
  listo: { es: "Listo", en: "Done" },
  deshacer: { es: "Deshacer", en: "Undo" },
  borrar: { es: "Borrar", en: "Clear" },
  hectareas: { es: "hectáreas", en: "hectares" },
  ha: { es: "ha", en: "ha" },
  zona: { es: "Zona", en: "Area" },

  dondeEstoy: { es: "Dónde estoy", en: "Where I am" },
  zonasConDatos: { es: "Zonas con datos", en: "Areas with data" },
  agregarOtra: { es: "Agregar otra chacra", en: "Add another field" },
  cambiarForma: { es: "Cambiar forma", en: "Change shape" },
  cancelar: { es: "Cancelar", en: "Cancel" },
  guardar: { es: "Guardar", en: "Save" },

  // Mis chacras
  navChacras: { es: "Mis chacras", en: "My fields" },
  chacrasTitulo: { es: "Mis chacras", en: "My fields" },
  chacrasSub: { es: "Cómo están todas tus chacras, de un vistazo.", en: "How all your fields are doing, at a glance." },
  chacrasVacio: {
    es: "Todavía no marcaste ninguna chacra. Marcala en el mapa y la vas a poder seguir desde acá.",
    en: "You haven't marked any field yet. Mark it on the map and you'll follow it from here.",
  },
  marcarPrimera: { es: "Marcar mi primera chacra", en: "Mark my first field" },
  verEnMapa: { es: "Ver en el mapa", en: "See on the map" },
  nombreChacra: { es: "Nombre de la chacra", en: "Field name" },
  editarChacra: { es: "Editar esta chacra", en: "Edit this field" },
  colorChacra: { es: "Color en el mapa", en: "Colour on the map" },
  renombrar: { es: "Cambiar nombre", en: "Rename" },
  queSiembra: { es: "¿Qué sembrás acá?", en: "What do you sow here?" },
  borrarChacra: { es: "Borrar esta chacra", en: "Delete this field" },
  confirmarBorrar: { es: "¿Borrar «{nombre}»? No se puede deshacer.", en: "Delete «{nombre}»? This can't be undone." },
  actualizando: { es: "Actualizando…", en: "Updating…" },
  sinConexion: {
    es: "Sin internet: te mostramos lo último que guardamos en el teléfono.",
    en: "No internet: showing the last data saved on your phone.",
  },
  guardadoEl: { es: "Guardado el {fecha}", en: "Saved on {fecha}" },
  sinResultado: { es: "Conectate a internet para ver cómo está.", en: "Connect to the internet to see how it is." },
  resumenChacras: {
    es: "{s} para sembrar · {e} esperar · {p} no sembrar",
    en: "{s} to sow · {e} wait · {p} don't sow",
  },
  chacraGuardada: { es: "¡Chacra guardada! Mirá cómo está abajo.", en: "Field saved! See how it is below." },
  verResultado: { es: "Ver cómo está mi chacra", en: "See how my field is" },
  verConsejo: { es: "Ver qué me conviene", en: "See what to do" },
  elegirChacra: { es: "Tocá una chacra en el mapa para ver cómo está.", en: "Tap a field on the map to see how it is." },

  // Resultado
  tuChacra: { es: "Tu chacra", en: "Your field" },
  zonaDe: { es: "Zona", en: "Area" },
  pistaChacra: {
    es: "Marcá tu chacra en el mapa para ver el dato de tu propio terreno.",
    en: "Mark your field on the map to see the data for your own land.",
  },
  sinDatosAqui: {
    es: "Todavía no tenemos datos del satélite para este lugar. Te mostramos la zona más cercana.",
    en: "We don't have satellite data for this place yet. Showing the nearest area.",
  },
  analizando: { es: "Mirando tu chacra…", en: "Checking your field…" },
  titulo_sembrar: { es: "Buen momento para sembrar", en: "Good time to sow" },
  titulo_esperar: { es: "Mejor esperá", en: "Better wait" },
  titulo_precaucion: { es: "No siembres ahora", en: "Don't sow now" },
  // Motivos (una sola frase, la más importante)
  motivo_fuera: {
    es: "Ahora no es época de sembrar {cultivo}. La próxima siembra empieza el {fecha}.",
    en: "It isn't {cultivo} sowing season now. The next one starts on {fecha}.",
  },
  motivo_fuera_sin: { es: "Ahora no es época de sembrar {cultivo}.", en: "It isn't {cultivo} sowing season now." },
  motivo_temprana: {
    es: "Falta poco: la época de siembra empieza en {n} días.",
    en: "Almost there: sowing season starts in {n} days.",
  },
  motivo_tardia: {
    es: "La época de siembra cerró hace {n} días. Si sembrás igual, usá una semilla de ciclo corto.",
    en: "Sowing season closed {n} days ago. If you still sow, use a short-cycle seed.",
  },
  motivo_seco: { es: "Al suelo le falta agua. Esperá una buena lluvia.", en: "The soil needs water. Wait for a good rain." },
  motivo_saturado: {
    es: "El suelo está muy mojado. Esperá unos días a que oree.",
    en: "The soil is too wet. Wait a few days for it to dry.",
  },
  motivo_tramo: {
    es: "El suelo tiene buena agua, pero quedan solo {n} días de siembra. No lo dejes pasar.",
    en: "Soil water is good, but only {n} sowing days are left. Don't miss them.",
  },
  motivo_bien: {
    es: "El suelo tiene buena agua y estás en época de siembra.",
    en: "Soil water is good and you are in sowing season.",
  },
  motivo_sin_datos: {
    es: "No tenemos un dato reciente del satélite para decidir.",
    en: "We don't have recent satellite data to decide.",
  },
  // Datos simples
  aguaSuelo: { es: "Agua en el suelo", en: "Soil water" },
  agua_seco: { es: "Muy seco", en: "Very dry" },
  agua_bajo: { es: "Algo seco", en: "A bit dry" },
  agua_optimo: { es: "Buena", en: "Good" },
  agua_humedo: { es: "Bastante mojado", en: "Quite wet" },
  agua_saturado: { es: "Demasiado mojado", en: "Too wet" },
  agua_sin_datos: { es: "Sin dato", en: "No data" },
  tend_subiendo: { es: "va subiendo", en: "going up" },
  tend_bajando: { es: "va bajando", en: "going down" },
  tend_estable: { es: "se mantiene", en: "steady" },
  datoDel: { es: "Dato del satélite", en: "Satellite data from" },
  haceDias: { es: "hace {n} días", en: "{n} days ago" },
  hoy: { es: "hoy", en: "today" },
  datoViejo: {
    es: "Es un dato viejo. Revisá tu suelo con la mano antes de decidir.",
    en: "This data is old. Check your soil by hand before deciding.",
  },
  semilla: { es: "Semilla sugerida", en: "Suggested seed" },
  cicloDias: { es: "ciclo de {n} días", en: "{n}-day cycle" },
  proximaSiembra: { es: "Próxima siembra", en: "Next sowing" },
  consejos: { es: "Consejos", en: "Tips" },
  masInfo: { es: "¿De dónde sale esto?", en: "Where does this come from?" },

  // Gráfico
  graficoTitulo: { es: "Cómo viene el agua en el suelo", en: "How soil water has been" },
  graficoSub: {
    es: "Cada punto es una pasada del satélite. La franja verde es lo bueno para {cultivo}.",
    en: "Each dot is one satellite pass. The green band is what's good for {cultivo}.",
  },
  sinDatos: { es: "Sin datos", en: "No data" },

  // Clima
  climaTitulo: { es: "Clima", en: "Weather" },
  proximamente: { es: "Próximamente", en: "Coming soon" },
  climaTexto: {
    es: "Acá vas a ver si viene lluvia en tu zona, para planificar mejor la siembra.",
    en: "Here you'll see whether rain is coming to your area, to plan sowing better.",
  },

  // Ayuda
  ayudaTitulo: { es: "Ayuda", en: "Help" },
  ayudaComo: { es: "Cómo se usa", en: "How to use it" },
  ayudaPaso1: { es: "Elegí tu cultivo en el inicio.", en: "Pick your crop on the home screen." },
  ayudaPaso2: {
    es: "En el mapa, tocá «Marcar mi chacra», tocá cada esquina de tu terreno y después «Guardar». Podés marcar varias.",
    en: "On the map, tap «Mark my field», tap each corner of your land, then «Save». You can mark several.",
  },
  ayudaPaso3: {
    es: "Mirá el cartel de color: te dice si conviene sembrar, esperar o no sembrar. En «Mis chacras» ves todas juntas.",
    en: "Look at the colored sign: it tells you to sow, wait, or not sow. «My fields» shows them all together.",
  },
  ayudaSinInternet: {
    es: "Sin internet: tus chacras y el último resultado quedan guardados en el teléfono, y el mapa de las zonas que ya miraste también.",
    en: "Offline: your fields and their last result stay saved on your phone, and so does the map of the areas you already viewed.",
  },
  ayudaColores: { es: "Qué significan los colores", en: "What the colors mean" },
  ayudaVerde: { es: "Verde: buen momento para sembrar.", en: "Green: good time to sow." },
  ayudaAmarillo: { es: "Amarillo: mejor esperar.", en: "Yellow: better to wait." },
  ayudaRojo: { es: "Rojo: no siembres ahora.", en: "Red: don't sow now." },
  ayudaMapa: {
    es: "En el mapa, el marrón es suelo seco, el verde es suelo con buena agua y el azul es suelo muy mojado.",
    en: "On the map, brown is dry soil, green is soil with good water and blue is very wet soil.",
  },
  ayudaDatos: { es: "Sobre los datos", en: "About the data" },
  ayudaDatos1: {
    es: "El agua del suelo la mide el satélite NISAR (NASA-ISRO) con radar, cada 12 días, en cuadros de 200 metros. Mide los primeros centímetros del suelo.",
    en: "Soil water is measured by the NISAR satellite (NASA-ISRO) with radar, every 12 days, in 200-meter squares. It measures the top few centimeters of soil.",
  },
  ayudaDatos2: {
    es: "Es un dato real pero provisional: todavía no fue validado en el campo. El satélite lo publica con algunas semanas de demora.",
    en: "The data is real but provisional: it has not been field-validated yet. The satellite publishes it a few weeks late.",
  },
  ayudaDatos3: {
    es: "Los límites de seco, bueno y mojado, y las fechas de siembra, son supuestos del equipo y falta validarlos con técnicos. Esto es una orientación: consultá siempre a tu técnico.",
    en: "The dry, good and wet limits, and the sowing dates, are the team's assumptions and still need validation by agronomists. This is guidance only: always consult your agronomist.",
  },
  ayudaFuentes: {
    es: "Fuentes: NISAR L3 SME2 (NASA-ISRO, ASF DAAC) · Imágenes aéreas: Esri, Maxar, Earthstar Geographics · Calles: OpenStreetMap.",
    en: "Sources: NISAR L3 SME2 (NASA-ISRO, ASF DAAC) · Aerial imagery: Esri, Maxar, Earthstar Geographics · Streets: OpenStreetMap.",
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
  /** Texto de la clave; `vars` reemplaza {nombre} dentro del texto. */
  const t = (clave: Clave, vars?: Record<string, string | number>) => {
    let s: string = TEXTOS[clave][idioma];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
  const tr = (texto: Texto) => texto[idioma];
  /** Fecha corta y legible: "17 oct" / "Oct 17" (con año si se pide). */
  const fecha = (iso: string, conAnio = false) =>
    new Date(iso + "T12:00:00").toLocaleDateString(idioma === "es" ? "es-PY" : "en-US", {
      day: "numeric",
      month: "short",
      ...(conAnio ? { year: "numeric" } : {}),
    });
  return { idioma, setIdioma, t, tr, fecha };
}
