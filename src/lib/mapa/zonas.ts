// Distritos de trabajo (config/zonas/itapua.json): San Rafael del Paraná y Bella Vista.
import zonasCfg from "../../../config/zonas/itapua.json";
import type { Poligono } from "@/lib/agro/lote";
import { bboxDePoligonos, distanciaKm, puntoEnPoligonos, type BBox } from "./geo";

export interface CentroUrbano {
  nombre: string;
  lonlat: [number, number];
  radio_km: number;
}

export interface Distrito {
  id: string;
  nombre: string;
  centro: [number, number];
  superficie_km2_aprox: number;
  es_aproximado: boolean;
  poligono: Poligono;
  bbox: BBox;
  centros_urbanos: CentroUrbano[];
  cultivos_principales: string[];
  nota: string;
}

type Crudo = Omit<Distrito, "bbox" | "poligono" | "centro" | "centros_urbanos"> & {
  centro: number[];
  poligono: number[][][];
  centros_urbanos: { nombre: string; lonlat: number[]; radio_km: number }[];
};

export const DISTRITOS: Distrito[] = (zonasCfg.distritos as Crudo[]).map((d) => {
  const poligono = d.poligono.map((an) => an.map(([lon, lat]) => [lon, lat] as [number, number])) as Poligono;
  return {
    ...d,
    centro: [d.centro[0], d.centro[1]],
    poligono,
    bbox: bboxDePoligonos([poligono]),
    centros_urbanos: d.centros_urbanos.map((c) => ({ ...c, lonlat: [c.lonlat[0], c.lonlat[1]] })),
  };
});

export const AVISO_ZONAS = zonasCfg._estado;

// bbox que abarca todos los distritos (para centrar el mapa y limitar las consultas).
export const BBOX_TRABAJO: BBox = [
  Math.min(...DISTRITOS.map((d) => d.bbox[0])),
  Math.min(...DISTRITOS.map((d) => d.bbox[1])),
  Math.max(...DISTRITOS.map((d) => d.bbox[2])),
  Math.max(...DISTRITOS.map((d) => d.bbox[3])),
];

export function distritoDePunto(p: [number, number]): Distrito | null {
  return DISTRITOS.find((d) => puntoEnPoligonos(p, [d.poligono])) ?? null;
}

export function distritoMasCercano(p: [number, number]): { distrito: Distrito; km: number } {
  const [d] = DISTRITOS.map((x) => ({ distrito: x, km: distanciaKm(p, x.centro) })).sort((a, b) => a.km - b.km);
  return d;
}

// Distancia (km) al centro urbano más cercano del distrito: sirve para marcar zona urbana en la grilla ficticia.
export function kmACentroUrbano(p: [number, number], d: Distrito): { km: number; radio: number } {
  const [c] = d.centros_urbanos.map((u) => ({ km: distanciaKm(p, u.lonlat), radio: u.radio_km })).sort((a, b) => a.km - b.km);
  return c;
}

export function distritosGeoJSON() {
  return {
    type: "FeatureCollection" as const,
    aviso: AVISO_ZONAS,
    bbox: BBOX_TRABAJO,
    features: DISTRITOS.map((d) => ({
      type: "Feature" as const,
      id: d.id,
      geometry: { type: "Polygon" as const, coordinates: d.poligono },
      properties: {
        id: d.id,
        nombre: d.nombre,
        centro: d.centro,
        superficie_km2_aprox: d.superficie_km2_aprox,
        es_aproximado: d.es_aproximado,
        centros_urbanos: d.centros_urbanos,
        cultivos_principales: d.cultivos_principales,
        nota: d.nota,
      },
    })),
  };
}
