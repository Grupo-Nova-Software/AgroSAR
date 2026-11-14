// GET /api/mapa/zonas  (rol Backend)
// Distritos de trabajo (San Rafael del Paraná y Bella Vista) como GeoJSON, con bbox para centrar el mapa.
// Límites APROXIMADOS hasta cargar los oficiales (ver config/zonas/itapua.json).
import { distritosGeoJSON } from "@/lib/mapa/zonas";

export async function GET() {
  return Response.json(distritosGeoJSON());
}
