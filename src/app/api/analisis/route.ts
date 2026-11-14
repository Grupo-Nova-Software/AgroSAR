// GET /api/analisis?area=<id>&cultivo=<soja|maiz|mandioca>  (rol Backend)
//   opcionales: fecha, fecha_siembra (→ modo seguimiento), ciclo, suelo, ph, fertilidad, drenaje,
//               compactado, pendiente_pct, materia_organica_pct, profundidad, preparado
// Análisis completo: estado, semilla, cuándo sembrar, fechas estimadas y alertas por problema.
import { cargarSerie, ID_AREA } from "@/lib/agro/datos";
import { leerEntrada, queryAObjeto } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { analizar } from "@/lib/agro/motor";

export async function GET(request: Request) {
  return manejar(async () => {
    const url = new URL(request.url);
    const area = url.searchParams.get("area") ?? "";
    if (!ID_AREA.test(area)) return error(400, "parámetro 'area' inválido");

    const cfg = cultivoODevolverError(url.searchParams.get("cultivo"));
    if (cfg instanceof Response) return cfg;

    const entrada = leerEntrada(queryAObjeto(url));
    const serie = await cargarSerie(url.origin, area);
    if (!serie) return error(404, `área '${area}' no encontrada`);

    return Response.json({ aviso: AVISO, ...analizar(cfg, serie, entrada) });
  });
}
