// GET /api/semilla?cultivo=<c>&suelo=<arcilloso|arenoso|franco|humedo|degradado>  (rol Backend)
//   opcionales: fecha (de siembra, por defecto hoy), area (suma la humedad NISAR para el riesgo hídrico), fertilidad
// Responde qué semilla usar, el ciclo sugerido (evita heladas) y si la siembra es tardía.
import { cargarSerie, ID_AREA } from "@/lib/agro/datos";
import { leerEntrada, queryAObjeto } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { resumirHumedad } from "@/lib/agro/humedad";
import { fechaReferencia } from "@/lib/agro/motor";
import { recomendarSemilla } from "@/lib/agro/semilla";
import { clasificarTemporada, esSiembraTardia } from "@/lib/agro/temporada";

export async function GET(request: Request) {
  return manejar(async () => {
    const url = new URL(request.url);
    const cfg = cultivoODevolverError(url.searchParams.get("cultivo"));
    if (cfg instanceof Response) return cfg;

    const entrada = leerEntrada(queryAObjeto(url));
    const area = url.searchParams.get("area");
    let serie = null;
    if (area) {
      if (!ID_AREA.test(area)) return error(400, "parámetro 'area' inválido");
      serie = await cargarSerie(url.origin, area);
      if (!serie) return error(404, `área '${area}' no encontrada`);
    }

    const fecha = entrada.fecha_siembra ?? fechaReferencia(serie, entrada.fecha);
    const temporada = clasificarTemporada(cfg, fecha);
    const humedad = resumirHumedad(serie, fecha, cfg.humedad, 10);
    const estres = humedad.estado === "seco" || humedad.estado === "bajo" || entrada.suelo?.tipo === "arenoso";
    const tardia = esSiembraTardia(temporada);

    return Response.json({
      aviso: AVISO,
      cultivo: cfg.id,
      fecha,
      siembra_tardia: tardia,
      riesgo_estres_hidrico: estres,
      temporada,
      humedad: area ? humedad : null,
      ...recomendarSemilla(cfg, entrada.suelo, { siembra: fecha, tardia, estres_hidrico: estres }),
      supuesto: true,
      fuente: cfg.fuente,
    });
  });
}
