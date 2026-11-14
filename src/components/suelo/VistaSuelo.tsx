"use client";
// Pestaña "Suelo": cultivo + zona → mapa coloreado por recomendación, tarjeta de datos y gráfico.
// Datos: /data/humedad/*.json (contrato humedad v0) y /api/recomendacion (contrato recomendacion v0).
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { EstadoRecomendacion, IndiceHumedad, Recomendacion, SerieHumedad } from "@/types/contratos";
import { CULTIVOS } from "../cultivos";
import { useIdioma } from "../idioma";
import Marco from "../Marco";
import GraficoHumedad from "./GraficoHumedad";
import MapaAreas, { TOKEN_ESTADO } from "./MapaAreas";

export default function VistaSuelo({ cultivo: cultivoParam, area: areaParam }: { cultivo?: string; area?: string }) {
  const { t, tr, idioma } = useIdioma();
  const router = useRouter();

  const cultivo = CULTIVOS.find((c) => c.id === cultivoParam)?.id ?? "soja";
  const [areas, setAreas] = useState<SerieHumedad[]>([]);
  const [recos, setRecos] = useState<Record<string, Recomendacion>>({});
  const [error, setError] = useState<string | null>(null);
  const areaId = (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id) ?? "";

  const actualizarUrl = (cambios: { cultivo?: string; area?: string }) => {
    const p = new URLSearchParams({ cultivo, ...(areaId ? { area: areaId } : {}), ...cambios });
    router.replace(`/suelo?${p.toString()}`, { scroll: false });
  };

  // Cargar áreas una vez
  useEffect(() => {
    (async () => {
      try {
        const indice: IndiceHumedad = await (await fetch("/data/humedad/index.json")).json();
        setAreas(await Promise.all(indice.zonas.map(async (z) => (await fetch(`/data/humedad/${z.archivo}`)).json())));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  // Recomendaciones de todas las áreas para el cultivo elegido (colorean el mapa)
  useEffect(() => {
    if (!areas.length) return;
    let vigente = true;
    (async () => {
      try {
        const lista: Recomendacion[] = await Promise.all(
          areas.map(async (a) => (await fetch(`/api/recomendacion?area=${a.id}&cultivo=${cultivo}`)).json()),
        );
        if (vigente) setRecos(Object.fromEntries(lista.map((r) => [r.area_id, r])));
      } catch (e) {
        if (vigente) setError((e as Error).message);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [areas, cultivo]);

  const estados = useMemo(
    () => Object.fromEntries(Object.entries(recos).map(([k, r]) => [k, r.estado])) as Record<string, EstadoRecomendacion>,
    [recos],
  );
  const area = areas.find((a) => a.id === areaId);
  const reco = recos[areaId];
  const ultimo = area?.serie.filter((p) => typeof p.humedad_m3m3 === "number").at(-1);
  const fmt = (f: string) =>
    new Date(f + "T12:00:00").toLocaleDateString(idioma === "es" ? "es-PY" : "en-US", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Marco>
      <section className="text-center md:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t("sueloTitulo")}</h1>
        <p className="mt-1 text-sm text-texto-suave">{t("sueloSubtitulo")}</p>
      </section>

      {/* Selector de cultivo */}
      <div role="radiogroup" aria-label={t("cultivo")} className="mt-5 flex justify-center gap-2 md:justify-start">
        {CULTIVOS.map((c) => {
          const sel = c.id === cultivo;
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={sel}
              onClick={() => actualizarUrl({ cultivo: c.id })}
              className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-semibold transition-colors ${
                sel ? "border-primario bg-primario text-sobre-primario" : "border-borde bg-tarjeta text-texto hover:border-primario"
              }`}
            >
              <Image src={c.imagen} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
              {tr(c.nombre)}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-6 text-sm text-peligro">Error: {error}</p>}

      <div className="mt-6 grid gap-5 md:grid-cols-5">
        <div className="md:col-span-3">
          {areas.length ? (
            <MapaAreas areas={areas} estados={estados} seleccionada={areaId} alSeleccionar={(id) => actualizarUrl({ area: id })} />
          ) : (
            <div className="grid h-72 place-items-center rounded-2xl border border-borde bg-tarjeta text-sm text-texto-suave md:h-[26rem]">
              {t("cargando")}
            </div>
          )}
          {/* Selector accesible de zona (alternativa al mapa) */}
          <label className="mt-3 flex items-center gap-2 text-sm text-texto-suave">
            {t("zona")}
            <select
              value={areaId}
              onChange={(e) => actualizarUrl({ area: e.target.value })}
              className="flex-1 rounded-lg border border-borde bg-tarjeta px-3 py-2 text-texto"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.zona}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Tarjeta de la zona elegida */}
        <aside className="rounded-2xl border border-borde bg-tarjeta p-5 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-texto-suave">{t("zona")}</p>
          <h2 className="font-display text-2xl font-semibold leading-tight">{area?.zona ?? "—"}</h2>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-texto-suave">{t("recomendacion")}</p>
          {reco ? (
            <div
              className={`mt-2 rounded-xl p-4 ${reco.estado === "esperar" ? "text-[#2b2410]" : "text-white"}`}
              style={{ background: `var(${TOKEN_ESTADO[reco.estado]})` }}
            >
              <p className="font-display text-2xl font-semibold">{t(`estado_${reco.estado}`)}</p>
              <p className="mt-1 text-sm opacity-90">{reco.motivo}</p>
            </div>
          ) : (
            <div className="mt-2 h-24 animate-pulse rounded-xl bg-tarjeta-2" />
          )}

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-tarjeta-2 p-3">
              <dt className="text-xs text-texto-suave">{t("humedadActual")}</dt>
              <dd className="font-display text-xl font-semibold text-acento">
                {ultimo ? `${ultimo.humedad_m3m3!.toFixed(2)}` : "—"} <span className="text-xs font-normal">m³/m³</span>
              </dd>
              {ultimo && <dd className="text-[11px] text-texto-suave">{fmt(ultimo.fecha)}</dd>}
            </div>
            <div className="rounded-xl bg-tarjeta-2 p-3">
              <dt className="text-xs text-texto-suave">{t("retrodispersion")}</dt>
              <dd className="font-display text-xl font-semibold text-acento">
                {typeof ultimo?.hv_db === "number" ? ultimo.hv_db.toFixed(1) : "—"} <span className="text-xs font-normal">dB</span>
              </dd>
              <dd className="text-[11px] text-texto-suave">
                {t("observaciones")}: {area?.serie.length ?? 0}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[11px] leading-relaxed text-texto-suave">
            {t("fuente")}: <strong className={area?.es_ejemplo ? "text-dorado" : ""}>{area?.fuente ?? "—"}</strong>. {t("umbralesSupuestos")}
          </p>
        </aside>
      </div>

      {/* Serie temporal */}
      <section className="mt-6 rounded-2xl border border-borde bg-tarjeta p-5">
        <h2 className="font-display text-xl font-semibold">{t("serieTitulo")}</h2>
        <div className="mt-3">{area ? <GraficoHumedad serie={area.serie} /> : <p className="text-sm text-texto-suave">{t("cargando")}</p>}</div>
      </section>
    </Marco>
  );
}
