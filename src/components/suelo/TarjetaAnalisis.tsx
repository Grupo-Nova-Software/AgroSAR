"use client";
// Tarjeta con el resultado del motor: estado, motivo, humedad, cuándo sembrar, semilla y alertas.
// Las etiquetas salen de los CÓDIGOS del backend (estado, humedad.estado, nivel) traducidos con el diccionario ES/EN;
// los textos libres (motivo, títulos de alertas) llegan del backend en el idioma pedido con ?lang=.
import { useIdioma, type Clave } from "../idioma";
import type { Analisis } from "./api";
import { TOKEN_ESTADO } from "./MapaAreas";

const COLOR_NIVEL = { critico: "var(--peligro)", advertencia: "var(--dorado)", info: "var(--campo)" } as const;

export default function TarjetaAnalisis({ analisis }: { analisis?: Analisis }) {
  const { t, idioma } = useIdioma();
  if (!analisis) return <div className="mt-2 h-28 animate-pulse rounded-xl bg-tarjeta-2" />;

  const fmt = (f?: string) =>
    f ? new Date(f + "T12:00:00").toLocaleDateString(idioma === "es" ? "es-PY" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const h = analisis.humedad;
  const v = analisis.ventana;
  const alertas = (analisis.alertas ?? []).slice(0, 3);

  return (
    <div className="mt-2 space-y-3">
      <div
        className={`rounded-xl p-4 ${analisis.estado === "esperar" ? "text-[#2b2410]" : "text-white"}`}
        style={{ background: `var(${TOKEN_ESTADO[analisis.estado]})` }}
      >
        <p className="font-display text-2xl font-semibold">{t(`estado_${analisis.estado}`)}</p>
        <p className="mt-1 text-sm opacity-90">{analisis.motivo}</p>
        {analisis.fecha && (
          <p className="mt-2 text-[11px] opacity-75">
            {t("fechaAnalisis")} {fmt(analisis.fecha)}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-tarjeta-2 p-3">
          <dt className="text-xs text-texto-suave">{t("humedadSuelo")}</dt>
          <dd className="font-display text-xl font-semibold text-acento">
            {h?.media_m3m3 != null ? h.media_m3m3.toFixed(2) : "—"} <span className="text-xs font-normal">m³/m³</span>
          </dd>
          {h && h.estado !== "sin_datos" && (
            <dd className="text-[11px] text-texto-suave">
              {t(`humedad_${h.estado}` as Clave)}
              {h.tendencia && ["subiendo", "bajando", "estable"].includes(h.tendencia) ? ` · ${t(`tendencia_${h.tendencia}` as Clave)}` : ""}
            </dd>
          )}
        </div>
        <div className="rounded-xl bg-tarjeta-2 p-3">
          <dt className="text-xs text-texto-suave">{t("cuandoSembrar")}</dt>
          <dd className="font-display text-xl font-semibold text-acento">
            {v ? (v.sembrar_ahora ? t("sembrarAhora") : t("enDias").replace("{n}", String(v.dias_espera))) : "—"}
          </dd>
          {analisis.semilla && (
            <dd className="text-[11px] text-texto-suave">
              {t("semillaSugerida")}: <strong>{analisis.semilla.semilla}</strong>
              {analisis.semilla.ciclo_sugerido ? ` · ${analisis.semilla.ciclo_sugerido.dias} d` : ""}
            </dd>
          )}
        </div>
      </dl>

      {analisis.alertas && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-texto-suave">{t("alertas")}</p>
          {alertas.length ? (
            <ul className="mt-2 space-y-2">
              {alertas.map((a) => (
                <li key={a.id} className="rounded-lg border-l-4 bg-tarjeta-2 px-3 py-2" style={{ borderColor: COLOR_NIVEL[a.nivel] }}>
                  <p className="text-sm font-semibold">
                    {a.titulo}
                    {a.fuente_dato === "nisar" && (
                      <span className="ml-2 rounded-full bg-primario/15 px-2 py-0.5 text-[10px] font-bold uppercase text-acento">
                        NISAR · {t("datoSatelital")}
                      </span>
                    )}
                  </p>
                  {(a.recomendacion || a.detalle) && <p className="mt-0.5 text-xs text-texto-suave">{a.recomendacion ?? a.detalle}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-texto-suave">{t("sinAlertas")}</p>
          )}
        </div>
      )}
    </div>
  );
}
