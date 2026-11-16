// Viento en movimiento sobre el mapa (al estilo de los mapas de viento): rayitas que avanzan hacia donde sopla,
// más rápidas y largas donde hay más viento. Usa la velocidad y la dirección de la grilla de pronóstico.
// Liviano para teléfonos: pocas partículas, ~25 cuadros por segundo, se detiene si la pestaña no se ve
// y no corre si el usuario pidió menos movimiento.
import type { Map as LMap } from "leaflet";
import type { GrillaClima } from "@/lib/clima/tipos";
import { interpolar } from "./escalas";

export function animarViento(
  m: LMap,
  cv: HTMLCanvasElement,
  g: GrillaClima,
  velKmh: number[],
  dirGrados: number[],
  /** Dónde dibujar (p. ej. solo dentro de Itapúa). Sin esto, en toda la grilla. */
  dentro?: (lat: number, lon: number) => boolean,
): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const ctx = cv.getContext("2d");
  if (!ctx) return () => {};

  // Componentes del viento en cada punto (la dirección es de dónde VIENE): u hacia el este, v hacia el norte
  const base = g.nx * g.ny;
  const u = new Array<number>(base);
  const v = new Array<number>(base);
  for (let i = 0; i < base; i++) {
    const r = (dirGrados[i] * Math.PI) / 180;
    u[i] = -velKmh[i] * Math.sin(r);
    v[i] = -velKmh[i] * Math.cos(r);
  }
  const [lo1, la1, lo2, la2] = g.bbox;

  let ancho = 0;
  let alto = 0;
  const medir = () => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = r.width;
    alto = r.height;
    cv.width = Math.round(ancho * dpr);
    cv.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  medir();

  const CANTIDAD = Math.round(Math.min(260, Math.max(90, (ancho * alto) / 2600)));
  const VIDA = 70;
  type P = { x: number; y: number; edad: number };
  const nueva = (): P => ({ x: Math.random() * ancho, y: Math.random() * alto, edad: Math.floor(Math.random() * VIDA) });
  const ps: P[] = Array.from({ length: CANTIDAD }, nueva);

  const limpiar = () => ctx.clearRect(0, 0, ancho, alto);
  let moviendo = false;
  const alEmpezar = () => {
    moviendo = true;
    limpiar();
  };
  const alTerminar = () => {
    moviendo = false;
    medir();
  };
  m.on("movestart zoomstart", alEmpezar);
  m.on("moveend zoomend resize", alTerminar);

  let cuadro = 0;
  let ultimo = 0;
  const paso = (ahora: number) => {
    cuadro = requestAnimationFrame(paso);
    if (moviendo || document.hidden || ahora - ultimo < 40) return;
    ultimo = ahora;
    // Las estelas se van borrando de a poco
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.09)";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    for (const p of ps) {
      const ll = m.containerPointToLatLng([p.x, p.y]);
      const fuera = ll.lng < lo1 || ll.lng > lo2 || ll.lat < la1 || ll.lat > la2 || (dentro ? !dentro(ll.lat, ll.lng) : false);
      const uu = fuera ? null : interpolar(u, g, ll.lat, ll.lng);
      const vv = fuera ? null : interpolar(v, g, ll.lat, ll.lng);
      if (uu === null || vv === null || p.edad++ > VIDA) {
        Object.assign(p, nueva(), { edad: 0 });
        continue;
      }
      // Píxeles por cuadro: se nota la diferencia entre brisa y viento fuerte sin marear
      const k = 0.14;
      const nx = p.x + uu * k;
      const ny = p.y - vv * k;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      p.x = nx;
      p.y = ny;
      if (nx < 0 || ny < 0 || nx > ancho || ny > alto) Object.assign(p, nueva(), { edad: 0 });
    }
    ctx.stroke();
  };
  cuadro = requestAnimationFrame(paso);

  return () => {
    cancelAnimationFrame(cuadro);
    m.off("movestart zoomstart", alEmpezar);
    m.off("moveend zoomend resize", alTerminar);
    limpiar();
  };
}
