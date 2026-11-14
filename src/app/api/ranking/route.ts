// GET /api/ranking?cultivo=<c>  (rol Backend)
//   opcionales: fecha, suelo
// "¿Dónde conviene más?": ordena las áreas NISAR de mejor a peor para el cultivo.
import { cargarTodas } from "@/lib/agro/datos";
import { leerEntrada, queryAObjeto } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, manejar } from "@/lib/agro/http";
import { rankearAreas } from "@/lib/agro/motor";

export async function GET(request: Request) {
  return manejar(async () => {
    const url = new URL(request.url);
    const cfg = cultivoODevolverError(url.searchParams.get("cultivo"));
    if (cfg instanceof Response) return cfg;

    const entrada = leerEntrada(queryAObjeto(url));
    const series = await cargarTodas(url.origin);
    return Response.json({ aviso: AVISO, cultivo: cfg.id, areas: rankearAreas(cfg, series, entrada), supuesto: true });
  });
}
