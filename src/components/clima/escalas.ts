// Capas del mapa de clima: qué campo de la grilla muestra cada una y con qué escala de color.
// Reglas de color: magnitud = UN solo tono de claro a oscuro; el balance (falta / sobra) = dos tonos con gris al medio;
// la temperatura = frío azul / calor rojo con neutro al medio. Nada de arcoíris.
import type { GrillaClima } from "@/lib/clima/tipos";

export type CapaId = "lluvia" | "acumulada" | "temperatura" | "helada" | "balance" | "viento" | "solar";
export type Modo = "h" | "d";

/** [valor, color hex, opacidad 0–1] */
export type Parada = [number, string, number];

export interface Escala {
  unidad: string;
  paradas: Parada[];
  /** Valores que se rotulan en la leyenda. */
  marcas: number[];
  decimales?: number;
}

const AZUL: [string, string, string, string, string] = ["#d6e8fb", "#8dbdf0", "#3f8ae0", "#1c5bb8", "#0d2f73"];
const NARANJA: [string, string, string, string, string] = ["#fdebc8", "#f9c877", "#ee9a2e", "#c96a12", "#7e3c06"];
const VIOLETA: [string, string, string, string, string] = ["#e6e0f7", "#b9a9ea", "#8a6fd6", "#5e3fb3", "#35206f"];

const secuencial = (tonos: string[], valores: number[], alfaInicial = 0): Parada[] =>
  valores.map((v, i) => [v, tonos[Math.min(i, tonos.length - 1)], i === 0 ? alfaInicial : Math.min(0.9, 0.55 + i * 0.1)]);

const TEMPERATURA: Parada[] = [
  [0, "#0d2f73", 0.85], [8, "#1c5bb8", 0.8], [15, "#8dbdf0", 0.7], [22, "#e8e6df", 0.55], [28, "#f5b06a", 0.7], [34, "#d9542b", 0.8], [40, "#7a1a12", 0.9],
];
const FRIO: Parada[] = [[-4, "#35206f", 0.9], [0, "#5e3fb3", 0.85], [3, "#8a6fd6", 0.8], [8, "#b9a9ea", 0.65], [14, "#e6e0f7", 0.5], [24, "#f1eee9", 0.25]];
const BALANCE: Parada[] = [
  [-80, "#7a4a12", 0.9], [-40, "#c08a3e", 0.8], [-10, "#e6cf9f", 0.6], [0, "#e4e4e0", 0.35], [10, "#a9cdee", 0.6], [40, "#3f8ae0", 0.8], [80, "#0d2f73", 0.9],
];

export const ESCALAS: Record<CapaId, Record<Modo, Escala>> = {
  lluvia: {
    h: { unidad: "mm / 3 h", paradas: secuencial(AZUL, [0, 1, 5, 15, 40]), marcas: [0, 5, 15, 40] },
    d: { unidad: "mm", paradas: secuencial(AZUL, [0, 2, 10, 30, 80]), marcas: [0, 10, 30, 80] },
  },
  acumulada: {
    h: { unidad: "mm", paradas: secuencial(AZUL, [0, 5, 20, 50, 100]), marcas: [0, 20, 50, 100] },
    d: { unidad: "mm", paradas: secuencial(AZUL, [0, 20, 60, 120, 250]), marcas: [0, 60, 120, 250] },
  },
  temperatura: {
    h: { unidad: "°C", paradas: TEMPERATURA, marcas: [0, 15, 28, 40] },
    d: { unidad: "°C", paradas: TEMPERATURA, marcas: [0, 15, 28, 40] },
  },
  helada: {
    h: { unidad: "°C", paradas: FRIO, marcas: [-4, 3, 14, 24] },
    d: { unidad: "°C", paradas: FRIO, marcas: [-4, 3, 14, 24] },
  },
  balance: {
    h: { unidad: "mm", paradas: BALANCE, marcas: [-80, -40, 0, 40, 80] },
    d: { unidad: "mm", paradas: BALANCE, marcas: [-80, -40, 0, 40, 80] },
  },
  viento: {
    h: { unidad: "km/h", paradas: secuencial(VIOLETA, [0, 8, 15, 30, 50], 0.15), marcas: [0, 15, 30, 50] },
    d: { unidad: "km/h", paradas: secuencial(VIOLETA, [0, 8, 15, 30, 50], 0.15), marcas: [0, 15, 30, 50] },
  },
  solar: {
    h: { unidad: "W/m²", paradas: secuencial(NARANJA, [0, 200, 450, 750, 1000]), marcas: [0, 450, 1000] },
    d: { unidad: "mm / día", paradas: secuencial(NARANJA, [0, 2, 4, 6, 8]), marcas: [0, 4, 8] },
  },
};

export const CAPAS: { id: CapaId; icono: string }[] = [
  { id: "lluvia", icono: "🌧️" },
  { id: "acumulada", icono: "💧" },
  { id: "temperatura", icono: "🌡️" },
  { id: "helada", icono: "❄️" },
  { id: "balance", icono: "⚖️" },
  { id: "viento", icono: "💨" },
  { id: "solar", icono: "☀️" },
];

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

/** Color [r, g, b, alfa 0–255] de un valor según la escala (interpolación lineal entre paradas). */
export function colorDe(v: number, paradas: Parada[]): [number, number, number, number] {
  if (v <= paradas[0][0]) return [...hex(paradas[0][1]), Math.round(paradas[0][2] * 255)];
  for (let i = 1; i < paradas.length; i++) {
    const [v1, c1, a1] = paradas[i];
    if (v <= v1) {
      const [v0, c0, a0] = paradas[i - 1];
      const f = (v - v0) / (v1 - v0);
      const [r0, g0, b0] = hex(c0);
      const [r1, g1, b1] = hex(c1);
      return [Math.round(r0 + (r1 - r0) * f), Math.round(g0 + (g1 - g0) * f), Math.round(b0 + (b1 - b0) * f), Math.round((a0 + (a1 - a0) * f) * 255)];
    }
  }
  const u = paradas[paradas.length - 1];
  return [...hex(u[1]), Math.round(u[2] * 255)];
}

export const cssColor = (v: number, paradas: Parada[]) => {
  const [r, g, b] = colorDe(v, paradas);
  return `rgb(${r}, ${g}, ${b})`;
};

/** Degradado CSS de la leyenda, con las paradas ubicadas según su valor. */
export function degradado(e: Escala): string {
  const min = e.paradas[0][0];
  const max = e.paradas[e.paradas.length - 1][0];
  return `linear-gradient(90deg, ${e.paradas.map(([v, c]) => `${c} ${(((v - min) / (max - min)) * 100).toFixed(1)}%`).join(", ")})`;
}

export const posicionEnEscala = (v: number, e: Escala) => {
  const min = e.paradas[0][0];
  const max = e.paradas[e.paradas.length - 1][0];
  return ((v - min) / (max - min)) * 100;
};

/** Sumas acumuladas por punto a lo largo de los pasos: [paso][punto]. */
function acumular(campo: number[][], resta?: number[][]): number[][] {
  const out: number[][] = [];
  campo.forEach((fila, s) => {
    out.push(fila.map((v, i) => Number(((s ? out[s - 1][i] : 0) + v - (resta ? resta[s][i] : 0)).toFixed(1))));
  });
  return out;
}

export type Campos = Record<CapaId, Record<Modo, number[][]>>;

/** Todos los campos del mapa ya listos por capa y modo (los acumulados se calculan acá). */
export function prepararCampos(g: GrillaClima): Campos {
  return {
    lluvia: { h: g.h.mm, d: g.d.mm },
    acumulada: { h: acumular(g.h.mm), d: acumular(g.d.mm) },
    temperatura: { h: g.h.temp_c, d: g.d.tmax_c },
    helada: { h: g.h.rocio_c, d: g.d.tmin_c },
    balance: { h: acumular(g.h.mm, g.h.et0_mm), d: acumular(g.d.mm, g.d.et0_mm) },
    viento: { h: g.h.viento_kmh, d: g.d.viento_max_kmh },
    solar: { h: g.h.rad_wm2, d: g.d.et0_mm },
  };
}

/** Valor interpolado (bilineal) de la grilla en un punto. null si cae fuera. */
export function interpolar(valores: number[], g: Pick<GrillaClima, "bbox" | "nx" | "ny">, lat: number, lon: number): number | null {
  const [lo1, la1, lo2, la2] = g.bbox;
  const u = ((lon - lo1) / (lo2 - lo1)) * (g.nx - 1);
  const v = ((la2 - lat) / (la2 - la1)) * (g.ny - 1);
  if (u < 0 || v < 0 || u > g.nx - 1 || v > g.ny - 1) return null;
  const c = Math.min(g.nx - 2, Math.floor(u));
  const f = Math.min(g.ny - 2, Math.floor(v));
  const fu = u - c;
  const fv = v - f;
  const en = (ff: number, cc: number) => valores[ff * g.nx + cc];
  return en(f, c) * (1 - fu) * (1 - fv) + en(f, c + 1) * fu * (1 - fv) + en(f + 1, c) * (1 - fu) * fv + en(f + 1, c + 1) * fu * fv;
}

const PX = 20; // píxeles de imagen por celda de la grilla

/** Dibuja la capa interpolada en un canvas y devuelve la imagen (data URL) para superponer en el mapa. */
export function pintarCapa(canvas: HTMLCanvasElement, valores: number[], g: Pick<GrillaClima, "nx" | "ny">, escala: Escala): string {
  const w = (g.nx - 1) * PX + 1;
  const h = (g.ny - 1) * PX + 1;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const f = Math.min(g.ny - 2, Math.floor(y / PX));
    const fv = y / PX - f;
    for (let x = 0; x < w; x++) {
      const c = Math.min(g.nx - 2, Math.floor(x / PX));
      const fu = x / PX - c;
      const v =
        valores[f * g.nx + c] * (1 - fu) * (1 - fv) + valores[f * g.nx + c + 1] * fu * (1 - fv) +
        valores[(f + 1) * g.nx + c] * (1 - fu) * fv + valores[(f + 1) * g.nx + c + 1] * fu * fv;
      const [r, gg, b, a] = colorDe(v, escala.paradas);
      const k = (y * w + x) * 4;
      img.data[k] = r;
      img.data[k + 1] = gg;
      img.data[k + 2] = b;
      img.data[k + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}
