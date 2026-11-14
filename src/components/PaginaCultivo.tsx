"use client";
// Página provisional de un cultivo: muestra las recomendaciones de ejemplo de /api/recomendacion.
// TODO Frontend: reemplazar con el diseño (mapa, gráfico de la serie, tarjeta de recomendación).
import Link from "next/link";
import { CULTIVOS } from "./cultivos";
import { SelectorIdioma, useIdioma } from "./idioma";
import AvisoDatos from "./AvisoDatos";
import DemoAreas from "./DemoAreas";

export default function PaginaCultivo({ id }: { id: string }) {
  const { t, tr } = useIdioma();
  const cultivo = CULTIVOS.find((c) => c.id === id)!;

  return (
    <div className="flex flex-1 flex-col" style={{ backgroundColor: cultivo.fondo }}>
      <AvisoDatos />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="rounded-lg bg-verde-principal px-4 py-1.5 font-semibold text-white">
            ← {t("volver")}
          </Link>
          <SelectorIdioma />
        </header>
        <h1 className="mt-8 text-4xl font-bold text-verde-profundo">{tr(cultivo.nombre)}</h1>
        <p className="mt-2 text-muted">{t("enConstruccion")}</p>
        <DemoAreas cultivo={cultivo.id} />
      </main>
    </div>
  );
}
