// POST /api/lote  (rol Backend)
// Cuerpo JSON: { poligono: GeoJSON Polygon|MultiPolygon|Feature, cultivo, fecha?, fecha_siembra?, ciclo?,
//                suelo?: { tipo, ph, fertilidad, drenaje, compactado, pendiente_pct, materia_organica_pct, profundidad, preparado } }
// Devuelve hectáreas, centroide, área NISAR donde cae el lote y el análisis completo para ese cultivo.
import { cargarTodas } from "@/lib/agro/datos";
import { leerEntrada } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { hectareas, leerPoligonos, ubicarLote } from "@/lib/agro/lote";
import { analizar } from "@/lib/agro/motor";

export async function POST(request: Request) {
  return manejar(async () => {
    let cuerpo: Record<string, unknown>;
    try {
      cuerpo = await request.json();
    } catch {
      return error(400, "el cuerpo debe ser JSON");
    }
    if (!cuerpo || typeof cuerpo !== "object") return error(400, "el cuerpo debe ser un objeto JSON");

    const cfg = cultivoODevolverError((cuerpo.cultivo as string) ?? null);
    if (cfg instanceof Response) return cfg;

    let polys;
    try {
      polys = leerPoligonos(cuerpo.poligono);
    } catch (e) {
      return error(400, `'poligono' inválido: ${(e as Error).message}`);
    }

    const ha = hectareas(polys);
    if (ha <= 0) return error(400, "el polígono no tiene área");

    const entrada = leerEntrada(cuerpo);
    const series = await cargarTodas(new URL(request.url).origin);
    const ub = ubicarLote(polys, series);

    return Response.json({
      aviso: AVISO,
      lote: {
        hectareas: ha,
        centroide: ub.centroide,
        bbox: ub.bbox,
        area_id: ub.serie?.id ?? null,
        zona: ub.serie?.zona ?? null,
        dentro_de_area: ub.dentro,
        areas_intersectadas: ub.intersectadas,
        ...(ub.dentro ? {} : { nota: "El lote no cae dentro de ningún área con datos NISAR: se usa la más cercana." }),
      },
      analisis: analizar(cfg, ub.serie, entrada),
    });
  });
}
