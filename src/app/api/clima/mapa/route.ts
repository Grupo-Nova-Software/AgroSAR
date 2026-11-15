// GET /api/clima/mapa → grilla de pronóstico sobre Itapúa (9 × 6 puntos, ~30 km) + nodos de referencia.
// 48 h en pasos de 3 h y 14 días, para las capas y la línea de tiempo del mapa de clima.
// Fuente: Open-Meteo (modelo, NO es dato NASA). Los nodos son puntos de referencia con valores del modelo, no estaciones.
import { connection } from "next/server";
import { error, manejar } from "@/lib/agro/http";
import { ErrorClima, grillaClima } from "@/lib/clima/servicio-clima";

export async function GET() {
  return manejar(async () => {
    // El pronóstico depende de la hora: no se prerenderiza en el build, se resuelve en cada pedido (con caché por hora).
    await connection();
    try {
      return Response.json(await grillaClima());
    } catch (e) {
      if (e instanceof ErrorClima) return error(e.status, e.message);
      throw e;
    }
  });
}
