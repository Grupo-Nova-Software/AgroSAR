"use client";
// Demo mínima de cableado datos → API → UI (rol Frontend: reemplazar por la UI real).
import { useEffect, useState } from "react";
import type { IndiceHumedad, Recomendacion } from "@/types/contratos";
import { useIdioma } from "./idioma";

export default function DemoAreas({ cultivo = "soja" }: { cultivo?: string }) {
  const { t } = useIdioma();
  const [filas, setFilas] = useState<Recomendacion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const indice: IndiceHumedad = await (await fetch("/data/humedad/index.json")).json();
        const recos = await Promise.all(
          indice.zonas.map(async (z) => (await fetch(`/api/recomendacion?area=${z.id}&cultivo=${encodeURIComponent(cultivo)}`)).json()),
        );
        setFilas(recos);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [cultivo]);

  if (error) return <p className="text-signal">Error: {error}</p>;
  if (!filas.length) return <p className="mt-6 text-muted">{t("cargando")}</p>;

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-3">
      {filas.map((r) => (
        <li key={r.area_id} className="rounded-xl bg-white/80 p-4 shadow-sm">
          <p className="font-mono text-xs uppercase text-muted">{r.area_id}</p>
          <p className="mt-1 text-lg font-semibold text-verde-profundo">{r.etiqueta}</p>
          <p className="mt-1 text-sm text-muted">{r.motivo}</p>
        </li>
      ))}
    </ul>
  );
}
