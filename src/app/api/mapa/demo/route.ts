// GET /api/mapa/demo  (rol Backend)
// Página de PRUEBA del backend para ver el mapa y las APIs funcionando sin esperar al frontend.
// No es la UI final: el rol Frontend la rehace en src/app con el diseño. Sirve como referencia de integración.
import { demoHTML } from "@/lib/mapa/demo-html";

export async function GET() {
  return new Response(demoHTML(), { headers: { "content-type": "text/html; charset=utf-8" } });
}
