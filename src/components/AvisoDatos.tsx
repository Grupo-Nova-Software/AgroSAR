"use client";
// Aviso obligatorio mientras los datos sean de ejemplo/provisionales.
import { useIdioma } from "./idioma";

export default function AvisoDatos() {
  const { t } = useIdioma();
  return (
    <div role="status" className="border-b border-dorado-cosecha/60 bg-dorado-cosecha/20 px-4 py-1.5 text-center text-xs text-gris-carbon">
      ⚠️ {t("aviso")}
    </div>
  );
}
