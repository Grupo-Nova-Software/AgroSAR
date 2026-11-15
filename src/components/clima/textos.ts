// Textos de la pantalla Clima (EN para el jurado, ES para el agricultor). Frases cortas y directas.
// Están acá y no en ../idioma.tsx para no pisar los textos del resto de la app.
import { useIdioma, type Idioma, type Texto } from "../idioma";

const T = {
  ahora: { es: "Ahora", en: "Now" },
  capaVientoVivo: { es: "Viento en movimiento", en: "Moving wind" },
  titulo: { es: "Clima para tu chacra", en: "Weather for your field" },
  zona: { es: "Zona", en: "Zone" },
  cultivo: { es: "Cultivo", en: "Crop" },
  idioma: { es: "Idioma", en: "Language" },
  contexto: {
    es: "Datos: NASA NISAR + NASA POWER · Pronóstico: Open-Meteo (no es NASA) · Umbrales: supuestos del equipo",
    en: "Data: NASA NISAR + NASA POWER · Forecast: Open-Meteo (non-NASA) · Thresholds: team assumptions",
  },
  cargando: { es: "Buscando el clima…", en: "Getting the weather…" },
  errorClima: { es: "No pudimos traer el clima. Revisá tu conexión y probá de nuevo.", en: "We couldn't get the weather. Check your connection and try again." },
  reintentar: { es: "Probar de nuevo", en: "Try again" },
  puntoZona: { es: "Centro de la zona {zona}", en: "Center of {zona} zone" },
  puntoElegido: { es: "Punto elegido en el mapa ({lat}, {lon})", en: "Point picked on the map ({lat}, {lon})" },
  volverZona: { es: "Volver al centro de la zona", en: "Back to zone center" },
  fuenteCaida: { es: "Sin datos de {fuente} por ahora. Mostramos lo que hay.", en: "No {fuente} data right now. Showing what is available." },

  // Tarjetas
  qLluvia: { es: "¿Llueve mañana?", en: "Will it rain tomorrow?" },
  si: { es: "Sí", en: "Yes" },
  no: { es: "No", en: "No" },
  pico: { es: "Más agua: {desde} a {hasta} h ({mm} mm)", en: "Most rain: {desde}–{hasta} ({mm} mm)" },
  probabilidad: { es: "Probabilidad: {p} %", en: "Chance: {p}%" },
  hoyResto: { es: "Hoy (lo que queda): {mm} mm", en: "Today (rest of day): {mm} mm" },
  notaRecarga: { es: "Buena lluvia para recargar el suelo.", en: "Good rain to recharge the soil." },
  notaLluviaPoca: { es: "Lluvia liviana: moja poco el suelo.", en: "Light rain: barely wets the soil." },
  notaSinLluvia: { es: "No se espera lluvia.", en: "No rain expected." },
  notaLluviaFuerte: { es: "Lluvia fuerte: cuidado con encharcamiento.", en: "Heavy rain: watch for waterlogging." },

  qSeco: { es: "¿Cuándo no llueve?", en: "When is it dry?" },
  ventanaSeca: { es: "Ventana seca", en: "Dry window" },
  diasSecos: { es: "{n} días secos seguidos para sembrar o cosechar", en: "{n} dry days in a row to sow or harvest" },
  unDiaSeco: { es: "Solo 1 día seco: {dia}", en: "Only 1 dry day: {dia}" },
  sinVentana: { es: "No hay días secos en los próximos 14 días.", en: "No dry days in the next 14 days." },
  pulverizar: { es: "Pulverizar", en: "Spraying" },
  pulvHoras: { es: "{dia}: {n} h aptas", en: "{dia}: {n} suitable h" },
  pulvPrimera: { es: "desde las {hora}", en: "from {hora}" },
  pulvNada: { es: "{dia}: sin horas aptas", en: "{dia}: no suitable hours" },

  qTemp: { es: "Calor y frío", en: "Heat and cold" },
  picoCalor: { es: "Máxima", en: "High" },
  minima: { es: "Mínima", en: "Low" },
  aLas: { es: "a las {hora}", en: "at {hora}" },
  estresCalor: { es: "Calor fuerte: riesgo para el cultivo en floración (más de {u} °C).", en: "Strong heat: risk for flowering crops (above {u} °C)." },
  helada: { es: "Helada", en: "Frost" },
  heladaNinguno: { es: "sin riesgo en 14 días", en: "no risk in 14 days" },
  heladaBajo: { es: "riesgo bajo (mínima {c} °C el {dia})", en: "low risk (low of {c} °C on {dia})" },
  heladaAlto: { es: "riesgo alto (mínima {c} °C el {dia})", en: "high risk (low of {c} °C on {dia})" },

  qSequia: { es: "Vigilancia de sequía", en: "Drought watch" },
  nivel_optimo: { es: "Bien de agua", en: "Water OK" },
  nivel_atencion: { es: "Atención", en: "Watch" },
  nivel_moderada: { es: "Sequía moderada", en: "Moderate drought" },
  nivel_severa: { es: "Alerta de sequía", en: "Severe drought alert" },
  balance30: { es: "Balance 30 días: {mm} mm", en: "30-day balance: {mm} mm" },
  balanceExplica: { es: "lluvia menos lo que evapora", en: "rain minus evaporation" },
  diasSinLluvia: { es: "{n} días sin lluvia", en: "{n} days without rain" },
  nisar: { es: "Radar NISAR: {v} m³/m³", en: "NISAR radar: {v} m³/m³" },
  nisarEdad: { es: "pasada del {dia}, hace {n} días", en: "pass of {dia}, {n} days ago" },
  nisarVieja: { es: "Dato viejo: no cuenta para el nivel.", en: "Old data: not used for the level." },
  nisarSin: { es: "Sin pasada NISAR para esta zona.", en: "No NISAR pass for this zone." },

  hoy: { es: "Hoy", en: "Today" },
  manana: { es: "Mañana", en: "Tomorrow" },

  // Mapa
  mapaTitulo: { es: "Mapa del clima", en: "Weather map" },
  mapaAyuda: { es: "Tocá el mapa para ver el clima en tu chacra.", en: "Tap the map to see the weather at your field." },
  capasBase: { es: "Capas", en: "Layers" },
  capaLimites: { es: "Zonas de análisis", en: "Analysis zones" },
  capaChacra: { es: "Mi chacra", en: "My field" },
  capaChacraSin: { es: "Mi chacra (marcala en «Mi suelo»)", en: "My field (mark it in «My soil»)" },
  capaNisar: { es: "Radar NISAR SME2 (200 m)", en: "NISAR SME2 radar (200 m)" },
  capaNodos: { es: "Puntos de referencia", en: "Reference points" },
  capaNombres: { es: "Nombres de lugares", en: "Place names" },
  capaClima: { es: "Capa de clima", en: "Weather layer" },
  nodoNota: { es: "Valor del modelo, no es una estación", en: "Model value, not a station" },
  capa_lluvia: { es: "Lluvia", en: "Rain" },
  capa_acumulada: { es: "Lluvia acumulada", en: "Rain total" },
  capa_temperatura: { es: "Temperatura", en: "Temperature" },
  capa_helada: { es: "Rocío y helada", en: "Dew & frost" },
  capa_balance: { es: "Balance de agua", en: "Water balance" },
  capa_viento: { es: "Viento", en: "Wind" },
  capa_solar: { es: "Sol y evaporación", en: "Sun & evaporation" },
  desc_lluvia_h: { es: "Lluvia en 3 horas", en: "Rain in 3 hours" },
  desc_lluvia_d: { es: "Lluvia del día", en: "Rain of the day" },
  desc_acumulada_h: { es: "Lluvia sumada desde ahora", en: "Rain added up from now" },
  desc_acumulada_d: { es: "Lluvia sumada desde hoy", en: "Rain added up from today" },
  desc_temperatura_h: { es: "Temperatura del aire", en: "Air temperature" },
  desc_temperatura_d: { es: "Máxima del día", en: "Daily high" },
  desc_helada_h: { es: "Punto de rocío", en: "Dew point" },
  desc_helada_d: { es: "Mínima del día", en: "Daily low" },
  desc_balance_h: { es: "Lluvia menos evaporación, desde ahora", en: "Rain minus evaporation, from now" },
  desc_balance_d: { es: "Lluvia menos evaporación, desde hoy", en: "Rain minus evaporation, from today" },
  desc_viento_h: { es: "Viento a 10 m", en: "Wind at 10 m" },
  desc_viento_d: { es: "Viento máximo del día", en: "Daily max wind" },
  desc_solar_h: { es: "Radiación solar", en: "Solar radiation" },
  desc_solar_d: { es: "Evaporación de referencia (ET0)", en: "Reference evaporation (ET0)" },
  modelo: { es: "Modelo: Open-Meteo · grilla de ~{km} km suavizada (no llega a la parcela)", en: "Model: Open-Meteo · ~{km} km grid, smoothed (not field-scale)" },
  reproducir: { es: "Reproducir", en: "Play" },
  pausar: { es: "Pausar", en: "Pause" },
  h48: { es: "48 horas", en: "48 hours" },
  d14: { es: "14 días", en: "14 days" },
  momento: { es: "Momento", en: "Time" },
  pinTemp: { es: "Temp.", en: "Temp" },
  pinLluvia: { es: "Lluvia", en: "Rain" },
  pinViento: { es: "Viento", en: "Wind" },
  pinHumedad: { es: "Humedad", en: "Humidity" },
  pinMaxMin: { es: "Máx / mín", en: "High / low" },
  rafagas: { es: "ráfagas {v}", en: "gusts {v}" },
  mapaSinGrilla: { es: "No pudimos cargar las capas del mapa.", en: "We couldn't load the map layers." },
  nisarZona: { es: "NISAR {v} m³/m³ · {dia}", en: "NISAR {v} m³/m³ · {dia}" },

  // Detalle horario
  horasTitulo: { es: "Hora por hora (48 h)", en: "Hour by hour (48 h)" },
  horasSub: { es: "¿A qué hora llueve, hace calor o frío, y cuándo se puede pulverizar?", en: "When does it rain, get hot or cold, and when can you spray?" },
  filaTemp: { es: "Temperatura", en: "Temperature" },
  filaLluvia: { es: "Lluvia (mm)", en: "Rain (mm)" },
  filaViento: { es: "Viento (km/h)", en: "Wind (km/h)" },
  filaPulv: { es: "Pulverizar", en: "Spray" },
  apta: { es: "Se puede", en: "OK" },
  noApta: { es: "No", en: "No" },
  max: { es: "Máx", en: "High" },
  min: { es: "Mín", en: "Low" },
  motivo_viento_bajo: { es: "casi sin viento (riesgo de inversión térmica)", en: "almost no wind (thermal inversion risk)" },
  motivo_viento_alto: { es: "mucho viento (deriva)", en: "too windy (drift)" },
  motivo_lluvia: { es: "lluvia", en: "rain" },
  motivo_calor: { es: "mucho calor", en: "too hot" },
  motivo_aire_seco: { es: "aire muy seco", en: "air too dry" },
  motivo_sin_dato: { es: "sin dato", en: "no data" },
  reglaPulv: {
    es: "Regla para pulverizar (supuesto del equipo): viento entre {v1} y {v2} km/h, sin lluvia, menos de {t} °C y humedad del aire mayor a {h} %. El viento del pronóstico es a 10 m de altura.",
    en: "Spray rule (team assumption): wind {v1}–{v2} km/h, no rain, below {t} °C and air humidity above {h}%. Forecast wind is at 10 m height.",
  },

  // Balance
  balanceTitulo: { es: "Agua de los últimos 30 días y lo que viene", en: "Water in the last 30 days and what's coming" },
  balanceSub: { es: "Lluvia de cada día y balance: lluvia menos evaporación (P − ET0).", en: "Daily rain and balance: rain minus evaporation (P − ET0)." },
  lluviaDiaria: { es: "Lluvia de cada día (mm)", en: "Daily rain (mm)" },
  balanceAcum: { es: "Balance acumulado (mm): arriba de 0 sobra agua, abajo falta", en: "Running balance (mm): above 0 is surplus, below is deficit" },
  medido: { es: "Registrado (NASA POWER)", en: "Recorded (NASA POWER)" },
  relleno: { es: "Últimos días (modelo)", en: "Latest days (model)" },
  pronostico: { es: "Pronóstico (Open-Meteo)", en: "Forecast (Open-Meteo)" },
  pasadaNisar: { es: "Pasada NISAR", en: "NISAR pass" },
  tLluvia30: { es: "Lluvia 30 días", en: "Rain, 30 days" },
  tEt030: { es: "Evaporación 30 días", en: "Evaporation, 30 days" },
  tBalance30: { es: "Balance 30 días", en: "Balance, 30 days" },
  tBalance15: { es: "Balance 15 días", en: "Balance, 15 days" },
  tProx14: { es: "Balance próximos 14 días", en: "Balance, next 14 days" },
  verTabla: { es: "Ver los datos en tabla", en: "Show data as a table" },
  colFecha: { es: "Fecha", en: "Date" },
  colLluvia: { es: "Lluvia mm", en: "Rain mm" },
  colEt0: { es: "ET0 mm", en: "ET0 mm" },
  colBalance: { es: "Balance acum. mm", en: "Running balance mm" },
  colFuente: { es: "Fuente", en: "Source" },
  gwettop: {
    es: "Nota: la humedad de NASA POWER (GWETTOP) es una fracción de 0 a 1 de un modelo; no se compara con el radar NISAR, que mide en m³/m³.",
    en: "Note: NASA POWER soil wetness (GWETTOP) is a 0–1 model fraction; it is not comparable to NISAR radar, which measures m³/m³.",
  },
  et0Nota: {
    es: "Evaporación (ET0): calculada con el método FAO-56 a partir de NASA POWER; en los últimos días y el pronóstico, la del modelo Open-Meteo.",
    en: "Evaporation (ET0): computed with the FAO-56 method from NASA POWER; for the latest days and the forecast, the Open-Meteo model value.",
  },
  factores: { es: "Por qué este nivel", en: "Why this level" },
  factor_balance_30d: { es: "Balance de 30 días: {v} mm", en: "30-day balance: {v} mm" },
  factor_balance_15d: { es: "Balance de 15 días: {v} mm", en: "15-day balance: {v} mm" },
  factor_dias_sin_lluvia: { es: "{v} días seguidos sin lluvia", en: "{v} days in a row without rain" },
  factor_nisar_estado: { es: "El radar NISAR ve el suelo {v}", en: "NISAR radar sees the soil as {v}" },
  factor_nisar_baja: { es: "La humedad NISAR bajó {v} m³/m³", en: "NISAR moisture dropped {v} m³/m³" },
  factor_pronostico_alivia: { es: "El pronóstico trae lluvia que alivia (+{v} mm)", en: "The forecast brings relief rain (+{v} mm)" },
  sinFactores: { es: "Sin señales de falta de agua.", en: "No signs of water shortage." },
  nivelesNota: {
    es: "Los 4 niveles son una clasificación de la app (supuesto del equipo). No son un protocolo oficial del MAG ni de la SEN.",
    en: "The 4 levels are this app's own classification (team assumption). They are not an official MAG or SEN protocol.",
  },

  // Perspectiva
  perspTitulo: { es: "Los próximos meses de la campaña", en: "The coming months of the season" },
  perspSub: {
    es: "Lluvia NORMAL de cada mes (promedio {periodo}, NASA POWER). No es un pronóstico.",
    en: "NORMAL rain for each month ({periodo} average, NASA POWER). This is not a forecast.",
  },
  normalMes: { es: "Lluvia normal", en: "Normal rain" },
  tempNormal: { es: "Temp. media {t} °C", en: "Mean temp {t} °C" },
  etapaCritica: { es: "Etapa que necesita agua", en: "Stage that needs water" },
  masVulnerable: { es: "Mes más delicado", en: "Most sensitive month" },
  mesActual: { es: "Este mes llovió {a} mm; lo normal a esta altura es {n} mm ({p} %).", en: "This month it rained {a} mm; normal by now is {n} mm ({p}%)." },
  mesActualSin: { es: "Este mes llovió {a} mm; lo normal a esta altura es {n} mm.", en: "This month it rained {a} mm; normal by now is {n} mm." },
  ult30: { es: "Últimos 30 días: {a} mm contra {n} mm normales ({p} %).", en: "Last 30 days: {a} mm vs {n} mm normal ({p}%)." },
  siembraSupuesta: { es: "Etapas calculadas como si sembraras hoy ({ciclo}, {dias} días).", en: "Stages computed as if you sowed today ({ciclo}, {dias} days)." },
  requerimiento: { es: "Lluvia de referencia para el cultivo: {a}–{b} mm (dato del equipo, sin validar).", en: "Reference rain for the crop: {a}–{b} mm (team data, not validated)." },
  sinRequerimiento: { es: "Todavía no hay una lluvia de referencia validada para este cultivo.", en: "There is no validated reference rain for this crop yet." },

  // Nodos y fuentes
  nodosTitulo: { es: "Puntos de referencia en Itapúa", en: "Reference points in Itapúa" },
  nodosTexto: {
    es: "Los valores de cada punto salen del modelo, no de una estación. La app todavía no recibe mediciones del Observatorio del Agua (UNI), del MAG ni de la SEN: estos puntos marcan dónde se podrían conectar. Las coordenadas son aproximadas.",
    en: "Values at each point come from the model, not from a station. The app does not yet receive measurements from Observatorio del Agua (UNI), MAG or SEN: these points mark where they could be connected. Coordinates are approximate.",
  },
  fuentesTitulo: { es: "Fuentes y licencias", en: "Sources and licenses" },
  fuenteMapa: { es: "Imágenes aéreas: Esri, Maxar, Earthstar Geographics.", en: "Aerial imagery: Esri, Maxar, Earthstar Geographics." },
  aviso: {
    es: "Esto es una orientación. Los umbrales son supuestos del equipo y falta validarlos con técnicos. Consultá siempre a tu técnico.",
    en: "This is guidance only. Thresholds are team assumptions and still need validation by agronomists. Always consult your agronomist.",
  },
  powerHasta: { es: "NASA POWER publica con demora: último día {dia}.", en: "NASA POWER publishes with a delay: latest day {dia}." },
  estado_seco: { es: "seco", en: "dry" },
  estado_bajo: { es: "con poca agua", en: "low on water" },
  estado_optimo: { es: "bien", en: "good" },
  estado_humedo: { es: "húmedo", en: "moist" },
  estado_saturado: { es: "saturado", en: "saturated" },
  estado_sin_datos: { es: "sin datos", en: "no data" },
} satisfies Record<string, Texto>;

export type ClaveClima = keyof typeof T;

// Las etapas llegan del backend con su nombre en español (config/cultivos). Acá, su versión en inglés.
const ETAPAS_EN: Record<string, string> = {
  "Implantación y emergencia": "Planting and emergence",
  "Crecimiento vegetativo": "Vegetative growth",
  "Floración y formación de vainas": "Flowering and pod set",
  "Llenado de granos y madurez": "Grain fill and maturity",
  "Floración y polinización": "Flowering and pollination",
  "Llenado de granos": "Grain fill",
  "Madurez fisiológica": "Physiological maturity",
  "Brotación de las ramas-semilla": "Sprouting of the stem cuttings",
  "Establecimiento (control de malezas)": "Establishment (weed control)",
  "Engrosamiento de raíces": "Root bulking",
  "Acumulación de almidón y madurez": "Starch build-up and maturity",
};

const ROSA: Record<Idioma, string[]> = {
  es: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
};

export function useClimaTextos() {
  const { idioma, setIdioma, fecha } = useIdioma();
  const local = idioma === "es" ? "es-PY" : "en-US";
  /** Texto de la clave; `vars` reemplaza {nombre}. */
  const tc = (clave: ClaveClima, vars?: Record<string, string | number>) => {
    let s: string = T[clave][idioma];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
  /** Número con los decimales pedidos y el separador del idioma. */
  const n = (v: number | null | undefined, dec = 0) =>
    typeof v === "number" ? v.toLocaleString(local, { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "–";
  /** Con signo: +12 / −8. */
  const conSigno = (v: number, dec = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), dec)}`;
  /** "sáb 14" / "Sat 14" */
  const diaCorto = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(local, { weekday: "short", day: "numeric" });
  /** "noviembre 2026" / "November 2026" */
  const mes = (aaaamm: string) => new Date(`${aaaamm}-15T12:00:00`).toLocaleDateString(local, { month: "long" });
  /** De dónde viene el viento: N, NE, E… */
  const rumbo = (grados: number | null | undefined) => (typeof grados === "number" ? ROSA[idioma][Math.round(grados / 45) % 8] : "");
  /** Nombre de la etapa del cultivo en el idioma elegido. */
  const etapa = (nombre: string) => (idioma === "en" ? (ETAPAS_EN[nombre] ?? nombre) : nombre);
  return { tc, n, conSigno, diaCorto, mes, rumbo, etapa, fecha, idioma, setIdioma };
}
