// GET /api/ventana?area=<id>&cultivo=<c>  (rol Backend)
//   opcionales: fecha, suelo
// "¿Siembro ahora o dentro de cuánto?" con temporada + humedad NISAR. El pronóstico de lluvia se suma mañana.
import { cargarSerie, ID_AREA } from "@/lib/agro/datos";
import { leerEntrada, queryAObjeto } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { resumirHumedad } from "@/lib/agro/humedad";
import { fechaReferencia } from "@/lib/agro/motor";
import { clasificarTemporada } from "@/lib/agro/temporada";
import { cuandoSembrar } from "@/lib/agro/ventana";

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

    const fecha = fechaReferencia(serie, entrada.fecha);
    const temporada = clasificarTemporada(cfg, fecha);
    const humedad = resumirHumedad(serie, fecha, cfg.humedad, 10);

    return Response.json({
      aviso: AVISO,
      area_id: serie.id,
      cultivo: cfg.id,
      fecha,
      ...cuandoSembrar(cfg, fecha, temporada, humedad, entrada.suelo),
      temporada,
      humedad,
      supuesto: true,
      es_ejemplo: serie.es_ejemplo,
    });
  });
}
