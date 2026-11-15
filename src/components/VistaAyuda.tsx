"use client";
// Pantalla de Ayuda: cómo se usa, qué significan los colores y de dónde salen los datos
// (acá vive el aviso de datos provisionales que antes estaba fijo arriba de todas las pantallas).
import Link from "next/link";
import { useIdioma, type Clave } from "./idioma";
import Marco from "./Marco";

export default function VistaAyuda() {
  const { t } = useIdioma();
  const pasos: Clave[] = ["ayudaPaso1", "ayudaPaso2", "ayudaPaso3"];
  const colores: { clave: Clave; color: string }[] = [
    { clave: "ayudaVerde", color: "var(--primario)" },
    { clave: "ayudaAmarillo", color: "var(--dorado)" },
    { clave: "ayudaRojo", color: "var(--peligro)" },
  ];
  const tarjeta = "rounded-2xl border border-borde bg-tarjeta p-5";

  return (
    <Marco variante="compacta">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-3 md:px-0">
        <h1 className="font-display text-4xl font-bold tracking-tight">{t("ayudaTitulo")}</h1>

        <section className={tarjeta}>
          <h2 className="font-display text-2xl font-bold">{t("ayudaComo")}</h2>
          <ol className="mt-3 space-y-3">
            {pasos.map((p, i) => (
              <li key={p} className="flex items-start gap-3 text-lg">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primario font-display text-lg font-bold text-sobre-primario">{i + 1}</span>
                <span className="pt-0.5">{t(p)}</span>
              </li>
            ))}
          </ol>
          <Link href="/" className="mt-4 inline-flex h-12 items-center rounded-xl bg-primario px-5 text-lg font-bold text-sobre-primario">
            {t("navCultivos")}
          </Link>
        </section>

        <section className={tarjeta}>
          <h2 className="font-display text-2xl font-bold">{t("ayudaColores")}</h2>
          <ul className="mt-3 space-y-2">
            {colores.map((c) => (
              <li key={c.clave} className="flex items-center gap-3 text-lg">
                <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: c.color }} />
                {t(c.clave)}
              </li>
            ))}
          </ul>
          <div className="mt-4 h-4 rounded-full" style={{ background: "linear-gradient(90deg, #9c4f1a, #e08a2c, #f2d36b, #5fb760, #3fa7b5, #2c6fd1, #1b3f9c)" }} />
          <p className="mt-2 text-lg">{t("ayudaMapa")}</p>
        </section>

        <section className={tarjeta}>
          <h2 className="font-display text-2xl font-bold">{t("ayudaDatos")}</h2>
          <div className="mt-3 space-y-3 text-lg leading-relaxed">
            <p>{t("ayudaDatos1")}</p>
            <p>{t("ayudaDatos2")}</p>
            <p>{t("ayudaSinInternet")}</p>
            <p className="rounded-xl bg-dorado/20 px-4 py-3 font-bold">{t("ayudaDatos3")}</p>
            <p className="text-base text-texto-suave">{t("ayudaFuentes")}</p>
            <p className="text-base text-texto-suave">{t("pie")}</p>
          </div>
        </section>
      </div>
    </Marco>
  );
}
