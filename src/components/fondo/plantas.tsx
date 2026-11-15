// Ilustraciones botánicas del fondo "Del cielo a la raíz", dibujadas en código (SVG, sin imágenes).
// Estilo de los bocetos del equipo: contorno de tinta orgánico (#1C1A15, 2,2–3,5), rellenos planos con
// luces y sombras, y el filtro global "agro-trazo" (FondoCultivoScroll) que hace temblar el trazo a pulso.
//
// Coordenadas:
//  - Parte aérea: viewBox VIEWBOX_AEREO; el cuello de la planta está en (0, 0) y crece hacia y negativa.
//  - Raíces: viewBox VIEWBOX_RAICES; la corona está en (0, 0) y crecen hacia abajo (y positiva).
// Las raíces se generan con un azar con semilla fija: el servidor y el navegador dibujan exactamente lo mismo.
import { memo, type ReactNode } from "react";

export type CultivoFondo = "soja" | "maiz" | "mandioca" | "trigo";

export const VIEWBOX_AEREO = "-110 -415 220 425";
export const ASPECTO_AEREO = 220 / 425;
/** Fracción del alto del SVG aéreo que queda por encima del cuello (y = 0). */
export const CUELLO_AEREO = 415 / 425;
export const VIEWBOX_RAICES = "-150 0 300 900";
export const ASPECTO_RAICES = 300 / 900;

const TINTA = "#1C1A15";
const TRAZO = { stroke: TINTA, strokeLinecap: "round", strokeLinejoin: "round" } as const;

type P = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const rad = (g: number) => (g * Math.PI) / 180;
const pol = ([x, y]: P, ang: number, d: number): P => [x + Math.cos(ang) * d, y + Math.sin(ang) * d];
const pt = ([x, y]: P) => `${r1(x)},${r1(y)}`;

/** Azar reproducible (mulberry32). */
function azar(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Curva suave que pasa cerca de los puntos (cuadráticas por los puntos medios). */
function suave(pts: P[], cerrar = false): string {
  if (pts.length < 3) return `M${pts.map(pt).join(" L")}${cerrar ? " Z" : ""}`;
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q${pt([x, y])} ${pt([(x + nx) / 2, (y + ny) / 2])}`;
  }
  d += ` L${pt(pts[pts.length - 1])}`;
  return cerrar ? `${d} Z` : d;
}

/** Hoja lanceolada entre la base b y la punta t. `ancho` = separación de los bordes; `curva` arquea la hoja. */
function hoja(b: P, t: P, ancho: number, curva = 0) {
  const dx = t[0] - b[0];
  const dy = t[1] - b[1];
  const L = Math.hypot(dx, dy) || 1;
  const n: P = [-dy / L, dx / L];
  const m: P = [b[0] + dx * 0.45 + n[0] * curva, b[1] + dy * 0.45 + n[1] * curva];
  const a: P = [m[0] + n[0] * ancho, m[1] + n[1] * ancho];
  const c: P = [m[0] - n[0] * ancho, m[1] - n[1] * ancho];
  return {
    lamina: `M${pt(b)} Q${pt(a)} ${pt(t)} Q${pt(c)} ${pt(b)} Z`,
    nervio: `M${pt(b)} Q${pt(m)} ${pt(t)}`,
  };
}

/** Línea con contorno de tinta: un trazo oscuro más ancho y encima el color. */
function Trazo({ d, color, ancho, tinta = 2.6 }: { d: string; color: string; ancho: number; tinta?: number }) {
  return (
    <>
      <path d={d} fill="none" {...TRAZO} strokeWidth={ancho + tinta} />
      <path d={d} fill="none" stroke={color} strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// =====================================================================================
// MAÍZ: caña segmentada, hojas lanceoladas, 2 mazorcas entreabiertas y panoja.
// =====================================================================================

// Granos de la mazorca (estáticos): filas dentro de la elipse rx 11, ry 27 centrada en (0, -36).
const GRANOS: P[] = (() => {
  const g: P[] = [];
  for (let y = -14; y >= -58; y -= 7.2) {
    const lim = 11 * Math.sqrt(Math.max(0, 1 - ((y + 36) / 27) ** 2)) - 3.2;
    for (const x of [-6, 0, 6]) if (Math.abs(x) <= lim) g.push([x, y]);
  }
  return g;
})();

function Mazorca({ x, y, ang, s = 1 }: { x: number; y: number; ang: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${ang}) scale(${s})`}>
      <Trazo d="M0,8 L0,-4" color="#22A61D" ancho={4.5} />
      <path d="M0,0 C-22,-18 -20,-50 -4,-72 C-10,-46 -8,-20 0,0 Z" fill="#147A12" strokeWidth={2.2} {...TRAZO} />
      <ellipse cx={0} cy={-36} rx={11} ry={27} fill="#FACC15" strokeWidth={2.4} {...TRAZO} />
      {GRANOS.map(([gx, gy]) => (
        <rect key={`${gx},${gy}`} x={gx - 2.6} y={gy - 3.2} width={5.2} height={6.4} rx={2.2} fill="#FFEA00" stroke="#B7791F" strokeWidth={0.6} />
      ))}
      <path d="M0,0 C-17,-10 -18,-34 -12,-54 C-6,-34 -2,-16 0,0 Z" fill="#22A61D" strokeWidth={2.2} {...TRAZO} />
      <path d="M0,0 C17,-12 18,-36 10,-58 C6,-36 3,-16 0,0 Z" fill="#2BB526" strokeWidth={2.2} {...TRAZO} />
      <path d="M-11,-30 C-12,-20 -9,-10 -4,-4" fill="none" stroke="#4ADE80" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M-1,-63 q-3,-8 -9,-12 M0,-64 q1,-9 -1,-16 M1,-63 q5,-7 9,-10" fill="none" stroke="#C99A2E" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

// [y, dirección, largo, alza, caída, ancho, arco]
const HOJAS_MAIZ: [number, -1 | 1, number, number, number, number, number][] = [
  [-28, -1, 118, 34, 74, 17, 22],
  [-60, 1, 132, 44, 78, 18, 24],
  [-112, -1, 138, 56, 72, 18, 26],
  [-168, 1, 128, 66, 58, 16, 24],
  [-226, -1, 112, 68, 42, 14, 20],
  [-272, 1, 92, 62, 30, 12, 16],
  [-306, -1, 68, 52, 18, 10, 12],
];

const PanojaRamas: [number, -1 | 1, number][] = [
  [-340, -1, 30],
  [-346, 1, 34],
  [-354, -1, 28],
  [-361, 1, 26],
  [-368, -1, 20],
  [-375, 1, 17],
];

const MaizAereo = memo(function MaizAereo({ semilla }: { semilla: number }) {
  const r = azar(semilla);
  return (
    <g>
      {/* Raíces zancos que bajan de los primeros nudos */}
      {[
        [-5, -26, -28, 8],
        [5, -28, 27, 8],
        [-4, -14, -15, 8],
        [5, -15, 16, 8],
      ].map(([x1, y1, x2, y2]) => (
        <Trazo key={`${x1},${y1}`} d={`M${x1},${y1} Q${(x1 + x2) / 2 + Math.sign(x2) * 6},${y1 + 3} ${x2},${y2}`} color="#8C6249" ancho={3} tinta={2.4} />
      ))}
      {/* Caña */}
      <path d="M-7,6 C-7.5,-110 -5.5,-230 -3.5,-332 L3.5,-332 C5.5,-230 7.5,-110 7,6 Z" fill="#22A61D" strokeWidth={2.8} {...TRAZO} />
      <path d="M-4.4,2 C-5,-110 -3.4,-230 -1.8,-326" fill="none" stroke="#147A12" strokeWidth={3} strokeLinecap="round" />
      <path d="M3,2 C3.4,-110 2.4,-230 1.4,-326" fill="none" stroke="#4ADE80" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
      {/* Hojas */}
      {HOJAS_MAIZ.map(([y, dir, largo, alza, caida, ancho, arco], i) => {
        const j = 1 + (r() - 0.5) * 0.14;
        const b: P = [dir * 4.5, y];
        const t: P = [dir * (5 + largo * j), y - alza * j + caida];
        const h = hoja(b, t, ancho, -dir * arco);
        const sombra = hoja(b, t, ancho * 0.45, -dir * arco + ancho * 0.28);
        return (
          <g key={i}>
            <path d={h.lamina} fill="#22A61D" strokeWidth={2.4} {...TRAZO} />
            <path d={sombra.lamina} fill="#147A12" opacity={0.55} />
            <path d={h.nervio} fill="none" stroke="#4ADE80" strokeWidth={1.8} strokeLinecap="round" opacity={0.9} />
            <path d={h.nervio} fill="none" stroke={TINTA} strokeWidth={1} strokeLinecap="round" opacity={0.8} />
          </g>
        );
      })}
      {/* Nudos */}
      {[-40, -92, -146, -200, -252, -298].map((y) => (
        <path key={y} d={`M-7,${y} q7,4.5 14,0`} fill="none" {...TRAZO} strokeWidth={2} />
      ))}
      {/* Mazorcas entreabiertas */}
      <Mazorca x={6} y={-150} ang={24} />
      <Mazorca x={-6} y={-200} ang={-22} s={0.88} />
      {/* Panoja */}
      <Trazo d="M0,-330 Q1.5,-370 -1,-406" color="#A3E635" ancho={3.2} />
      {PanojaRamas.map(([y, d, l]) => (
        <Trazo key={y} d={`M0,${y} Q${d * l * 0.6},${y - 14} ${d * l},${y + 7}`} color="#A3E635" ancho={2.6} tinta={2.2} />
      ))}
    </g>
  );
});

// =====================================================================================
// MANDIOCA: tallo leñoso con cicatrices en zig-zag, dos ramas y hojas palmadas colgantes.
// =====================================================================================

function HojaPalmada({ c, dir, tam, lobulos, semilla }: { c: P; dir: number; tam: number; lobulos: 5 | 7; semilla: number }) {
  const r = azar(semilla);
  const abanico = lobulos === 7 ? 250 : 200;
  const partes: ReactNode[] = [];
  for (let i = 0; i < lobulos; i++) {
    const off = -abanico / 2 + (i * abanico) / (lobulos - 1);
    const L = tam * (0.5 + 0.5 * Math.cos(rad(off) * 0.62)) * (0.92 + r() * 0.16);
    const t = pol(c, rad(dir + off), L);
    t[1] += Math.abs(off) > 40 ? tam * 0.16 : 0; // los lóbulos de los costados cuelgan
    const h = hoja(c, t, L * 0.27, (r() - 0.5) * 6);
    partes.push(
      <g key={i}>
        <path d={h.lamina} fill={i % 2 ? "#8CE063" : "#57B83E"} strokeWidth={2.2} {...TRAZO} />
        <path d={h.nervio} fill="none" stroke={TINTA} strokeWidth={1.1} strokeLinecap="round" opacity={0.85} />
      </g>,
    );
  }
  return (
    <g>
      {partes}
      <circle cx={c[0]} cy={c[1]} r={2.2} fill={TINTA} />
    </g>
  );
}

// [inicio del pecíolo, centro de la hoja, dirección del lóbulo central, tamaño, lóbulos]
const HOJAS_MANDIOCA: [P, P, number, number, 5 | 7][] = [
  [[-10, -196], [-48, -186], 115, 30, 5],
  [[-26, -238], [-94, -226], 118, 46, 7],
  [[-58, -300], [-108, -316], 165, 40, 7],
  [[-58, -298], [-52, -362], -100, 38, 5],
  [[24, -240], [90, -222], 64, 46, 7],
  [[52, -316], [102, -330], 18, 40, 7],
  [[52, -314], [38, -380], -80, 36, 5],
];

const MandiocaAereo = memo(function MandiocaAereo({ semilla }: { semilla: number }) {
  return (
    <g>
      {/* Tallo leñoso */}
      <path d="M-9,6 C-10,-60 -7,-120 -5,-172 L5,-172 C7,-120 10,-60 9,6 Z" fill="#789D34" strokeWidth={2.8} {...TRAZO} />
      <path d="M3.5,2 C5,-60 4,-120 2.4,-166" fill="none" stroke="#8DB63B" strokeWidth={2.6} strokeLinecap="round" />
      {/* Cicatrices foliares en zig-zag escalonado */}
      {Array.from({ length: 11 }, (_, k) => {
        const y = -8 - k * 13;
        const lado = k % 2 ? 1 : -1;
        const ancho = 9 - k * 0.35;
        return (
          <g key={k}>
            <path d={`M${lado * ancho},${y + 3} q${lado * 6},-3 ${lado * 1.5},-8`} fill="#6B8A2C" strokeWidth={1.8} {...TRAZO} />
            <path d={`M-4.5,${y} L0,${y - 4.5} L4.5,${y}`} fill="none" {...TRAZO} strokeWidth={1.4} />
          </g>
        );
      })}
      {/* Dos ramas principales */}
      <Trazo d="M0,-168 C-8,-215 -30,-262 -60,-302" color="#8DB63B" ancho={7} tinta={2.8} />
      <Trazo d="M0,-168 C10,-220 30,-272 54,-320" color="#8DB63B" ancho={6.5} tinta={2.8} />
      {/* Pecíolos y hojas palmadas */}
      {HOJAS_MANDIOCA.map(([a, c], i) => (
        <Trazo key={`p${i}`} d={`M${pt(a)} Q${pt([(a[0] + c[0]) / 2, Math.min(a[1], c[1]) - 10])} ${pt(c)}`} color="#8DB63B" ancho={2.2} tinta={2} />
      ))}
      {HOJAS_MANDIOCA.map(([, c, dir, tam, lob], i) => (
        <HojaPalmada key={`h${i}`} c={c} dir={dir} tam={tam} lobulos={lob} semilla={semilla * 31 + i} />
      ))}
    </g>
  );
});

// =====================================================================================
// SOJA: tallo ramificado, hojas trifoliadas y racimos de vainas con 3 porotos.
// =====================================================================================

function foliolo(b: P, ang: number, L: number) {
  const u: P = [Math.cos(ang), Math.sin(ang)];
  const n: P = [-u[1], u[0]];
  const W = L * 0.52;
  const p = (s: number, q: number): P => [b[0] + u[0] * s * L + n[0] * q * W, b[1] + u[1] * s * L + n[1] * q * W];
  const venas = [0.32, 0.52, 0.72].map((s) => `M${pt(p(s, 0))} L${pt(p(s + 0.16, 0.5))} M${pt(p(s, 0))} L${pt(p(s + 0.16, -0.5))}`).join(" ");
  return {
    lamina: `M${pt(b)} C${pt(p(0.08, 1.1))} ${pt(p(0.8, 0.95))} ${pt(p(1, 0))} C${pt(p(0.8, -0.95))} ${pt(p(0.08, -1.1))} ${pt(b)} Z`,
    nervio: `M${pt(b)} L${pt(p(0.94, 0))}`,
    venas,
  };
}

function Trifolio({ b, ang, L }: { b: P; ang: number; L: number }) {
  const a = rad(ang);
  const base = pol(b, a, 6);
  const hojas = [
    { o: pol(base, a, 2), ang: a, L },
    { o: base, ang: a - rad(64), L: L * 0.78 },
    { o: base, ang: a + rad(64), L: L * 0.78 },
  ];
  return (
    <g>
      <Trazo d={`M${pt(b)} L${pt(base)}`} color="#2E7D32" ancho={2} tinta={2} />
      {hojas.map((h, i) => {
        const f = foliolo(h.o, h.ang, h.L);
        return (
          <g key={i}>
            <path d={f.lamina} fill={i ? "#2E7D32" : "#388E3C"} strokeWidth={2.2} {...TRAZO} />
            <path d={`${f.nervio} ${f.venas}`} fill="none" stroke="#76C859" strokeWidth={1.3} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function vaina(b: P, ang: number, L: number) {
  const u: P = [Math.cos(ang), Math.sin(ang)];
  const n: P = [-u[1], u[0]];
  const izq: P[] = [];
  const der: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const w = 5.4 * (0.55 + 0.45 * Math.abs(Math.sin(3 * Math.PI * t))) * Math.min(1, t * 6, (1 - t) * 7 + 0.15);
    const c = 3.5 * Math.sin(Math.PI * t);
    const e: P = [b[0] + u[0] * t * L + n[0] * c, b[1] + u[1] * t * L + n[1] * c];
    izq.push([e[0] + n[0] * w, e[1] + n[1] * w]);
    der.push([e[0] - n[0] * w, e[1] - n[1] * w]);
  }
  const granos = [1 / 6, 1 / 2, 5 / 6].map((t): P => {
    const c = 3.5 * Math.sin(Math.PI * t);
    return [b[0] + u[0] * t * L + n[0] * c, b[1] + u[1] * t * L + n[1] * c];
  });
  return { cuerpo: suave([...izq, ...der.reverse()], true), granos, pelos: [...izq.filter((_, i) => i % 2), ...der.filter((_, i) => i % 3 === 1)] };
}

const NUDOS_SOJA: P[] = [
  [3, -60],
  [-3, -120],
  [4, -180],
  [-2, -238],
  [-28, -104],
  [32, -164],
];

const SojaAereo = memo(function SojaAereo({ semilla }: { semilla: number }) {
  const r = azar(semilla);
  return (
    <g>
      {/* Tallo y ramas */}
      <Trazo d={suave([[0, 6], [3, -60], [-3, -120], [4, -180], [-2, -238], [1, -292]])} color="#2E7D32" ancho={5} tinta={2.8} />
      <Trazo d="M3,-60 Q-24,-96 -56,-150" color="#2E7D32" ancho={3.4} />
      <Trazo d="M-3,-120 Q26,-150 58,-200" color="#2E7D32" ancho={3.2} />
      <Trazo d="M4,-180 Q-18,-210 -46,-252" color="#2E7D32" ancho={3} />
      {/* Hojas trifoliadas */}
      <Trifolio b={[-56, -150]} ang={-150} L={34} />
      <Trifolio b={[58, -200]} ang={-32} L={34} />
      <Trifolio b={[-46, -252]} ang={-128} L={31} />
      <Trifolio b={[1, -292]} ang={-90} L={33} />
      <Trifolio b={[3, -60]} ang={-18} L={30} />
      <Trifolio b={[-2, -238]} ang={-30} L={28} />
      <Trifolio b={[4, -180]} ang={-165} L={27} />
      {/* Racimos de vainas colgantes */}
      {NUDOS_SOJA.map((b, k) =>
        [0, 1, 2].map((i) => {
          const v = vaina(b, rad(68 + i * 22 + (r() - 0.5) * 14), 28 + r() * 7);
          return (
            <g key={`${k}-${i}`}>
              <path d={v.cuerpo} fill="#8EE572" strokeWidth={2} {...TRAZO} />
              {v.granos.map(([x, y], g) => (
                <circle key={g} cx={r1(x - 0.8)} cy={r1(y - 0.8)} r={2.6} fill="#A7F389" />
              ))}
              {v.pelos.map(([x, y], g) => (
                <circle key={`p${g}`} cx={r1(x)} cy={r1(y)} r={0.55} fill={TINTA} opacity={0.5} />
              ))}
            </g>
          );
        }),
      )}
    </g>
  );
});

// =====================================================================================
// TRIGO (cobertura / rotación): tallos finos dorados con espigas de espiguillas y aristas.
// =====================================================================================

const TALLOS_TRIGO: P[] = [
  [-50, -248],
  [-24, -284],
  [0, -300],
  [21, -282],
  [45, -254],
  [64, -222],
];

const TrigoAereo = memo(function TrigoAereo() {
  return (
    <g>
      {/* Hojas finas de la base */}
      {[
        [-1, 70, 46],
        [1, 76, 40],
        [-1, 54, 74],
        [1, 58, 70],
      ].map(([dir, largo, alza], i) => {
        const h = hoja([dir * 2, -6], [dir * largo, -alza], 7, -dir * 12);
        return <path key={i} d={h.lamina} fill="#B5A642" strokeWidth={2.2} {...TRAZO} />;
      })}
      {TALLOS_TRIGO.map(([tx, ty], i) => {
        const u = -Math.PI / 2 + tx * 0.006; // la espiga mira hacia arriba, apenas inclinada hacia afuera
        const esp: ReactNode[] = [];
        for (let k = 0; k < 9; k++) {
          const lado = k % 2 ? 1 : -1;
          const c = pol([tx, ty], u, -k * 6.2 + 4);
          const t = pol(c, u + lado * rad(30), 9.5);
          const h = hoja(c, t, 5.4);
          const arista = pol(t, u + lado * rad(14), 16);
          esp.push(
            <g key={k}>
              <path d={`M${pt(t)} L${pt(arista)}`} stroke={TINTA} strokeWidth={0.9} strokeLinecap="round" opacity={0.8} />
              <path d={h.lamina} fill={k % 3 ? "#DEC93A" : "#C9BA38"} strokeWidth={1.4} {...TRAZO} />
            </g>,
          );
        }
        return (
          <g key={i}>
            <Trazo d={`M0,6 Q${r1(tx * 0.25)},${r1(ty * 0.5)} ${tx},${ty + 46}`} color="#7A5230" ancho={2.6} tinta={2.4} />
            <path d={`M${tx},${ty + 46} L${tx},${ty + 4}`} stroke="#7A5230" strokeWidth={2.4} strokeLinecap="round" />
            {esp}
            <path d={`M${pt(pol([tx, ty], u, 6))} L${pt(pol([tx, ty], u, 24))}`} stroke={TINTA} strokeWidth={1} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
});

export const PlantaAerea = memo(function PlantaAerea({ cultivo, semilla }: { cultivo: CultivoFondo; semilla: number }) {
  switch (cultivo) {
    case "maiz":
      return <MaizAereo semilla={semilla} />;
    case "mandioca":
      return <MandiocaAereo semilla={semilla} />;
    case "trigo":
      return <TrigoAereo />;
    default:
      return <SojaAereo semilla={semilla} />;
  }
});

// =====================================================================================
// RAÍCES (procedurales): fibrosas (maíz), pivotante con nódulos (soja), tuberosas (mandioca),
// fasciculadas (trigo). Cada nivel (principal, secundaria, terciaria) es UN solo <path>.
// =====================================================================================

interface ConfigRaiz {
  primarias: { ang: number; largo: number }[];
  hijos: [number, number];
  factor: [number, number];
  curva: number;
  gravedad: number;
  anchos: [number, number, number];
  nodulos?: boolean;
}

interface Red {
  niveles: [string[], string[], string[]];
  puntas: P[];
  nodulos: P[];
}

function crecer(r: () => number, x: number, y: number, ang: number, largo: number, nivel: 0 | 1 | 2, cfg: ConfigRaiz, red: Red) {
  const pasos = Math.max(4, Math.round(largo / 26));
  const pts: P[] = [[x, y]];
  const angs = [ang];
  let a = ang;
  for (let i = 0; i < pasos; i++) {
    a += (r() - 0.5) * cfg.curva + (Math.PI / 2 - a) * cfg.gravedad;
    x += (Math.cos(a) * largo) / pasos;
    y += (Math.sin(a) * largo) / pasos;
    pts.push([x, y]);
    angs.push(a);
    // Nódulos de Rhizobium: en las laterales, cerca de la corona
    if (cfg.nodulos && nivel === 1 && i < 5 && y < 230 && r() < 0.6) red.nodulos.push([x, y]);
  }
  // La raíz se afina: el último tramo se dibuja con el ancho del nivel siguiente.
  const corte = Math.ceil(pts.length * 0.55);
  red.niveles[nivel].push(suave(pts.slice(0, corte + 1)));
  red.niveles[Math.min(2, nivel + 1)].push(suave(pts.slice(corte)));
  if (nivel === 2) {
    red.puntas.push([x, y]);
    return;
  }
  const n = cfg.hijos[nivel];
  for (let k = 0; k < n; k++) {
    const i = 1 + Math.floor(r() * (pts.length - 2));
    const lado = r() < 0.5 ? -1 : 1;
    const t = i / (pts.length - 1);
    const largoHijo = largo * cfg.factor[nivel] * (0.55 + r() * 0.45) * (1 - t * 0.55);
    crecer(r, pts[i][0], pts[i][1], angs[i] + lado * (0.5 + r() * 0.7), largoHijo, (nivel + 1) as 1 | 2, cfg, red);
  }
}

function abanico(n: number, desde: number, hasta: number, largo: (t: number) => number) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { ang: desde + (hasta - desde) * t, largo: largo(t) };
  });
}

const CONFIG_RAICES: Record<CultivoFondo, ConfigRaiz> = {
  maiz: {
    primarias: abanico(9, 18, 162, (t) => 500 + 320 * Math.sin(Math.PI * t)),
    hijos: [6, 3],
    factor: [0.4, 0.45],
    curva: 0.5,
    gravedad: 0.06,
    anchos: [3.6, 2.1, 1.1],
  },
  soja: {
    primarias: [{ ang: 90, largo: 760 }],
    hijos: [12, 3],
    factor: [0.46, 0.45],
    curva: 0.42,
    gravedad: 0.07,
    anchos: [5, 2.3, 1.1],
    nodulos: true,
  },
  mandioca: {
    primarias: abanico(8, 22, 158, (t) => 260 + 180 * Math.sin(Math.PI * t)),
    hijos: [3, 2],
    factor: [0.45, 0.45],
    curva: 0.45,
    gravedad: 0.05,
    anchos: [2.2, 1.4, 0.9],
  },
  trigo: {
    primarias: abanico(26, 22, 158, (t) => 360 + 240 * Math.sin(Math.PI * t)),
    hijos: [3, 1],
    factor: [0.32, 0.4],
    curva: 0.42,
    gravedad: 0.06,
    anchos: [1.6, 1.1, 0.7],
  },
};

const COLORES_RAIZ = ["#7A543E", "#8C6249", "#6B442E"] as const;
const TINTA_RAIZ = [2.2, 1.8, 1.3] as const;

function tuberculos(r: () => number) {
  return [38, 58, 78, 100, 122, 144].map((g) => {
    const L = 230 + r() * 140;
    const W = 30 + r() * 16;
    const n = 16;
    const eje: P[] = [];
    const angs: number[] = [];
    let p: P = pol([0, 4], rad(g), 10);
    let a = rad(g + (r() - 0.5) * 12);
    for (let i = 0; i <= n; i++) {
      eje.push(p);
      angs.push(a);
      a += (r() - 0.5) * 0.12 + (Math.PI / 2 - a) * 0.03;
      p = pol(p, a, L / n);
    }
    const ancho = (t: number) => {
      const tt = t < 0.42 ? (t / 0.42) * 0.5 : 0.5 + ((t - 0.42) / 0.58) * 0.5;
      return Math.max(2.5, W * 0.5 * Math.sin(Math.PI * tt) ** 0.75);
    };
    const borde = (lado: 1 | -1, f = 1, desde = 0, hasta = 1) =>
      eje
        .map((e, i) => ({ e, i, t: i / n }))
        .filter(({ t }) => t >= desde && t <= hasta)
        .map(({ e, i, t }): P => {
          const nrm: P = [-Math.sin(angs[i]), Math.cos(angs[i])];
          return [e[0] + nrm[0] * ancho(t) * f * lado, e[1] + nrm[1] * ancho(t) * f * lado];
        });
    const izq = borde(1);
    const der = borde(-1).reverse();
    // Lomo iluminado: franja del lado de arriba
    const luzA = borde(-1, 0.85, 0.12, 0.86);
    const luzB = borde(-1, 0.25, 0.12, 0.86).reverse();
    const marcas = [0.25, 0.4, 0.55, 0.7]
      .map((t) => {
        const i = Math.round(t * n);
        const nrm: P = [-Math.sin(angs[i]), Math.cos(angs[i])];
        const w = ancho(t);
        return `M${pt([eje[i][0] - nrm[0] * w * 0.7, eje[i][1] - nrm[1] * w * 0.7])} Q${pt([eje[i][0] + 3 * Math.cos(angs[i]), eje[i][1] + 3 * Math.sin(angs[i])])} ${pt([eje[i][0] + nrm[0] * w * 0.4, eje[i][1] + nrm[1] * w * 0.4])}`;
      })
      .join(" ");
    const punta = eje[n];
    const raicillas = [0, 1, 2]
      .map((k) => {
        const aa = angs[n] + (k - 1) * 0.6 + (r() - 0.5) * 0.4;
        const m = pol(punta, aa, 16);
        return `M${pt(punta)} Q${pt(pol(m, aa + 0.5, 6))} ${pt(pol(punta, aa, 30 + r() * 22))}`;
      })
      .join(" ");
    return { cuerpo: suave([...izq, ...der], true), luz: suave([...luzA, ...luzB], true), marcas, raicillas, punta };
  });
}

export const RaicesCultivo = memo(function RaicesCultivo({ cultivo, semilla, humeda }: { cultivo: CultivoFondo; semilla: number; humeda: boolean }) {
  const r = azar(semilla * 7919 + cultivo.length);
  const cfg = CONFIG_RAICES[cultivo];
  const red: Red = { niveles: [[], [], []], puntas: [], nodulos: [] };
  for (const p of cfg.primarias) {
    crecer(r, 0, 0, rad(p.ang + (r() - 0.5) * 8), p.largo * (0.9 + r() * 0.2), 0, cfg, red);
  }
  const tub = cultivo === "mandioca" ? tuberculos(r) : [];
  // Halos de agua capilar: solo cerca de la superficie (los primeros cm son los que mide NISAR).
  const halos = humeda ? red.puntas.filter(([, y]) => y < 340).filter((_, i) => i % 3 === 0).slice(0, 14) : [];

  return (
    <g>
      {halos.map(([x, y], i) => (
        <circle key={`h${i}`} cx={r1(x)} cy={r1(y)} r={18 + (i % 3) * 6} fill="url(#agro-halo)" />
      ))}
      {[0, 1, 2].map((n) => (
        <path key={`t${n}`} d={red.niveles[n].join(" ")} fill="none" {...TRAZO} strokeWidth={cfg.anchos[n] + TINTA_RAIZ[n]} />
      ))}
      {[0, 1, 2].map((n) => (
        <path key={`c${n}`} d={red.niveles[n].join(" ")} fill="none" stroke={COLORES_RAIZ[n]} strokeWidth={cfg.anchos[n]} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {red.nodulos.map(([x, y], i) => (
        <circle key={`n${i}`} cx={r1(x)} cy={r1(y)} r={2.6 + (i % 3) * 0.8} fill="#85583F" strokeWidth={1.4} {...TRAZO} />
      ))}
      {tub.map((t, i) => (
        <g key={`tu${i}`}>
          <path d={t.raicillas} fill="none" stroke="#6B442E" strokeWidth={1.3} strokeLinecap="round" />
          <path d={t.cuerpo} fill="#7C4D32" strokeWidth={2.8} {...TRAZO} />
          <path d={t.luz} fill="#9A6342" opacity={0.9} />
          <path d={t.marcas} fill="none" stroke={TINTA} strokeWidth={1.2} strokeLinecap="round" opacity={0.55} />
        </g>
      ))}
      {cultivo === "mandioca" && <ellipse cx={0} cy={8} rx={17} ry={12} fill="#6B6A2C" strokeWidth={2.6} {...TRAZO} />}
      {humeda &&
        halos.slice(0, 8).map(([x, y], i) => <circle key={`d${i}`} cx={r1(x + 6)} cy={r1(y - 5)} r={1.8} fill="#BAE6FD" opacity={0.75} />)}
    </g>
  );
});
