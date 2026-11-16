"use client";
// Fondo interactivo "Del cielo a la raíz": al hacer scroll, la cámara baja del cielo de Itapúa a la superficie
// (0–5 cm, la capa que mide el radar NISAR SME2) y después a la zona de raíces. El cielo muestra el clima real
// de la zona (sol, calor, nubes, lluvia, tormenta, helada) y, cuando llueve, el agua se infiltra hacia las raíces.
//
// Rendimiento (pensado para celulares de gama baja):
//  - La escena se dibuja UNA vez por cultivo/clima (componentes memorizados). El scroll no re-renderiza React:
//    un requestAnimationFrame escribe `transform: translate3d(...)` en la escena y `--scroll-depth` (0 → 1).
//  - Todas las animaciones (brisa, nubes, lluvia, sol, infiltración, relámpago, bruma) son @keyframes sobre
//    transform y opacity (globals.css): las compone la GPU sin volver a pintar los SVG con filtros.
//  - Con `prefers-reduced-motion`: sin animaciones y la escena salta entre los 3 estratos.
//
// Datos (sin inventar): `cielo` sale de /api/clima (Open-Meteo + NASA POWER, ver fondo/cielo.ts) y `humedad`
// del estado de la última pasada NISAR. Sin datos: cielo despejado y sin halos de agua.
import { memo, useEffect, useRef, useSyncExternalStore, type CSSProperties, type Ref } from "react";
import { calidadAhora, marcarFondoLento, medidorDeFluidez, sincronizarFondo, useCalidadFondo } from "./fondo/calidad";
import { cieloActual, humedadDe, useClimaLugar, type EstadoCielo, type HumedadFondo, type PuntoLugar } from "./fondo/cielo";
import {
  ASPECTO_AEREO,
  ASPECTO_RAICES,
  CUELLO_AEREO,
  PlantaAerea,
  RaicesCultivo,
  VIEWBOX_AEREO,
  VIEWBOX_RAICES,
  type CultivoFondo,
} from "./fondo/plantas";
import { useIdioma } from "./idioma";

export type { CultivoFondo, EstadoCielo, HumedadFondo };

/** Línea del suelo dentro de la escena (vh desde arriba). */
const SUELO = 80;
/** Alto total de la escena (vh). */
const ALTO = 300;
/** Alto de la planta más grande (vh). */
const ALTO_PLANTA = 56;
/** Estratos según el progreso del scroll; `fijo` es la posición usada con movimiento reducido. */
const ESTRATOS = [
  { id: "cielo", hasta: 0.3, fijo: 0 },
  { id: "superficie", hasta: 0.55, fijo: 0.42 },
  { id: "raiz", hasta: Infinity, fijo: 1 },
] as const;
/** Cámara por tramos (progreso → vh bajados): el cielo dura más, la superficie se cruza en el medio. */
const CAMARA: [number, number][] = [
  [0, 0],
  [0.3, 22],
  [0.55, 92],
  [1, ALTO - 100],
];
function camaraVh(p: number) {
  for (let i = 1; i < CAMARA.length; i++) {
    const [p1, c1] = CAMARA[i];
    if (p <= p1) {
      const [p0, c0] = CAMARA[i - 1];
      return c0 + ((p - p0) / (p1 - p0)) * (c1 - c0);
    }
  }
  return ALTO - 100;
}

// Hilera de 4 plantas: 2 grandes a la izquierda/centro y 2 más jóvenes a la derecha (ritmo y perspectiva).
// En pantallas angostas (teléfono) se dibujan 2, en `xMovil`, y su tamaño se ajusta al ANCHO de la pantalla
// (ver TAMANO): así siempre entra al menos una planta entera, de la punta a la raíz, sin quedar cortada por los bordes.
interface Planta { x: number; xMovil?: number; escala: number; semilla: number; espejo: boolean; brisa: string; demora: string }
const FILA: Planta[] = [
  { x: 9, xMovil: 27, escala: 1, semilla: 11, espejo: false, brisa: "6.2s", demora: "0s" },
  { x: 28, escala: 0.94, semilla: 23, espejo: true, brisa: "7.1s", demora: "-2.3s" },
  { x: 72, xMovil: 77, escala: 0.8, semilla: 37, espejo: false, brisa: "5.6s", demora: "-1.1s" },
  { x: 91, escala: 0.72, semilla: 41, espejo: true, brisa: "6.6s", demora: "-3.4s" },
];
/**
 * Alto de cada dibujo: el de siempre (en % del alto de pantalla) o, si la pantalla es angosta, el que hace que
 * el dibujo no ocupe más que una parte del ANCHO (en vw). El navegador elige el menor de los dos.
 */
const TAMANO = {
  /** Planta: como mucho 46 % del ancho de la pantalla (alto = ancho / aspecto). */
  aereo: (escala: number) => `min(${(ALTO_PLANTA * escala).toFixed(1)}vh, ${((46 / ASPECTO_AEREO) * escala).toFixed(1)}vw)`,
  /** Raíces: como mucho 72 % del ancho. */
  raices: (escala: number) => `min(${(110 + 40 * escala).toFixed(1)}vh, ${((72 / ASPECTO_RAICES) * escala).toFixed(1)}vw)`,
};

const CULTIVOS_FONDO = ["soja", "maiz", "mandioca", "trigo"] as const;

/** ¿Pantalla angosta (teléfono)? En el servidor y al hidratar vale false; después se corrige sola. */
const CONSULTA_ANGOSTO = "(max-width: 767px)";
function useAngosto(): boolean {
  return useSyncExternalStore(
    (f) => {
      const mq = window.matchMedia(CONSULTA_ANGOSTO);
      mq.addEventListener("change", f);
      return () => mq.removeEventListener("change", f);
    },
    () => window.matchMedia(CONSULTA_ANGOSTO).matches,
    () => false,
  );
}

/** Fondo con el clima real del lugar: el punto dado (la chacra) o, sin punto, el centro de Itapúa. */
export function FondoGlobal({ cultivo, punto = null }: { cultivo: CultivoFondo; punto?: PuntoLugar | null }) {
  const datos = useClimaLugar(punto, cultivo === "trigo" ? "soja" : cultivo);
  return <FondoCultivoScroll cultivoActivo={cultivo} cielo={cieloActual(datos) ?? "despejado"} humedad={humedadDe(datos)} />;
}

export default function FondoCultivoScroll({
  cultivoActivo,
  cielo = "despejado",
  humedad = null,
}: {
  cultivoActivo: CultivoFondo;
  cielo?: EstadoCielo;
  humedad?: HumedadFondo;
}) {
  // Cualquier valor desconocido (p. ej. una chacra vieja guardada en el teléfono) se dibuja como soja.
  const cultivo: CultivoFondo = (CULTIVOS_FONDO as readonly string[]).includes(cultivoActivo) ? cultivoActivo : "soja";
  const escenaRef = useRef<HTMLDivElement>(null);
  const medidorRef = useRef<HTMLDivElement>(null);
  const calidad = useCalidadFondo();
  const angosto = useAngosto();
  const apagado = calidad === "apagado";

  useEffect(() => {
    sincronizarFondo();
  }, []);

  useEffect(() => {
    if (apagado) return;
    const escena = escenaRef.current;
    const medidor = medidorRef.current;
    if (!escena || !medidor) return;
    const medirFluidez = medidorDeFluidez(marcarFondoLento);
    const html = document.documentElement;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let maxScroll = 0;
    let vh = window.innerHeight / 100;
    let marco = 0;
    let estratoPrevio = "";
    let transformPrevio = "";

    const medir = () => {
      maxScroll = html.scrollHeight - window.innerHeight;
      vh = escena.offsetHeight / ALTO;
    };
    const actualizar = () => {
      marco = 0;
      const hayScroll = maxScroll > 8;
      let p = hayScroll ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      const estrato = ESTRATOS.find((e) => p < e.hasta) ?? ESTRATOS[2];
      // Antes se escribía --scroll-depth en la raíz de la escena: eso obligaba al navegador a recalcular los estilos
      // de sus ~1.000 elementos en CADA cuadro, y era lo que más trababa. Ahora solo la usa el medidor (8 elementos).
      medidor.style.setProperty("--scroll-depth", p.toFixed(4));
      // Calidad mínima o «menos movimiento»: la escena no sigue al dedo; salta de estrato (el CSS anima el salto).
      const porEstratos = reducido.matches || calidadAhora() === "minimo";
      if (porEstratos) p = estrato.fijo;
      else medirFluidez(performance.now());
      const destino = `translate3d(0, ${(-camaraVh(p) * vh).toFixed(1)}px, 0)`;
      if (destino !== transformPrevio) {
        transformPrevio = destino;
        escena.style.transform = destino;
      }
      medidor.style.visibility = hayScroll ? "visible" : "hidden";
      if (estrato.id !== estratoPrevio) {
        estratoPrevio = estrato.id;
        html.dataset.estrato = estrato.id;
      }
    };
    const pedir = () => {
      if (!marco) marco = requestAnimationFrame(actualizar);
    };
    const remedir = () => {
      medir();
      pedir();
    };

    medir();
    actualizar();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", remedir, { passive: true });
    reducido.addEventListener("change", pedir);
    // El contenido cambia de alto (datos que llegan, secciones que se abren): recalcular el recorrido.
    const obs = new ResizeObserver(remedir);
    obs.observe(document.body);
    return () => {
      cancelAnimationFrame(marco);
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", remedir);
      reducido.removeEventListener("change", pedir);
      obs.disconnect();
      delete html.dataset.estrato;
    };
  }, [apagado]);

  // Apagado por el usuario: no se dibuja nada (ni se guarda en memoria una escena de 1.000 elementos).
  if (apagado) return null;

  return (
    <>
      <div aria-hidden data-cielo={cielo} className="fondo-escena pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <Definiciones />
        <div ref={escenaRef} className="fondo-camara absolute inset-x-0 top-0 will-change-transform" style={{ height: `${ALTO}vh` }}>
          <Escenario cultivo={cultivo} cielo={cielo} humeda={humedad === "buena"} angosto={angosto} />
        </div>
        {/* Modo oscuro: la misma escena, en penumbra, para no encandilar ni competir con la interfaz */}
        <div className="agro-noche absolute inset-0" />
      </div>
      <Medidor ref={medidorRef} />
    </>
  );
}

// ================================================================== Definiciones compartidas
/** Filtros, degradados y la nube de acuarela que usan todos los SVG del fondo (url(#id) / <use>). */
const Definiciones = memo(function Definiciones() {
  return (
    <svg width="0" height="0" className="absolute" focusable="false">
      <defs>
        {/* Trazo a mano: desplazamiento muy sutil para que ninguna línea parezca de computadora */}
        <filter id="agro-trazo" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Acuarela / gouache: bordes irregulares y suaves en las manchas de cielo y tierra */}
        <filter id="agro-acuarela" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="3" result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale="22" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="2" />
        </filter>
        <filter id="agro-acuarela-nube" x="-15%" y="-25%" width="130%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="9" result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale="7" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.1" />
        </filter>
        <radialGradient id="agro-halo">
          <stop offset="0" stopColor="#38BDF8" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="#38BDF8" stopOpacity="0.18" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
        {/* Nube de acuarela: el color sale de `color` (currentColor) de cada <svg> que la usa */}
        <symbol id="agro-nube" viewBox="0 0 200 100" overflow="visible">
          <g filter="url(#agro-acuarela-nube)">
            <ellipse cx="62" cy="62" rx="46" ry="25" fill="currentColor" />
            <ellipse cx="100" cy="46" rx="44" ry="33" fill="currentColor" />
            <ellipse cx="142" cy="60" rx="45" ry="25" fill="currentColor" />
            <ellipse cx="100" cy="70" rx="82" ry="19" fill="currentColor" />
            <ellipse cx="102" cy="79" rx="76" ry="11" fill="#0F172A" opacity="0.13" />
            <ellipse cx="86" cy="38" rx="26" ry="13" fill="#FFFFFF" opacity="0.35" />
          </g>
          <path
            d="M22,74 C8,62 28,44 46,51 C52,28 84,17 100,31 C116,13 154,22 154,45 C178,40 194,60 180,74"
            fill="none"
            stroke="#1C1A15"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.32"
            filter="url(#agro-trazo)"
          />
        </symbol>
      </defs>
    </svg>
  );
});

// ================================================================== Escenario
const Escenario = memo(function Escenario({ cultivo, cielo, humeda, angosto }: { cultivo: CultivoFondo; cielo: EstadoCielo; humeda: boolean; angosto: boolean }) {
  const llueve = cielo === "lluvia_suave" || cielo === "tormenta";
  // En el teléfono: solo las plantas que tienen lugar propio (las otras ni se crean: menos memoria y menos trabajo)
  const fila = angosto ? FILA.filter((f) => f.xMovil !== undefined) : FILA;
  // La posición y el ocultado en pantallas angostas van por CSS (.fondo-planta), así no hay un salto al cargar.
  const lugar = (f: Planta) => ({ "--x": `${f.x}%`, ...(f.xMovil !== undefined ? { "--x-movil": `${f.xMovil}%` } : {}) });
  const clase = (f: Planta) => `fondo-planta absolute ${f.xMovil === undefined ? "max-md:hidden" : ""}`;
  return (
    <>
      <Cielo cielo={cielo} />
      <Horizonte calor={cielo === "soleado_calor"} />
      <Suelo humeda={humeda} />
      {llueve && <Infiltracion fuerte={cielo === "tormenta"} />}
      {/* Raíces (debajo de la línea del suelo) */}
      {fila.map((f) => (
        <svg
          key={`r${f.semilla}`}
          viewBox={VIEWBOX_RAICES}
          overflow="visible"
          className={clase(f)}
          style={{
            ...lugar(f),
            "--alto": TAMANO.raices(f.escala), // las plantas grandes, más profundas
            top: `${SUELO - 0.4}vh`,
            height: "var(--alto)",
            width: `calc(var(--alto) * ${ASPECTO_RAICES.toFixed(4)})`,
            transform: "translateX(-50%)",
          } as CSSProperties}
        >
          <g filter="url(#agro-trazo)" transform={f.espejo ? "scale(-1,1)" : undefined}>
            <RaicesCultivo cultivo={cultivo} semilla={f.semilla} humeda={humeda || llueve} />
          </g>
        </svg>
      ))}
      {/* Parte aérea: cada planta se mece en su propia capa (más rápido con lluvia y viento) */}
      {fila.map((f) => (
        <div
          key={`a${f.semilla}`}
          className={clase(f)}
          style={{
            ...lugar(f),
            "--alto": TAMANO.aereo(f.escala),
            top: `calc(${SUELO}vh - var(--alto) * ${CUELLO_AEREO.toFixed(4)})`,
            height: "var(--alto)",
            width: `calc(var(--alto) * ${ASPECTO_AEREO.toFixed(4)})`,
            transform: "translateX(-50%)",
          } as CSSProperties}
        >
          <svg
            viewBox={VIEWBOX_AEREO}
            overflow="visible"
            className="agro-brisa h-full w-full"
            style={{ "--brisa-dur": f.brisa, "--brisa-demora": f.demora, transformOrigin: `50% ${CUELLO_AEREO * 100}%` } as CSSProperties}
          >
            <g filter="url(#agro-trazo)" transform={f.espejo ? "scale(-1,1)" : undefined}>
              <PlantaAerea cultivo={cultivo} semilla={f.semilla} />
            </g>
          </svg>
        </div>
      ))}
      <CieloDelante cielo={cielo} />
    </>
  );
});

// ================================================================== Cielo (detrás de las plantas)
interface Paleta {
  cielo: string;
  manchas: [string, string, string];
  nube: string;
  /** Opacidad del sol (0 = escondido detrás de las nubes). */
  sol: number;
  /** Capas de nubes: [lejos, medio, cerca]; 0 = sin esa capa. */
  nubes: [number, number, number];
  /** Velo gris-azulado que apaga la luz del cielo. */
  velo: number;
}

const PALETAS: Record<EstadoCielo, Paleta> = {
  soleado_calor: {
    cielo: "linear-gradient(180deg,#3FA9FF 0%,#62BEFF 35%,#A4DBFF 66%,#FFE6B0 100%)",
    manchas: ["#4FB0FF", "#7CCBFF", "#FFD98A"],
    nube: "#FFFFFF",
    sol: 1,
    nubes: [0.55, 0, 0],
    velo: 0,
  },
  despejado: {
    cielo: "linear-gradient(180deg,#5CB3FF 0%,#79C2FF 35%,#9CD4FF 70%,#E6F4FF 100%)",
    manchas: ["#5CB3FF", "#79C2FF", "#9CD4FF"],
    nube: "#FFFFFF",
    sol: 1,
    nubes: [0.7, 0.6, 0],
    velo: 0,
  },
  parcial_nublado: {
    cielo: "linear-gradient(180deg,#78AEDB 0%,#93BEE2 40%,#B8D0E5 72%,#E1E9F1 100%)",
    manchas: ["#7FAEDA", "#A5C2DD", "#CBD5E1"],
    nube: "#F1F5F9",
    sol: 0.95,
    nubes: [0.8, 0.9, 0.95],
    velo: 0.12,
  },
  nublado: {
    cielo: "linear-gradient(180deg,#94A3B8 0%,#A7B4C6 40%,#CBD5E1 75%,#E2E8F0 100%)",
    manchas: ["#8E9DB2", "#AAB6C6", "#CBD5E1"],
    nube: "#E2E8F0",
    sol: 0.5,
    nubes: [0.9, 0.95, 1],
    velo: 0.25,
  },
  lluvia_suave: {
    cielo: "linear-gradient(180deg,#5F7286 0%,#7A8CA0 40%,#A3B1C0 75%,#C6D0DA 100%)",
    manchas: ["#5B6D80", "#7D8EA0", "#A3B1C0"],
    nube: "#AEB9C6",
    sol: 0,
    nubes: [0.95, 1, 1],
    velo: 0.3,
  },
  tormenta: {
    cielo: "linear-gradient(180deg,#323D4E 0%,#4A5669 40%,#6D7A8F 75%,#939EAF 100%)",
    manchas: ["#2E3848", "#465166", "#68758A"],
    nube: "#6B778A",
    sol: 0,
    nubes: [1, 1, 1],
    velo: 0.4,
  },
  helada_frio: {
    cielo: "linear-gradient(180deg,#B9B2E0 0%,#CFC9EE 38%,#E6E2F6 72%,#F6F4FC 100%)",
    manchas: ["#B3ABDD", "#D5CFF0", "#EEEAF9"],
    nube: "#F5F3FF",
    sol: 0.7,
    nubes: [0.45, 0, 0],
    velo: 0,
  },
};

// Nubes de cada capa: x e y en % de la capa, w = ancho en vmin.
const NUBES: { top: number; alto: number; dur: string; nubes: { x: number; y: number; w: number }[] }[] = [
  { top: 4, alto: 26, dur: "150s", nubes: [{ x: 4, y: 30, w: 22 }, { x: 38, y: 8, w: 18 }, { x: 70, y: 46, w: 20 }] },
  { top: 2, alto: 30, dur: "95s", nubes: [{ x: 16, y: 40, w: 30 }, { x: 52, y: 14, w: 26 }, { x: 80, y: 30, w: 24 }] },
  { top: 0, alto: 34, dur: "62s", nubes: [{ x: 0, y: 20, w: 40 }, { x: 44, y: 34, w: 36 }, { x: 72, y: 4, w: 34 }] },
];

/** Capa de nubes que se desplaza en bucle (3 copias, la del medio a la vista; anima -50% del ancho doble). */
function CapaNubes({ capa, color, opacidad }: { capa: (typeof NUBES)[number]; color: string; opacidad: number }) {
  return (
    <div className="absolute inset-x-0" style={{ top: `${capa.top}vh`, height: `${capa.alto}vh`, opacity: opacidad }}>
      <div className="agro-nubes absolute inset-y-0 left-0 w-[200%]" style={{ animationDuration: capa.dur }}>
        {[-50, 0, 50].map((off) =>
          capa.nubes.map((n, i) => (
            <svg
              key={`${off}-${i}`}
              viewBox="0 0 200 100"
              overflow="visible"
              className="absolute"
              style={{ left: `${off + n.x / 2}%`, top: `${n.y}%`, width: `${n.w}vmin`, height: `${n.w / 2}vmin`, color }}
            >
              <use href="#agro-nube" />
            </svg>
          )),
        )}
      </div>
    </div>
  );
}

const Cielo = memo(function Cielo({ cielo }: { cielo: EstadoCielo }) {
  const p = PALETAS[cielo];
  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${SUELO + 2}vh`, background: p.cielo }}>
      <svg viewBox="0 0 1000 800" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g filter="url(#agro-acuarela)">
          <ellipse cx="200" cy="120" rx="380" ry="110" fill={p.manchas[0]} opacity="0.7" />
          <ellipse cx="760" cy="210" rx="420" ry="140" fill={p.manchas[1]} opacity="0.65" />
          <ellipse cx="380" cy="390" rx="480" ry="150" fill={p.manchas[2]} opacity="0.7" />
          <ellipse cx="840" cy="540" rx="360" ry="120" fill={p.manchas[2]} opacity="0.65" />
          <path d="M60,300 C240,262 420,322 610,286" fill="none" stroke="#FFFFFF" strokeWidth="34" strokeLinecap="round" opacity="0.3" />
          <path d="M420,520 C600,488 760,540 960,500" fill="none" stroke="#FFFFFF" strokeWidth="26" strokeLinecap="round" opacity="0.25" />
        </g>
      </svg>
      {p.sol > 0 && <Sol opacidad={p.sol} palido={cielo === "helada_frio"} />}
      {/* Las nubes pasan por delante del sol, a distintas velocidades (parallax) */}
      {NUBES.map((capa, i) => p.nubes[i] > 0 && <CapaNubes key={i} capa={capa} color={p.nube} opacidad={p.nubes[i]} />)}
      {p.velo > 0 && <div className="absolute inset-0" style={{ background: "#64748B", opacity: p.velo }} />}
      {cielo === "tormenta" && <Relampago />}
    </div>
  );
});

const RAYOS = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI) / 8;
  const l = i % 2 ? 68 : 82;
  const f = (v: number) => Math.round(v * 10) / 10;
  return `M${f(Math.cos(a) * 54)},${f(Math.sin(a) * 54)} L${f(Math.cos(a) * l)},${f(Math.sin(a) * l)}`;
}).join(" ");

/** Sol: resplandor que late (scale 1 → 1,18), corona que gira despacio y disco con contorno de tinta. */
function Sol({ opacidad, palido }: { opacidad: number; palido: boolean }) {
  return (
    <div className="absolute right-[6vw] top-[5vh] aspect-square w-[min(32vw,200px)]" style={{ opacity: opacidad }}>
      <div
        className="agro-pulso absolute -inset-[30%] rounded-full"
        style={{ background: `radial-gradient(circle, ${palido ? "rgba(254,243,199,.6)" : "rgba(250,204,21,.55)"} 0%, rgba(245,158,11,.22) 42%, rgba(245,158,11,0) 70%)` }}
      />
      <div
        className="agro-pulso absolute -inset-[12%] rounded-full"
        style={{ animationDelay: "-2s", background: "radial-gradient(circle, rgba(255,250,220,.5) 0%, rgba(250,204,21,0) 65%)" }}
      />
      <svg viewBox="-100 -100 200 200" className="agro-girar absolute inset-0">
        <g filter="url(#agro-trazo)">
          <path d={RAYOS} fill="none" stroke="#1C1A15" strokeWidth="8.4" strokeLinecap="round" />
          <path d={RAYOS} fill="none" stroke={palido ? "#FDE68A" : "#F59E0B"} strokeWidth="5.6" strokeLinecap="round" />
        </g>
      </svg>
      <svg viewBox="-100 -100 200 200" className="absolute inset-0">
        <g filter="url(#agro-trazo)">
          <circle r="42" fill={palido ? "#FEF3C7" : "#FACC15"} stroke="#1C1A15" strokeWidth="2.8" />
          <circle cx="-10" cy="-11" r="23" fill={palido ? "#FFFBEB" : "#FDE68A"} opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}

/** Tormenta: destello ocasional en las nubes altas y un rayo dibujado a mano. */
function Relampago() {
  return (
    <>
      <div className="agro-flash absolute inset-0 bg-white" />
      <svg viewBox="0 0 60 160" className="agro-flash absolute left-[22vw] top-[6vh] h-[22vh]">
        <path d="M34,0 L14,74 L30,74 L18,160 L50,58 L32,58 L44,0 Z" fill="#FEF9C3" stroke="#1C1A15" strokeWidth="2.6" strokeLinejoin="round" />
      </svg>
    </>
  );
}

// ================================================================== Delante de las plantas
const CieloDelante = memo(function CieloDelante({ cielo }: { cielo: EstadoCielo }) {
  if (cielo === "soleado_calor") return <HacesDeSol />;
  if (cielo === "lluvia_suave" || cielo === "tormenta") return <Lluvia fuerte={cielo === "tormenta"} />;
  if (cielo === "helada_frio") return <Bruma />;
  return null;
});

/** Calor fuerte: haces de luz diagonales y translúcidos que atraviesan las hojas. */
function HacesDeSol() {
  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${SUELO + 2}vh` }}>
      {[
        { left: 58, w: 12, d: "0s" },
        { left: 74, w: 7, d: "-2.4s" },
        { left: 40, w: 9, d: "-4.1s" },
      ].map((h) => (
        <div
          key={h.left}
          className="agro-haz absolute -top-[10vh] h-[120vh] origin-top"
          style={{
            left: `${h.left}%`,
            width: `${h.w}vw`,
            transform: "rotate(28deg)",
            animationDelay: h.d,
            background: "linear-gradient(180deg, rgba(255,240,180,0) 0%, rgba(255,236,170,.34) 35%, rgba(255,236,170,.18) 75%, rgba(255,236,170,0) 100%)",
          }}
        />
      ))}
    </div>
  );
}

// Gotas en mosaico (40 × 160 px): la inclinación (−8/32) coincide con el desplazamiento del bucle (−40/160).
const GOTAS = (fuerte: boolean) => {
  const trazos = fuerte
    ? "M30,6 L22,38 M12,70 L4,102 M36,110 L28,142 M20,128 L14,152"
    : "M30,10 L22,42 M10,90 L2,122";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='160'><path d='${trazos}' stroke='rgba(226,240,255,0.85)' stroke-width='1.6' stroke-linecap='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** Cortina de lluvia en dos planos (lejos y cerca) + salpicaduras al llegar al suelo. */
function Lluvia({ fuerte }: { fuerte: boolean }) {
  const capas = [
    { clase: "agro-lluvia-lejos", escala: 0.7, op: fuerte ? 0.6 : 0.45, dur: fuerte ? "0.55s" : "0.9s" },
    { clase: "agro-lluvia-cerca", escala: 1, op: fuerte ? 0.9 : 0.75, dur: fuerte ? "0.36s" : "0.6s" },
  ];
  return (
    <div className="absolute inset-x-0 top-[8vh] overflow-hidden" style={{ height: `${SUELO - 7.5}vh` }}>
      {capas.map((c) => (
        <div
          key={c.clase}
          className={`${c.clase} absolute`}
          style={{
            top: `${-160 * c.escala}px`,
            left: 0,
            right: `${-40 * c.escala}px`,
            bottom: 0,
            opacity: c.op,
            animationDuration: c.dur,
            backgroundImage: GOTAS(fuerte),
            backgroundSize: `${40 * c.escala}px ${160 * c.escala}px`,
          }}
        />
      ))}
      {Array.from({ length: fuerte ? 10 : 7 }, (_, i) => (
        <span
          key={i}
          className="agro-salpica absolute bottom-[0.2vh] h-[5px] w-[16px] rounded-[50%] border-2 border-[#E2F0FF]"
          style={{ left: `${6 + ((i * 37) % 88)}%`, animationDelay: `${-(i * 0.17).toFixed(2)}s`, animationDuration: fuerte ? "0.6s" : "0.9s" }}
        />
      ))}
    </div>
  );
}

/** Helada: bruma blanca baja y escarcha sobre el cuello de las plantas. */
function Bruma() {
  return (
    <>
      {[
        { top: SUELO - 8, op: 0.75, d: "0s" },
        { top: SUELO - 4.5, op: 0.9, d: "-6s" },
      ].map((b) => (
        <div
          key={b.top}
          className="agro-bruma absolute -left-[10%] w-[120%]"
          style={{
            top: `${b.top}vh`,
            height: "9vh",
            opacity: b.op,
            animationDelay: b.d,
            background:
              "radial-gradient(40% 50% at 20% 60%, rgba(255,255,255,.85), rgba(255,255,255,0)), radial-gradient(35% 45% at 55% 50%, rgba(245,243,255,.8), rgba(255,255,255,0)), radial-gradient(40% 50% at 85% 60%, rgba(255,255,255,.85), rgba(255,255,255,0))",
          }}
        />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="agro-titila absolute h-[4px] w-[4px] rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,.8)]"
          style={{ left: `${3 + ((i * 53) % 94)}%`, top: `${SUELO - 1.6 + ((i * 7) % 3) * 0.5}vh`, animationDelay: `${-(i * 0.4).toFixed(1)}s` }}
        />
      ))}
    </>
  );
}

// ================================================================== Horizonte
/** Monte lejano: línea festoneada (copas de árboles) a partir de una altura base. */
function monte(base: number, alto: number, paso: number, semilla: number) {
  let d = `M0,${base + 10}`;
  let s = semilla;
  for (let x = 0; x < 1000; x += paso) {
    s = (s * 9301 + 49297) % 233280;
    const y = base + Math.sin(x / 90 + semilla) * 6 + (s / 233280) * 6;
    d += ` Q${x + paso / 2},${(y - alto).toFixed(1)} ${x + paso},${y.toFixed(1)}`;
  }
  return `${d} L1000,200 L0,200 Z`;
}
const MONTE_LEJOS = monte(72, 16, 24, 2);
const MONTE_CERCA = monte(108, 11, 18, 5);
// Onda térmica: 2 tramos idénticos (0–1000 y 1000–2000) para el bucle sin cortes
const ONDA = (() => {
  let d = "";
  for (const y of [30, 55, 80]) {
    d += `M0,${y}`;
    for (let x = 0; x < 2000; x += 50) d += ` q12.5,-7 25,0 t25,0`;
  }
  return d;
})();

const Horizonte = memo(function Horizonte({ calor }: { calor: boolean }) {
  return (
    <>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-x-0 h-[22vh] w-full" style={{ top: `${SUELO - 21}vh` }}>
        <g filter="url(#agro-acuarela)">
          <path d={MONTE_LEJOS} fill="#68B684" opacity="0.9" />
          <path d={MONTE_CERCA} fill="#8FD694" opacity="0.85" />
          {/* Lomada verde pasto */}
          <path d="M0,152 C200,120 380,130 520,138 C700,148 820,122 1000,134 L1000,200 L0,200 Z" fill="#A8E67A" />
          <path d="M120,150 C260,134 380,140 470,146 M640,146 C760,136 860,128 960,136" fill="none" stroke="#BCEF8D" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
        </g>
        {/* Tierra bajo la línea del horizonte */}
        <path d="M0,190 C250,184 500,194 750,186 C870,182 940,188 1000,186 L1000,200 L0,200 Z" fill="#3B2614" />
        <path
          d="M0,190 C250,184 500,194 750,186 C870,182 940,188 1000,186"
          fill="none"
          stroke="#3A2818"
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          filter="url(#agro-trazo)"
        />
      </svg>
      {calor && (
        <div className="absolute inset-x-0 overflow-hidden" style={{ top: `${SUELO - 19}vh`, height: "8vh" }}>
          <svg viewBox="0 0 2000 100" preserveAspectRatio="none" className="agro-onda absolute inset-y-0 left-0 h-full w-[200%]">
            <path d={ONDA} fill="none" stroke="#FFF3C4" strokeWidth="2.2" opacity="0.55" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      )}
    </>
  );
});

// ================================================================== Suelo
const MANCHAS = (() => {
  const colores = ["#1A0F07", "#3B2614", "#2B1B0E", "#4E2716"];
  let s = 17;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: 72 }, (_, i) => ({
    cx: Math.round(rnd() * 1000),
    cy: Math.round(70 + rnd() * 2300),
    rx: Math.round(40 + rnd() * 120),
    ry: Math.round(16 + rnd() * 46),
    fill: colores[i % colores.length],
    op: Number((0.65 + rnd() * 0.3).toFixed(2)),
  }));
})();
const PIEDRAS = (() => {
  let s = 71;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: 30 }, () => ({
    cx: Math.round(rnd() * 1000),
    cy: Math.round(120 + rnd() * 2200),
    rx: Math.round(5 + rnd() * 9),
    ry: Math.round(3 + rnd() * 5),
    fill: rnd() > 0.5 ? "#5A4636" : "#6E5A48",
  }));
})();
const DESTELLOS = Array.from({ length: 18 }, (_, i) => ({ cx: 30 + ((i * 557) % 940), cy: 16 + ((i * 37) % 48) }));

const Suelo = memo(function Suelo({ humeda }: { humeda: boolean }) {
  return (
    <div
      className="absolute inset-x-0"
      style={{
        top: `${SUELO}vh`,
        height: `${ALTO - SUELO}vh`,
        background: "linear-gradient(180deg,#3B2614 0%,#2B1B0E 16%,#1E120A 45%,#120A05 100%)",
      }}
    >
      <svg viewBox="0 0 1000 2400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g filter="url(#agro-acuarela)">
          {MANCHAS.map((m, i) => (
            <ellipse key={i} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={m.fill} opacity={m.op} />
          ))}
          {/* Capa superficial 0–5 cm: tierra colorada más clara, la que "ve" el radar NISAR */}
          <path d="M0,0 L1000,0 L1000,58 C760,74 520,52 260,70 C150,76 60,66 0,72 Z" fill="#5A3420" opacity="0.75" />
        </g>
        <path d="M0,40 C220,30 480,48 760,36 C860,32 940,38 1000,36" fill="none" stroke="#6B4126" strokeWidth="3" vectorEffect="non-scaling-stroke" opacity="0.7" />
        {PIEDRAS.map((p, i) => (
          <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} stroke="#1C1A15" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        ))}
        {humeda && (
          <>
            {DESTELLOS.map((d, i) => (
              <ellipse key={`h${i}`} cx={d.cx} cy={d.cy} rx={46} ry={26} fill="url(#agro-halo)" />
            ))}
            {DESTELLOS.map((d, i) => (
              <circle key={`d${i}`} cx={d.cx + 8} cy={d.cy - 4} r={2.6} fill="#BAE6FD" opacity={0.8} />
            ))}
          </>
        )}
      </svg>
    </div>
  );
});

/** Recarga: la lluvia moja los primeros cm (franja que late) y gotas turquesa bajan por las raíces. */
const GOTAS_SUELO = Array.from({ length: 14 }, (_, i) => ({
  x: FILA[i % 4].x + (((i * 29) % 13) - 6),
  d: -((i * 0.53) % 3.6),
}));
function Infiltracion({ fuerte }: { fuerte: boolean }) {
  return (
    <>
      <div
        className="agro-recarga absolute inset-x-0"
        style={{ top: `${SUELO}vh`, height: "6vh", background: "linear-gradient(180deg, rgba(56,189,248,0) 0%, rgba(56,189,248,.28) 45%, rgba(56,189,248,0) 100%)" }}
      />
      {GOTAS_SUELO.map((g, i) => (
        <span
          key={i}
          className="agro-infiltra absolute h-[7px] w-[7px] rounded-full bg-[#38BDF8] shadow-[0_0_8px_3px_rgba(56,189,248,.45)]"
          style={{ left: `${g.x}%`, top: `${SUELO + 1}vh`, animationDelay: `${g.d.toFixed(2)}s`, animationDuration: fuerte ? "2.6s" : "3.6s" }}
        />
      ))}
    </>
  );
}

// ================================================================== Medidor de profundidad
const CAPAS = [
  { id: "cielo", icono: "☀️", pos: 12, es: "Cielo y planta · atmósfera (Open-Meteo)", en: "Canopy & Sky · Atmosphere (Open-Meteo)" },
  { id: "superficie", icono: "🌱", pos: 42, es: "Superficie 0–5 cm · radar NISAR SME2 (NASA-ISRO)", en: "Surface 0–5 cm · NASA-ISRO NISAR SME2 radar" },
  { id: "raiz", icono: "🪱", pos: 78, es: "Raíces 5–60 cm · toma de agua y balance hídrico", en: "Root zone 5–60 cm · root uptake & water balance" },
] as const;

function Medidor({ ref }: { ref: Ref<HTMLDivElement> }) {
  const { idioma } = useIdioma();
  return (
    <div
      ref={ref}
      aria-hidden
      className="medidor pointer-events-none fixed right-1 top-[26vh] z-[900] h-[44vh] select-none md:right-3"
      style={{ visibility: "hidden" }}
    >
      <div className="absolute right-0 top-0 h-full w-[3px] rounded-full bg-gradient-to-b from-[#5CB3FF] via-[#57B83E] to-[#6B442E] opacity-80" />
      <div className="medidor-punto absolute -right-[4px] top-0 h-[11px] w-[11px] rounded-full border-2 border-[#3A2818] bg-white shadow" />
      {CAPAS.map((c) => (
        <div key={c.id} data-capa={c.id} className="medidor-capa absolute right-3 hidden -translate-y-1/2 items-center gap-1.5 md:flex" style={{ top: `${c.pos}%` }}>
          <span className="sobre-fondo hidden whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold text-texto min-[1400px]:inline">{c[idioma]}</span>
          <span className="text-lg leading-none">{c.icono}</span>
        </div>
      ))}
    </div>
  );
}
