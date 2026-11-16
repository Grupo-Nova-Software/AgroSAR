// POST /api/lote  (rol Backend)
// Cuerpo JSON: { poligono: GeoJSON Polygon|MultiPolygon|Feature, cultivo, fecha?, fecha_siembra?, ciclo?,
//                suelo?: { tipo, ph, fertilidad, drenaje, compactado, pendiente_pct, materia_organica_pct, profundidad, preparado } }
// El agricultor dibuja sus hectáreas en el mapa (solo dentro de Itapúa); se arma la serie SAR de ESAS celdas con la grilla
// NISAR real de todo el departamento, se analiza el cultivo y se detallan los sectores del lote.
// Fuera de Itapúa responde 400. La humedad nunca se inventa: sin dato NISAR, queda "sin datos".
import { cargarTodas } from "@/lib/agro/datos";
import { leerEntrada } from "@/lib/agro/entrada";
import { AVISO, cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { centroide, hectareas, leerPoligonos, ubicarLote } from "@/lib/agro/lote";
import { analizar, fechaReferencia } from "@/lib/agro/motor";
import { celdasGeoJSON } from "@/lib/mapa/celdas";
import { celdasDelLote, LOTE_MAX_HA, resumirSectores } from "@/lib/mapa/sectores";
import { serieDeCeldas } from "@/lib/mapa/series";
import { cargarGrillas, hayGrillaEn } from "@/lib/mapa/grilla-nisar";
import { ITAPUA_NOMBRE, todoDentroDeItapua } from "@/lib/itapua";
import { bboxDePoligonos } from "@/lib/mapa/geo";
import { distritoDePunto } from "@/lib/mapa/zonas";

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

    // AgroSAR solo tiene datos de Itapúa: la chacra entera tiene que estar dentro del departamento.
    if (!polys.every((p) => todoDentroDeItapua(p[0]))) {
      return error(400, "la chacra está fuera de Itapúa: AgroSAR solo tiene datos del departamento de Itapúa (Paraguay)");
    }

    const ha = hectareas(polys);
    if (ha <= 0) return error(400, "el polígono no tiene área");
    if (ha > LOTE_MAX_HA) return error(400, `lote demasiado grande (${ha} ha; máximo ${LOTE_MAX_HA} ha)`);

    const entrada = leerEntrada(cuerpo);
    const fecha = fechaReferencia(null, entrada.fecha);

    // 1) Celdas SAR del lote y serie temporal propia (NISAR real si el rol Datos publicó la grilla).
    await cargarGrillas(new URL(request.url).origin, bboxDePoligonos(polys));
    const { celdas, res_m, bbox } = celdasDelLote(polys, ha, fecha, cfg);
    // Si no se pudo leer ninguna tesela NISAR (falla de red del servidor), se avisa: nunca se inventa la humedad.
    if (!celdas.some((c) => hayGrillaEn(c.centro))) {
      return error(503, "no se pudieron leer los datos NISAR de esa parte de Itapúa; probá de nuevo en un momento");
    }
    const centro = centroide(polys);
    const distrito = distritoDePunto(centro);
    const serie = serieDeCeldas("lote", distrito?.nombre ?? ITAPUA_NOMBRE, bbox, celdas, fecha, true);

    // 2) Área de referencia del contrato de humedad (para comparar con lo publicado por el rol Datos).
    const series = await cargarTodas(new URL(request.url).origin);
    const ref = ubicarLote(polys, series);

    // Igual que en las áreas: sin fecha explícita, se analiza a la fecha de la última pasada del satélite.
    const analisis = analizar(cfg, serie, { ...entrada, fecha: fechaReferencia(serie, entrada.fecha) });
    const sectores = resumirSectores(celdas, ha);

    return Response.json({
      aviso: AVISO,
      lote: {
        hectareas: ha,
        centroide: ref.centroide,
        bbox,
        distrito: distrito ? { id: distrito.id, nombre: distrito.nombre } : null,
        area_referencia: ref.serie ? { id: ref.serie.id, zona: ref.serie.zona, dentro: ref.dentro } : null,
        res_m,
      },
      sectores,
      analisis,
      serie: serie.serie, // evolución de la humedad en ESTE lote (para el gráfico)
      fuente_serie: serie.fuente,
      celdas: celdas.length <= 800 ? celdasGeoJSON(celdas) : null,
    });
  });
}
