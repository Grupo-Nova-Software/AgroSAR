// GET /api/recomendacion?area=<id>&cultivo=<cultivo>&hasta=<AAAA-MM-DD>  (rol Backend)
// Lee la serie publicada en /data/humedad/<id>.json (contrato humedad v0) desde el mismo origen,
// porque en Vercel los archivos de public/ se sirven por CDN y no están garantizados en el filesystem de la función.
// TODO Backend: decidir si se lee de Supabase en vez de archivos estáticos.
import { recomendar } from "@/lib/recomendacion";
import type { SerieHumedad } from "@/types/contratos";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const area = url.searchParams.get("area") ?? "";
  const cultivo = url.searchParams.get("cultivo") ?? "soja";

  if (!/^[a-z0-9_]+$/.test(area)) {
    return Response.json({ error: "parámetro 'area' inválido" }, { status: 400 });
  }

  const r = await fetch(new URL(`/data/humedad/${area}.json`, url.origin));
  if (!r.ok) {
    return Response.json({ error: `área '${area}' no encontrada` }, { status: 404 });
  }
  const datos: SerieHumedad = await r.json();

  const hasta = url.searchParams.get("hasta") ?? datos.serie.at(-1)?.fecha ?? new Date().toISOString().slice(0, 10);
  return Response.json(recomendar(datos, cultivo, hasta));
}
