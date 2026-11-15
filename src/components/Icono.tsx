// Íconos propios de AgroSAR (SVG dibujados a mano en código, trazo redondeado; reemplazan a los emojis).
// Un solo estilo para toda la app: línea de 1.8, puntas redondas, color heredado del texto.
// `IconoClima` es la versión a color para el pronóstico (sol dorado, nube gris, gotas azules).
import Image from "next/image";
import type { ReactNode, SVGProps } from "react";

const TRAZOS = {
  satelite: (
    <g transform="rotate(-45 12 12)">
      <rect x="9.5" y="9" width="5" height="6" rx="1" />
      <rect x="2.5" y="9.5" width="5" height="5" rx=".6" />
      <rect x="16.5" y="9.5" width="5" height="5" rx=".6" />
      <path d="M7.5 12h2M14.5 12h2M12 9V6.500M10.500 5.500a2 2 0 0 1 3 0" />
    </g>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  semilla: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 2.6-6.5 7.5-6.5 0 4.6-2.6 7-7.5 6.5Z" />
      <path d="M12 15c0-2.8-1.9-4.6-5.5-4.6 0 3.3 1.9 5 5.5 4.6Z" />
    </>
  ),
  lapiz: <path d="m4 20 1-4.5L16.5 4a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19 4 20ZM14.5 6l3.5 3.5" />,
  basura: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M10 11v5.5M14 11v5.5" />,
  gota: <path d="M12 3.5c3.3 3.9 5.5 6.8 5.5 9.9a5.5 5.5 0 0 1-11 0c0-3.1 2.2-6 5.5-9.9Z" />,
  pin: (
    <>
      <path d="M12 21c4-4.4 6.5-7.700 6.500-11a6.500 6.500 0 0 0-13 0c0 3.300 2.500 6.600 6.500 11Z" />
      <circle cx="12" cy="10" r="2.300" />
    </>
  ),
  chacra: (
    <>
      <path d="M3.500 19.500 7 6.500h10l3.500 13h-17Z" />
      <path d="M10 6.500 8.500 19.500M14 6.500l1.500 13M5.200 13h13.600" />
    </>
  ),
  sinSenal: <path d="M4 4l16 16M8.500 16.500a5 5 0 0 1 5.500-1M5.500 13.200a9.300 9.300 0 0 1 4-2.300M2.800 9.800A14 14 0 0 1 7 7.200M11 6a14 14 0 0 1 10.200 3.800M15.500 11.800a9.300 9.300 0 0 1 3 1.400M12 19.500h.010" />,
  alerta: <path d="M12 3.500 2.500 20h19L12 3.500ZM12 10v4.500M12 17.300h.010" />,
  check: <path d="M5 12.500l4.500 4.500L19 7.500" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  mapa: <path d="M9 4 3.500 6v14L9 18l6 2 5.500-2V4L15 6 9 4ZM9 4v14M15 6v14" />,
  abajo: <path d="M12 4.500v15M6 13.500l6 6 6-6" />,
  arriba: <path d="M6 14.500l6-6 6 6" />,
  mas: <path d="M12 5v14M5 12h14" />,
  descargar: <path d="M12 3.500v11M7.500 10.500l4.500 4.500 4.500-4.500M4.500 17v2a1.500 1.500 0 0 0 1.500 1.500h12a1.500 1.500 0 0 0 1.500-1.500v-2" />,
  derecha: <path d="m9 5 7 7-7 7" />,
  pulverizar: (
    <>
      <path d="M6 10.500a1.500 1.500 0 0 1 1.500-1.500h5A1.500 1.500 0 0 1 14 10.500v8.500a1.500 1.500 0 0 1-1.500 1.500h-5A1.500 1.500 0 0 1 6 19v-8.500Z" />
      <path d="M8 9V6.500h4V9M12 6.500h4.500l1.500-1.500" />
      <path d="M20.500 6.500h.010M21 9.500h.010M18.500 8h.010" strokeWidth="2.200" />
    </>
  ),
  termometro: (
    <>
      <path d="M10 13.800V5a2 2 0 0 1 4 0v8.800a4 4 0 1 1-4 0Z" />
      <path d="M12 9v8" />
    </>
  ),
  copo: <path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9M9.500 4.500 12 7l2.500-2.500M9.500 19.500 12 17l2.500 2.500" />,
  viento: <path d="M3 9h10.500a2.500 2.500 0 1 0-2.500-2.500M3 13h15a2.800 2.800 0 1 1-2.800 2.800M3 17h7" />,
  balanza: <path d="M12 4v16M7 20h10M5 7h14M5 7l-2.500 6a2.800 2.800 0 0 0 5 0L5 7ZM19 7l-2.500 6a2.800 2.800 0 0 0 5 0L19 7Z" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300 7 7M17 17l1.700 1.700M18.700 5.300 17 7M7 17l-1.700 1.700" />
    </>
  ),
  lluvia: <path d="M7 15a4 4 0 0 1-.500-8 5.500 5.500 0 0 1 10.600 1.200A3.500 3.500 0 0 1 17 15H7ZM8.500 18l-1 2.500M12.500 18l-1 2.500M16.500 18l-1 2.500" />,
  sequia: <path d="M3 18h18M7 18l1.500-4-2-3 2-3M13 18l-1.500-3.500 2.500-3-1.500-3.500M18 18l-1-3 1.500-2.500" />,
  maquina: (
    <>
      <circle cx="7.500" cy="16.500" r="3.500" />
      <circle cx="18" cy="17.500" r="2.300" />
      <path d="M11 16.500h4.700M4.500 13V7h6l1.500 5h5.500a2.500 2.500 0 0 1 2.500 2.500v1" />
    </>
  ),
  bien: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.300 2.800 2.800L16 9.500" />
    </>
  ),
  capas: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  ubicacion: (
    <>
      <circle cx="12" cy="12" r="3.200" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v2.500M12 19.500V22M2 12h2.500M19.500 12H22" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NombreIcono = keyof typeof TRAZOS;

export default function Icono({ nombre, className = "h-5 w-5", ...resto }: { nombre: NombreIcono } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`inline-block shrink-0 ${className}`} {...resto}>
      {TRAZOS[nombre]}
    </svg>
  );
}

// ---------- Dibujos ilustrados (public/dibujos/*.svg, generados con scripts/dibujar_iconos.py a partir de los bocetos del diseñador) ----------
export type NombreDibujo =
  | "brote" | "campo" | "suelo-seco" | "suelo-bueno" | "suelo-mojado"
  | "clima-sol" | "clima-parcial" | "clima-nube" | "clima-lluvia" | "clima-tormenta"
  | "cultivo-maiz" | "cultivo-soja" | "cultivo-mandioca";

/** Un dibujo ilustrado. Son SVG livianos; `unoptimized` porque no hace falta pasarlos por el optimizador de imágenes. */
export function Dibujo({ nombre, className = "h-12 w-12", alto = 96 }: { nombre: NombreDibujo; className?: string; alto?: number }) {
  return <Image src={`/dibujos/${nombre}.svg`} alt="" width={alto} height={alto} unoptimized aria-hidden className={`inline-block shrink-0 object-contain ${className}`} />;
}

// ---------- Pronóstico: dibujos del clima ----------
export type TipoClima = "sol" | "parcial" | "nube" | "llovizna" | "lluvia" | "tormenta";
const DIBUJO_CLIMA: Record<TipoClima, NombreDibujo> = {
  sol: "clima-sol", parcial: "clima-parcial", nube: "clima-nube", llovizna: "clima-parcial", lluvia: "clima-lluvia", tormenta: "clima-tormenta",
};

export function IconoClima({ tipo, className = "h-12 w-12" }: { tipo: TipoClima; className?: string }) {
  return <Dibujo nombre={DIBUJO_CLIMA[tipo]} className={className} />;
}
