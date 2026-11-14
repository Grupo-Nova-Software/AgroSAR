"use client";
// Aviso obligatorio mientras los datos sean de ejemplo/provisionales.
import { useIdioma } from "./idioma";

export default function AvisoDatos() {
  const { t } = useIdioma();
  return (
    <div role="status" className="border-b border-dorado/40 bg-dorado/15 px-4 py-1.5 text-center text-[11px] text-texto sm:text-xs">
      ⚠️ {t("aviso")}
    </div>
  );
}
