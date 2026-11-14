// POST /api/lote  (rol Backend)
// Cuerpo JSON: { poligono: GeoJSON Polygon|MultiPolygon|Feature, cultivo, fecha?, fecha_siembra?, ciclo?,
//                suelo?: { tipo, ph, fertilidad, drenaje, compactado, pendiente_pct, materia_organica_pct, profundidad, preparado } }
// El agricultor dibuja sus hectáreas en el mapa; se arma la serie SAR de ESAS celdas (ficticia por ahora),
// se analiza el cultivo y se detallan los sectores del lote (dónde conviene más plantar).
import { cargarTodas } from "@/lib/agro/datos";
import { leerEntrada } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { centroide, hectareas, leerPoligonos, ubicarLote } from "@/lib/agro/lote";
import { analizar, fechaReferencia } from "@/lib/agro/motor";
import { celdasGeoJSON } from "@/lib/mapa/celdas";
import { celdasDelLote, LOTE_MAX_HA, resumirSectores } from "@/lib/mapa/sectores";
import { serieDeCeldas } from "@/lib/mapa/series";
import { distritoDePunto, distritoMasCercano } from "@/lib/mapa/zonas";

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
    if (ha > LOTE_MAX_HA) return error(400, `lote demasiado grande (${ha} ha; máximo ${LOTE_MAX_HA} ha)`);

    const entrada = leerEntrada(cuerpo);
    const fecha = fechaReferencia(null, entrada.fecha);

    // 1) Celdas SAR del lote y serie temporal propia (ficticia, determinista).
    const { celdas, res_m, bbox } = celdasDelLote(polys, ha, fecha, cfg);
    const centro = centroide(polys);
    const distrito = distritoDePunto(centro);
    const cercano = distrito ? null : distritoMasCercano(centro);
    const serie = serieDeCeldas("lote", distrito?.nombre ?? cercano?.distrito.nombre ?? "lote", bbox, celdas, fecha);

    // 2) Área de referencia del contrato de humedad (para comparar con lo publicado por el rol Datos).
    const series = await cargarTodas(new URL(request.url).origin);
    const ref = ubicarLote(polys, series);

    const analisis = analizar(cfg, serie, { ...entrada, fecha });
    const sectores = resumirSectores(celdas, ha);

    return Response.json({
      aviso: AVISO,
      lote: {
        hectareas: ha,
        centroide: ref.centroide,
        bbox,
        distrito: distrito ? { id: distrito.id, nombre: distrito.nombre } : null,
        ...(cercano ? { nota: `El lote está fuera de los distritos de trabajo; el más cercano es ${cercano.distrito.nombre} (${cercano.km.toFixed(1)} km).` } : {}),
        area_referencia: ref.serie ? { id: ref.serie.id, zona: ref.serie.zona, dentro: ref.dentro } : null,
        res_m,
      },
      sectores,
      analisis,
      celdas: celdas.length <= 800 ? celdasGeoJSON(celdas) : null,
    });
  });
}
