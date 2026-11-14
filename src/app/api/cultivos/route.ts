// GET /api/cultivos            → lista de cultivos con temporadas, ciclos, semillas y problemas  (rol Backend)
// GET /api/cultivos?id=maiz    → un solo cultivo
import { CULTIVOS, obtenerCultivo, resumenCultivo } from "@/lib/agro/cultivos";
import { AVISO, error } from "@/lib/agro/http";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const c = obtenerCultivo(id);
    return c ? Response.json({ aviso: AVISO, cultivo: resumenCultivo(c) }) : error(404, `cultivo '${id}' no encontrado`);
  }
  return Response.json({ aviso: AVISO, cultivos: Object.values(CULTIVOS).map(resumenCultivo) });
}
