"use client";
// "Mis chacras": todas las chacras del agricultor de un vistazo, con su semáforo y el agua del suelo.
// Funciona sin internet con el último resultado guardado en el teléfono.
import Link from "next/link";
import { fueraDeItapua, useChacras, type Chacra } from "./chacras";
import { CULTIVOS } from "./cultivos";
import { useIdioma, type Clave } from "./idioma";
import Icono, { Dibujo } from "./Icono";
import Marco from "./Marco";
import { hectareasDe } from "./suelo/api";
import { useResultados } from "./suelo/useResultados";

const COLOR = { sembrar: "var(--primario)", esperar: "var(--dorado)", precaucion: "var(--peligro)" } as const;
const ORDEN = { precaucion: 0, esperar: 1, sembrar: 2 } as const;

/** Silueta de la chacra (su forma real) en su color. */
function Silueta({ c }: { c: Chacra }) {
  const xs = c.vertices.map((v) => v[0]);
  const ys = c.vertices.map((v) => v[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180); // misma escala en x e y
  const ancho = Math.max((x1 - x0) * k, 1e-9);
  const alto = Math.max(y1 - y0, 1e-9);
  const esc = 52 / Math.max(ancho, alto);
  const puntos = c.vertices
    .map(([x, y]) => `${(6 + (32 - (ancho * esc) / 2) + (x - x0) * k * esc).toFixed(1)},${(6 + (32 - (alto * esc) / 2) + (y1 - y) * esc).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 76 76" className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl bg-[#2c3b2f]" aria-hidden>
      <polygon points={puntos} fill={c.color} fillOpacity={0.55} stroke={c.color} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

export default function VistaChacras() {
  const { t, tr, fecha, idioma } = useIdioma();
  const { chacras, cargadas, actualizar } = useChacras();
  const { pendientes, enLinea } = useResultados(chacras, actualizar);
  const num = (n: number) => n.toLocaleString(idioma === "es" ? "es-PY" : "en-US", { maximumFractionDigits: n < 10 ? 1 : 0 });

  // Primero las que necesitan atención
  const ordenadas = [...chacras].sort((a, b) => {
    const ea = a.resultado ? ORDEN[a.resultado.analisis.estado] : 3;
    const eb = b.resultado ? ORDEN[b.resultado.analisis.estado] : 3;
    return ea - eb;
  });
  const cuenta = (e: keyof typeof COLOR) => chacras.filter((c) => c.resultado?.analisis.estado === e).length;

  return (
    <Marco variante="compacta">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-3 md:px-0">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("chacrasTitulo")}</h1>
          <p className="mt-0.5 text-base text-texto-suave">{t("chacrasSub")}</p>
        </div>

        {!enLinea && <p className="rounded-xl bg-dorado/25 px-4 py-3 text-base font-bold">{t("sinConexion")}</p>}

        {cargadas && chacras.length === 0 && (
          <section className="rounded-2xl border border-borde bg-tarjeta p-6 text-center">
            <Dibujo nombre="brote" className="mx-auto h-20 w-20" />
            <p className="mt-3 text-lg">{t("chacrasVacio")}</p>
            <Link href="/suelo?nueva=1" className="mt-4 inline-flex h-14 items-center rounded-xl bg-primario px-6 text-lg font-bold text-sobre-primario">
              {t("marcarPrimera")}
            </Link>
          </section>
        )}

        {chacras.length > 0 && (
          <>
            {/* Resumen en una línea con los tres colores */}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-bold">
              {(["sembrar", "esperar", "precaucion"] as const).map((e) => (
                <span key={e} className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLOR[e] }} aria-hidden />
                  {cuenta(e)} {t(`titulo_${e}` as Clave)}
                </span>
              ))}
            </p>

            <ul className="space-y-3">
              {ordenadas.map((c) => {
                const r = c.resultado?.analisis;
                const cultivo = CULTIVOS.find((x) => x.id === c.cultivo)!;
                const pct = r?.humedad.media_m3m3 != null ? Math.round(r.humedad.media_m3m3 * 100) : null;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/suelo?chacra=${c.id}`}
                      className="flex gap-3 rounded-2xl border border-borde bg-tarjeta p-3 shadow-suave"
                    >
                      <Silueta c={c} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-display text-xl font-bold leading-tight">
                          <span className="truncate">{c.nombre}</span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-base text-texto-suave">
                          <Dibujo nombre={`cultivo-${c.cultivo}`} className="h-6 w-6" />
                          {tr(cultivo.nombre)} · {num(hectareasDe(c.vertices))} {t("ha")}
                        </p>
                        {fueraDeItapua(c) ? (
                          <p className="mt-2 text-[15px] font-bold leading-snug text-peligro">{t("chacraFuera")}</p>
                        ) : r ? (
                          <>
                            <p
                              className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[15px] font-bold ${r.estado === "esperar" ? "text-[#2b2410]" : "text-white"}`}
                              style={{ background: COLOR[r.estado] }}
                            >
                              {t(`titulo_${r.estado}` as Clave)}
                            </p>
                            <p className="mt-1.5 text-[15px]">
                              {t("aguaSuelo")}: <strong>{t(`agua_${r.humedad.estado}` as Clave)}</strong>
                              {pct !== null && <span className="text-texto-suave"> ({pct} %)</span>}
                            </p>
                            {r.humedad.ultima_fecha && (
                              <p className="text-sm text-texto-suave">
                                <Icono nombre="satelite" className="mr-1 h-4 w-4 align-[-3px]" />
                                {fecha(r.humedad.ultima_fecha, true)}
                                {r.humedad.desactualizada && <span className="font-bold text-peligro"> · {t("haceDias", { n: r.humedad.dias_desde_observacion ?? 0 })}</span>}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-base font-bold text-texto-suave">{enLinea ? t("actualizando") : t("sinResultado")}</p>
                        )}
                        {pendientes.has(c.id) && r && <p className="text-sm text-texto-suave">{t("actualizando")}</p>}
                      </div>
                      <Icono nombre="derecha" className="h-6 w-6 self-center text-texto-suave" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/suelo?nueva=1"
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primario text-lg font-bold text-sobre-primario shadow-suave"
            >
              <Icono nombre="mas" className="h-6 w-6" />
              {t("agregarOtra")}
            </Link>
          </>
        )}
      </div>
    </Marco>
  );
}
