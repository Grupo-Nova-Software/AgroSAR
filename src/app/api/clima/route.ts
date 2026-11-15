// GET /api/clima?area=<id>&cultivo=<soja|maiz|mandioca>            → clima en el centro de la zona
// GET /api/clima?lat=<lat>&lon=<lon>&cultivo=<…>[&area=<id>]         → clima en un punto (clic en la chacra)
//   opcional: fecha_siembra=AAAA-MM-DD (para la perspectiva de la campaña)
// Responde: ¿llueve hoy / mañana y a qué hora?, ventanas secas, horas para pulverizar, pico de calor y mínima,
// riesgo de helada con dato real, balance hídrico P − ET0, nivel de sequía cruzado con NISAR y perspectiva de la campaña.
// Fuentes: NASA POWER (histórico) + Open-Meteo (pronóstico, NO es NASA) + NISAR SME2 (public/data/humedad).
// La caché está en src/lib/clima/fuentes.ts ('use cache' + cacheLife), no acá.
import { esFechaISO } from "@/lib/agro/fechas";
import { ID_AREA } from "@/lib/agro/datos";
import { cultivoODevolverError, error, manejar } from "@/lib/agro/http";
import { analizarClima, ErrorClima } from "@/lib/clima/servicio-clima";

function numero(v: string | null): number | null | "invalido" {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : "invalido";
}

export async function GET(request: Request) {
  return manejar(async () => {
    const url = new URL(request.url);
    const area = url.searchParams.get("area");
    if (area !== null && !ID_AREA.test(area)) return error(400, "parámetro 'area' inválido");

    const lat = numero(url.searchParams.get("lat"));
    const lon = numero(url.searchParams.get("lon"));
    if (lat === "invalido" || lon === "invalido") return error(400, "'lat' y 'lon' deben ser números (grados decimales, WGS84)");
    if ((lat === null) !== (lon === null)) return error(400, "'lat' y 'lon' van juntos");

    const cfg = cultivoODevolverError(url.searchParams.get("cultivo"));
    if (cfg instanceof Response) return cfg;

    const siembra = url.searchParams.get("fecha_siembra");
    if (siembra !== null && !esFechaISO(siembra)) return error(400, "'fecha_siembra' debe ser AAAA-MM-DD");

    try {
      return Response.json(await analizarClima({ origen: url.origin, area, lat, lon, cfg, fechaSiembra: siembra }));
    } catch (e) {
      if (e instanceof ErrorClima) return error(e.status, e.message);
      throw e;
    }
  });
}
