"use client";
// Demo mínima de cableado datos → API → UI (rol Frontend: reemplazar por la UI real).
import { useEffect, useState } from "react";
import type { IndiceHumedad, Recomendacion } from "@/types/contratos";

export default function DemoAreas() {
  const [filas, setFilas] = useState<Recomendacion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const indice: IndiceHumedad = await (await fetch("/data/humedad/index.json")).json();
        const recos = await Promise.all(
          indice.zonas.map(async (z) => (await fetch(`/api/recomendacion?area=${z.id}&cultivo=soja`)).json()),
        );
        setFilas(recos);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  if (error) return <p className="text-signal">Error: {error}</p>;
  if (!filas.length) return <p className="text-muted">Loading…</p>;

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-3">
      {filas.map((r) => (
        <li key={r.area_id} className="rounded-lg border border-line bg-surface p-4">
          <p className="font-mono text-xs uppercase text-muted">{r.area_id}</p>
          <p className="mt-1 text-lg font-semibold">{r.etiqueta}</p>
          <p className="mt-1 text-sm text-muted">{r.motivo}</p>
        </li>
      ))}
    </ul>
  );
}
