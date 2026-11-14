"use client";
// Pestaña "Suelo": cultivo + zona → mapa coloreado por el motor del backend, tarjeta de análisis,
// lote dibujado por el agricultor y gráfico de la serie NISAR.
// Datos: /data/humedad/*.json (contrato humedad v0, rol Datos) + /api/ranking, /api/analisis, /api/lote (rol Backend).
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EstadoRecomendacion, IndiceHumedad, SerieHumedad } from "@/types/contratos";
import { CULTIVOS } from "../cultivos";
import { useIdioma } from "../idioma";
import Marco from "../Marco";
import { analizarLote, pedirAnalisis, pedirEstados, type Analisis, type ResultadoLote } from "./api";
import GraficoHumedad from "./GraficoHumedad";
import MapaAreas, { type PoligonoGeoJSON } from "./MapaAreas";
import TarjetaAnalisis from "./TarjetaAnalisis";

export default function VistaSuelo({ cultivo: cultivoParam, area: areaParam }: { cultivo?: string; area?: string }) {
  const { t, tr, idioma } = useIdioma();
  const router = useRouter();

  const cultivo = CULTIVOS.find((c) => c.id === cultivoParam)?.id ?? "soja";
  const [areas, setAreas] = useState<SerieHumedad[]>([]);
  const [estados, setEstados] = useState<Record<string, EstadoRecomendacion>>({});
  const [analisis, setAnalisis] = useState<Analisis | undefined>();
  const [poligono, setPoligono] = useState<PoligonoGeoJSON | null>(null);
  // Resultado del lote con la "clave" de la consulta que lo produjo; si no coincide con la actual, está cargando.
  const [loteGuardado, setLoteGuardado] = useState<{ clave: string; datos: ResultadoLote } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const areaId = (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id) ?? "";

  const actualizarUrl = (cambios: { cultivo?: string; area?: string }) => {
    const p = new URLSearchParams({ cultivo, ...(areaId ? { area: areaId } : {}), ...cambios });
    router.replace(`/suelo?${p.toString()}`, { scroll: false });
  };

  // Áreas y series NISAR (una vez)
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

  // Estados de todas las áreas para colorear el mapa
  useEffect(() => {
    if (!areas.length) return;
    let vigente = true;
    pedirEstados(areas.map((a) => a.id), cultivo, idioma)
      .then((e) => vigente && setEstados(e))
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
    };
  }, [areas, cultivo, idioma]);

  // Análisis completo del área elegida
  useEffect(() => {
    if (!areaId) return;
    let vigente = true;
    pedirAnalisis(areaId, cultivo, idioma)
      .then((a) => vigente && setAnalisis(a))
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
      setAnalisis(undefined);
    };
  }, [areaId, cultivo, idioma]);

  // Análisis del lote dibujado (se repite si cambia el cultivo o el idioma)
  const claveLote = poligono ? `${JSON.stringify(poligono.coordinates)}|${cultivo}|${idioma}` : "";
  useEffect(() => {
    if (!poligono) return;
    let vigente = true;
    analizarLote(poligono, cultivo, idioma)
      .then((r) => vigente && setLoteGuardado({ clave: claveLote, datos: r }))
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
    };
  }, [poligono, cultivo, idioma, claveLote]);
  const lote = poligono && loteGuardado ? loteGuardado.datos : null;
  const cargandoLote = Boolean(poligono) && loteGuardado?.clave !== claveLote;

  const alTerminarLote = (p: PoligonoGeoJSON | null) => setPoligono(p);

  const area = areas.find((a) => a.id === areaId);
  const ultimo = area?.serie.filter((p) => typeof p.humedad_m3m3 === "number").at(-1);
  const fechaCapas = ultimo?.fecha ?? "2026-10-17";

  return (
    <Marco>
      <section className="text-center md:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t("sueloTitulo")}</h1>
        <p className="mt-1 text-sm text-texto-suave">{t("sueloSubtitulo")}</p>
      </section>

      {/* Selector de cultivo */}
      <div role="radiogroup" aria-label={t("cultivo")} className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
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
            <MapaAreas
              areas={areas}
              estados={estados}
              seleccionada={areaId}
              alSeleccionar={(id) => actualizarUrl({ area: id })}
              fechaCapas={fechaCapas}
              alTerminarLote={alTerminarLote}
              cultivo={cultivo}
              celdasLote={poligono ? (lote?.celdas ?? null) : null}
            />
          ) : (
            <div className="grid h-80 place-items-center rounded-2xl border border-borde bg-tarjeta text-sm text-texto-suave md:h-[28rem]">
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

          {/* Resultado del lote dibujado */}
          {(lote || cargandoLote) && (
            <section className="mt-4 rounded-2xl border-2 border-primario/40 bg-tarjeta p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-texto-suave">{t("tuLote")}</p>
              {cargandoLote || !lote ? (
                <p className="mt-2 text-sm text-texto-suave">{t("analizandoLote")}</p>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-semibold">
                    {lote.lote.hectareas.toLocaleString(idioma === "es" ? "es-PY" : "en-US")} {t("hectareas")}
                  </h2>
                  {lote.lote.area_referencia && (
                    <p className="text-xs text-texto-suave">
                      {t("areaReferencia")}: {lote.lote.area_referencia.zona}
                    </p>
                  )}
                  <TarjetaAnalisis analisis={lote.analisis} />
                </>
              )}
            </section>
          )}
        </div>

        {/* Tarjeta de la zona elegida */}
        <aside className="rounded-2xl border border-borde bg-tarjeta p-5 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-texto-suave">{t("zona")}</p>
          <h2 className="font-display text-2xl font-semibold leading-tight">{area?.zona ?? "—"}</h2>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-texto-suave">{t("recomendacion")}</p>
          <TarjetaAnalisis analisis={analisis} />

          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-tarjeta-2 p-3">
              <dt className="text-xs text-texto-suave">{t("retrodispersion")}</dt>
              <dd className="font-display text-xl font-semibold text-acento">
                {typeof ultimo?.hv_db === "number" ? ultimo.hv_db.toFixed(1) : "—"} <span className="text-xs font-normal">dB</span>
              </dd>
            </div>
            <div className="rounded-xl bg-tarjeta-2 p-3">
              <dt className="text-xs text-texto-suave">{t("observaciones")}</dt>
              <dd className="font-display text-xl font-semibold text-acento">{area?.serie.length ?? 0}</dd>
            </div>
          </dl>

          <p className="mt-4 text-[11px] leading-relaxed text-texto-suave">
            {t("fuente")}: <strong className={area?.es_ejemplo ? "text-dorado" : "text-acento"}>{area?.fuente ?? "—"}</strong>. {t("umbralesSupuestos")}
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
