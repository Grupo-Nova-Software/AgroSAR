// GET /api/mapa/celdas?bbox=lon_min,lat_min,lon_max,lat_max&cultivo=soja&fecha=AAAA-MM-DD&res=200  (rol Backend)
// Grilla tipo NISAR (200 m) con cobertura, pendiente, humedad SAR y aptitud por celda, en GeoJSON,
// solo dentro de los distritos de trabajo. Humedad NISAR real si hay grilla publicada; cobertura y pendiente ficticias.
import { esFechaISO } from "@/lib/agro/fechas";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { celdasGeoJSON, COLORES, FUENTE_FICTICIA, FUENTE_REAL_CELDAS, generarCeldas, hayFicticias, RES_BASE_M } from "@/lib/mapa/celdas";
import { cargarGrillas } from "@/lib/mapa/grilla-nisar";
import { leerBBox } from "@/lib/mapa/geo";
import { BBOX_TRABAJO } from "@/lib/mapa/zonas";

export async function GET(request: Request) {
  return manejar(async () => {
    const url = new URL(request.url);
    const bboxParam = url.searchParams.get("bbox");
    const bbox = bboxParam ? leerBBox(bboxParam) : BBOX_TRABAJO;
    if (!bbox) return error(400, "'bbox' debe ser lon_min,lat_min,lon_max,lat_max");
    const cfg = cultivoODevolverError(url.searchParams.get("cultivo"));
    if (cfg instanceof Response) return cfg;

    const fecha = url.searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);
    if (!esFechaISO(fecha)) return error(400, "'fecha' debe ser AAAA-MM-DD");

    const resParam = Number(url.searchParams.get("res") ?? RES_BASE_M);
    if (!Number.isFinite(resParam) || resParam < RES_BASE_M || resParam > RES_BASE_M * 16) {
      return error(400, `'res' debe estar entre ${RES_BASE_M} y ${RES_BASE_M * 16} metros`);
    }

    await cargarGrillas(url.origin, bbox);
    const { celdas, res_m, recortado } = generarCeldas(bbox, { fecha, cfg, resM: resParam, maxCeldas: 4000 });
    return Response.json({
      ...celdasGeoJSON(celdas),
      aviso: AVISO,
      fuente: hayFicticias(celdas) ? FUENTE_FICTICIA : FUENTE_REAL_CELDAS,
      es_ejemplo: hayFicticias(celdas),
      cultivo: cfg.id,
      fecha,
      res_m,
      ...(recortado ? { nota: `Se usó una resolución de ${res_m} m para no superar el máximo de celdas; acercá el mapa para ver 200 m.` } : {}),
      colores: COLORES,
    });
  });
}
