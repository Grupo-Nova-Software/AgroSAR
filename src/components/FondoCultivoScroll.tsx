"use client";
// Fondo interactivo "Del cielo a la raíz": al hacer scroll, la cámara baja del cielo de Itapúa a la superficie
// (0–5 cm, la capa que mide el radar NISAR SME2) y después a la zona de raíces.
//
// Rendimiento (pensado para celulares de gama baja):
//  - La escena se dibuja UNA vez (SVG memorizado). El scroll no re-renderiza React: un requestAnimationFrame
//    escribe `transform: translate3d(...)` en la escena y la variable `--scroll-depth` (0 → 1).
//  - Las plantas se mecen con una animación CSS de rotación sobre su propia capa (la GPU la compone; el SVG
//    con filtro no se vuelve a pintar).
//  - Con `prefers-reduced-motion`, sin brisa y la escena salta entre los 3 estratos sin movimiento continuo.
//
// Datos: `lluvia` (pronóstico de hoy, Open-Meteo) cambia el sol por nubes; `humedad` (estado de la última
// pasada NISAR) muestra halos de agua capilar en los primeros centímetros solo cuando el suelo está bien de agua.
// Sin esos datos (p. ej. en Inicio) se muestra el día soleado y sin halos: no se inventa humedad.
import { memo, useEffect, useRef, type Ref } from "react";
import { useIdioma } from "./idioma";
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

export type { CultivoFondo };
export type HumedadFondo = "buena" | "baja" | null;

/** Línea del suelo dentro de la escena (vh desde arriba). */
const SUELO = 80;
/** Alto total de la escena (vh). La cámara recorre ALTO − 100 vh. */
const ALTO = 300;
/** Alto de la planta más grande (vh). */
const ALTO_PLANTA = 56;
/** Umbrales de estrato según el progreso del scroll. */
const ESTRATOS = [
  { id: "cielo", hasta: 0.3, fijo: 0 },
  { id: "superficie", hasta: 0.55, fijo: 0.42 },
  { id: "raiz", hasta: Infinity, fijo: 1 },
] as const;

// Hilera de 4 plantas: 2 grandes a la izquierda/centro y 2 más jóvenes a la derecha (ritmo y perspectiva).
const FILA = [
  { x: 9, escala: 1, semilla: 11, espejo: false, brisa: "6.2s", demora: "0s" },
  { x: 28, escala: 0.94, semilla: 23, espejo: true, brisa: "7.1s", demora: "-2.3s" },
  { x: 72, escala: 0.8, semilla: 37, espejo: false, brisa: "5.6s", demora: "-1.1s" },
  { x: 91, escala: 0.72, semilla: 41, espejo: true, brisa: "6.6s", demora: "-3.4s" },
];

export default function FondoCultivoScroll({
  cultivoActivo,
  lluvia = false,
  humedad = null,
}: {
  cultivoActivo: CultivoFondo;
  lluvia?: boolean;
  humedad?: HumedadFondo;
}) {
  // Cualquier valor desconocido (p. ej. una chacra vieja guardada en el teléfono) se dibuja como soja.
  const cultivo: CultivoFondo = (["soja", "maiz", "mandioca", "trigo"] as const).includes(cultivoActivo) ? cultivoActivo : "soja";
  const raizRef = useRef<HTMLDivElement>(null);
  const escenaRef = useRef<HTMLDivElement>(null);
  const medidorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = raizRef.current;
    const escena = escenaRef.current;
    const medidor = medidorRef.current;
    if (!raiz || !escena || !medidor) return;
    const html = document.documentElement;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let maxScroll = 0;
    let rango = 0;
    let marco = 0;
    let estratoPrevio = "";

    const medir = () => {
      maxScroll = html.scrollHeight - window.innerHeight;
      rango = escena.offsetHeight - window.innerHeight;
    };
    const actualizar = () => {
      marco = 0;
      const hayScroll = maxScroll > 8;
      let p = hayScroll ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      const estrato = ESTRATOS.find((e) => p < e.hasta) ?? ESTRATOS[2];
      if (reducido.matches) p = estrato.fijo;
      const valor = p.toFixed(4);
      raiz.style.setProperty("--scroll-depth", valor);
      medidor.style.setProperty("--scroll-depth", valor);
      escena.style.transform = `translate3d(0, ${(-p * rango).toFixed(1)}px, 0)`;
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
  }, []);

  return (
    <>
      <div ref={raizRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <Definiciones />
        <div ref={escenaRef} className="absolute inset-x-0 top-0 will-change-transform" style={{ height: `${ALTO}vh` }}>
          <Escenario cultivo={cultivo} lluvia={lluvia} humeda={humedad === "buena"} />
        </div>
        {/* Modo oscuro: la misma escena, en penumbra, para no encandilar ni competir con la interfaz */}
        <div className="agro-noche absolute inset-0" />
      </div>
      <Medidor ref={medidorRef} />
    </>
  );
}

/** Filtros y degradados compartidos por todos los SVG del fondo (se referencian con url(#id)). */
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
        <radialGradient id="agro-halo">
          <stop offset="0" stopColor="#38BDF8" stopOpacity="0.32" />
          <stop offset="0.6" stopColor="#38BDF8" stopOpacity="0.18" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="agro-resplandor">
          <stop offset="0" stopColor="#FFF3B0" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#FFE680" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFE680" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
});

const Escenario = memo(function Escenario({ cultivo, lluvia, humeda }: { cultivo: CultivoFondo; lluvia: boolean; humeda: boolean }) {
  return (
    <>
      <Cielo lluvia={lluvia} />
      <Horizonte />
      <Suelo humeda={humeda} />
      {/* Raíces (debajo de la línea del suelo) */}
      {FILA.map((f) => {
        const alto = 110 + 40 * f.escala; // raíces de las plantas grandes, más profundas
        return (
          <svg
            key={`r${f.semilla}`}
            viewBox={VIEWBOX_RAICES}
            overflow="visible"
            className="absolute"
            style={{ left: `${f.x}%`, top: `${SUELO - 0.4}vh`, height: `${alto}vh`, width: `${alto * ASPECTO_RAICES}vh`, transform: "translateX(-50%)" }}
          >
            <g filter="url(#agro-trazo)" transform={f.espejo ? "scale(-1,1)" : undefined}>
              <RaicesCultivo cultivo={cultivo} semilla={f.semilla} humeda={humeda} />
            </g>
          </svg>
        );
      })}
      {/* Parte aérea: cada planta se mece en su propia capa */}
      {FILA.map((f) => {
        const alto = ALTO_PLANTA * f.escala;
        return (
          <div
            key={`a${f.semilla}`}
            className="absolute"
            style={{ left: `${f.x}%`, top: `${SUELO - alto * CUELLO_AEREO}vh`, height: `${alto}vh`, width: `${alto * ASPECTO_AEREO}vh`, transform: "translateX(-50%)" }}
          >
            <svg
              viewBox={VIEWBOX_AEREO}
              overflow="visible"
              className="agro-brisa h-full w-full"
              style={{ ["--brisa-dur" as string]: f.brisa, ["--brisa-demora" as string]: f.demora, transformOrigin: `50% ${CUELLO_AEREO * 100}%` }}
            >
              <g filter="url(#agro-trazo)" transform={f.espejo ? "scale(-1,1)" : undefined}>
                <PlantaAerea cultivo={cultivo} semilla={f.semilla} />
              </g>
            </svg>
          </div>
        );
      })}
    </>
  );
});

// ------------------------------------------------------------------ Cielo
const Cielo = memo(function Cielo({ lluvia }: { lluvia: boolean }) {
  return (
    <div
      className="absolute inset-x-0 top-0"
      style={{
        height: `${SUELO + 2}vh`,
        background: lluvia
          ? "linear-gradient(180deg,#7E97AE 0%,#93A9BD 40%,#B4C6D4 75%,#D7E2EA 100%)"
          : "linear-gradient(180deg,#5CB3FF 0%,#79C2FF 35%,#9CD4FF 70%,#E6F4FF 100%)",
      }}
    >
      <svg viewBox="0 0 1000 800" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g filter="url(#agro-acuarela)">
          {lluvia ? (
            <>
              <ellipse cx="220" cy="110" rx="420" ry="120" fill="#6F879C" opacity="0.7" />
              <ellipse cx="760" cy="180" rx="440" ry="140" fill="#8399AC" opacity="0.65" />
              <ellipse cx="420" cy="380" rx="480" ry="130" fill="#A3B5C4" opacity="0.6" />
            </>
          ) : (
            <>
              <ellipse cx="200" cy="120" rx="380" ry="110" fill="#5CB3FF" opacity="0.7" />
              <ellipse cx="760" cy="210" rx="420" ry="140" fill="#79C2FF" opacity="0.65" />
              <ellipse cx="380" cy="390" rx="480" ry="150" fill="#9CD4FF" opacity="0.7" />
              <ellipse cx="840" cy="540" rx="360" ry="120" fill="#9CD4FF" opacity="0.65" />
            </>
          )}
          {/* Pinceladas blancas translúcidas y nubes de acuarela */}
          <path d="M60,300 C240,262 420,322 610,286" fill="none" stroke="#E6F4FF" strokeWidth="34" strokeLinecap="round" opacity="0.55" />
          <path d="M420,520 C600,488 760,540 960,500" fill="none" stroke="#E6F4FF" strokeWidth="26" strokeLinecap="round" opacity="0.45" />
          <g fill={lluvia ? "#C9D3DC" : "#FFFFFF"} opacity={lluvia ? 0.9 : 0.78}>
            <ellipse cx="190" cy="210" rx="110" ry="34" />
            <ellipse cx="250" cy="185" rx="70" ry="40" />
            <ellipse cx="560" cy="120" rx="90" ry="26" />
            <ellipse cx="610" cy="100" rx="56" ry="30" />
          </g>
        </g>
      </svg>
      <Sol lluvia={lluvia} />
    </div>
  );
});

const RAYOS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const l = i % 2 ? 66 : 76;
  const f = (v: number) => Math.round(v * 10) / 10;
  return `M${f(Math.cos(a) * 52)},${f(Math.sin(a) * 52)} L${f(Math.cos(a) * l)},${f(Math.sin(a) * l)}`;
}).join(" ");

const Sol = memo(function Sol({ lluvia }: { lluvia: boolean }) {
  return (
    <svg viewBox="-100 -100 200 200" className="absolute right-[6vw] top-[6vh] aspect-square w-[min(30vw,190px)]">
      <circle r="96" fill="url(#agro-resplandor)" opacity={lluvia ? 0.35 : 1} />
      <g filter="url(#agro-trazo)" opacity={lluvia ? 0.5 : 1}>
        <path d={RAYOS} fill="none" stroke="#1C1A15" strokeWidth="8.4" strokeLinecap="round" />
        <path d={RAYOS} fill="none" stroke="#FFC93C" strokeWidth="5.6" strokeLinecap="round" />
        <circle r="40" fill="#FFD34D" stroke="#1C1A15" strokeWidth="2.8" />
        <circle cx="-9" cy="-10" r="22" fill="#FFE680" opacity="0.75" />
      </g>
      {lluvia && (
        <g filter="url(#agro-trazo)">
          <path
            d="M-78,40 C-96,40 -98,12 -78,8 C-80,-16 -48,-26 -36,-8 C-28,-34 12,-36 20,-6 C40,-18 66,-4 58,18 C80,20 80,40 62,40 Z"
            fill="#D5DEE6"
            stroke="#1C1A15"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path d="M-56,54 l-8,18 M-30,54 l-8,18 M-4,54 l-8,18 M22,54 l-8,18 M48,54 l-8,18" stroke="#3B82C4" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
});

// ------------------------------------------------------------------ Horizonte
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

const Horizonte = memo(function Horizonte() {
  return (
    <svg
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
      className="absolute inset-x-0 h-[22vh] w-full"
      style={{ top: `${SUELO - 21}vh` }}
    >
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
  );
});

// ------------------------------------------------------------------ Suelo
const MANCHAS = (() => {
  const colores = ["#1A0F07", "#3B2614", "#2B1B0E", "#4E2716"];
  let s = 17;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: 38 }, (_, i) => ({
    cx: Math.round(rnd() * 1000),
    cy: Math.round(80 + rnd() * 2300),
    rx: Math.round(120 + rnd() * 220),
    ry: Math.round(50 + rnd() * 110),
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
  return Array.from({ length: 26 }, () => ({
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

// ------------------------------------------------------------------ Medidor de profundidad
const CAPAS = [
  {
    id: "cielo",
    icono: "☀️",
    pos: 12,
    es: "Cielo y planta · atmósfera (Open-Meteo)",
    en: "Canopy & Sky · Atmosphere (Open-Meteo)",
  },
  {
    id: "superficie",
    icono: "🌱",
    pos: 42,
    es: "Superficie 0–5 cm · radar NISAR SME2 (NASA-ISRO)",
    en: "Surface 0–5 cm · NASA-ISRO NISAR SME2 radar",
  },
  {
    id: "raiz",
    icono: "🪱",
    pos: 78,
    es: "Raíces 5–60 cm · toma de agua y balance hídrico",
    en: "Root zone 5–60 cm · root uptake & water balance",
  },
] as const;

function Medidor({ ref }: { ref: Ref<HTMLDivElement> }) {
  const { idioma } = useIdioma();
  return (
    <div ref={ref} aria-hidden className="medidor pointer-events-none fixed right-1 top-[26vh] z-[900] h-[44vh] select-none md:right-3" style={{ visibility: "hidden" }}>
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
