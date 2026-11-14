"use client";
// Pantalla "Mi suelo": el mapa aéreo grande arriba; abajo, el cartel de recomendación y el gráfico.
// El cultivo viene de la pantalla de inicio (o del menú). La chacra marcada se guarda en el teléfono.
// Datos: /data/humedad/*.json (rol Datos) + /api/ranking, /api/analisis, /api/lote, /api/cultivos (rol Backend).
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { EstadoRecomendacion, IndiceHumedad, SerieHumedad } from "@/types/contratos";
import { CULTIVOS } from "../cultivos";
import { useIdioma } from "../idioma";
import Marco from "../Marco";
import {
  analizarLote, dentroDe, hectareasDe, pedirAnalisis, pedirEstados, pedirUmbrales,
  UMBRALES_DEFECTO, type Analisis, type LonLat, type PoligonoGeoJSON, type ResultadoLote, type UmbralesHumedad,
} from "./api";
import Consejo from "./Consejo";
import GraficoHumedad from "./GraficoHumedad";
import MapaCampo from "./MapaCampo";

const CLAVE_CHACRA = "agrosar.chacra";

export default function VistaSuelo({ cultivo: cultivoParam, area: areaParam }: { cultivo?: string; area?: string }) {
  const { t, tr, idioma } = useIdioma();
  const router = useRouter();

  const cultivoCfg = CULTIVOS.find((c) => c.id === cultivoParam) ?? CULTIVOS[0];
  const cultivo = cultivoCfg.id;
  const [areas, setAreas] = useState<SerieHumedad[]>([]);
  const [estados, setEstados] = useState<Record<string, EstadoRecomendacion>>({});
  const [umbrales, setUmbrales] = useState<{ cultivo: string; u: UmbralesHumedad }>({ cultivo: "", u: UMBRALES_DEFECTO });
  const [analisis, setAnalisis] = useState<{ clave: string; datos: Analisis } | null>(null);
  const [chacra, setChacra] = useState<LonLat[] | null>(null);
  const [loteGuardado, setLoteGuardado] = useState<{ clave: string; datos: ResultadoLote } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const areaId = (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id) ?? "";

  const actualizarUrl = (cambios: { cultivo?: string; area?: string }) => {
    const p = new URLSearchParams({ cultivo, ...(areaId ? { area: areaId } : {}), ...cambios });
    router.replace(`/suelo?${p.toString()}`, { scroll: false });
  };

  // Chacra guardada en el teléfono
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE_CHACRA) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
      if (Array.isArray(v) && v.length >= 3) setChacra(v);
    } catch {}
  }, []);
  const cambiarChacra = (v: LonLat[] | null) => {
    setChacra(v);
    try {
      if (v) localStorage.setItem(CLAVE_CHACRA, JSON.stringify(v));
      else localStorage.removeItem(CLAVE_CHACRA);
    } catch {}
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

  // Por cultivo: estado de cada zona y límites de seco / bueno / mojado
  useEffect(() => {
    let vigente = true;
    pedirEstados(cultivo).then((e) => vigente && setEstados(e)).catch((e) => vigente && setError((e as Error).message));
    pedirUmbrales(cultivo).then((u) => vigente && setUmbrales({ cultivo, u }));
    return () => {
      vigente = false;
    };
  }, [cultivo]);

  // Análisis de la zona elegida
  const claveZona = `${areaId}|${cultivo}`;
  useEffect(() => {
    if (!areaId) return;
    let vigente = true;
    pedirAnalisis(areaId, cultivo)
      .then((a) => vigente && setAnalisis({ clave: `${areaId}|${cultivo}`, datos: a }))
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
    };
  }, [areaId, cultivo]);

  // Análisis de la chacra marcada
  const claveLote = chacra ? `${JSON.stringify(chacra)}|${cultivo}` : "";
  useEffect(() => {
    if (!chacra) return;
    let vigente = true;
    const poligono: PoligonoGeoJSON = { type: "Polygon", coordinates: [[...chacra, chacra[0]]] };
    analizarLote(poligono, cultivo)
      .then((r) => vigente && setLoteGuardado({ clave: claveLote, datos: r }))
      .catch((e) => vigente && setError((e as Error).message));
    return () => {
      vigente = false;
    };
  }, [chacra, cultivo, claveLote]);

  // Si el usuario está dentro de una zona y todavía no eligió ninguna, se elige la suya (la más chica que lo contenga).
  const alUbicar = (p: LonLat) => {
    if (areaParam) return;
    const tam = (a: SerieHumedad) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
    const suya = areas.filter((a) => dentroDe(p, a.bbox)).sort((a, b) => tam(a) - tam(b))[0];
    if (suya && suya.id !== areaId) actualizarUrl({ area: suya.id });
  };

  const area = areas.find((a) => a.id === areaId);
  const analisisZona = analisis?.clave === claveZona ? analisis.datos : undefined;
  const lote = chacra && loteGuardado?.clave === claveLote ? loteGuardado.datos : null;
  const cargandoLote = Boolean(chacra) && !lote;
  const loteReal = lote && !lote.analisis.es_ejemplo ? lote : null;
  const u = umbrales.cultivo === cultivo ? umbrales.u : UMBRALES_DEFECTO;
  const enFrase = tr(cultivoCfg.enFrase);
  const ha = useMemo(() => (chacra ? hectareasDe(chacra) : 0), [chacra]);
  const num = (n: number) => n.toLocaleString(idioma === "es" ? "es-PY" : "en-US", { maximumFractionDigits: n < 10 ? 1 : 0 });

  const selectorZona = (
    <label className="mt-2 flex items-center gap-2 text-base font-bold text-texto-suave">
      {t("zona")}
      <select
        value={areaId}
        onChange={(e) => actualizarUrl({ area: e.target.value })}
        className="h-12 min-w-0 flex-1 rounded-xl border-2 border-borde bg-fondo px-3 text-base font-bold text-texto"
      >
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.zona}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Marco variante="compacta" cultivo={cultivo}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-5 md:px-8">
        <div className="min-w-0 md:col-span-3">
          {areas.length ? (
            <MapaCampo
              areas={areas}
              estados={estados}
              seleccionada={loteReal ? "" : areaId}
              alSeleccionar={(id) => actualizarUrl({ area: id })}
              chacra={chacra}
              alCambiarChacra={cambiarChacra}
              alUbicar={alUbicar}
            />
          ) : (
            <div className="grid h-[62svh] min-h-[22rem] place-items-center bg-tarjeta text-lg text-texto-suave md:h-[34rem] md:rounded-3xl">
              {t("cargando")}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4 px-3 md:col-span-2 md:px-0">
          {error && <p className="rounded-2xl bg-peligro/15 px-4 py-3 text-base font-bold text-peligro">Error: {error}</p>}

          {cargandoLote && (
            <p className="rounded-3xl border border-borde bg-tarjeta p-5 text-lg font-bold text-texto-suave">{t("analizando")}</p>
          )}

          {loteReal ? (
            <Consejo titulo={`${t("tuChacra")} · ${num(ha)} ${t("hectareas")}`} analisis={loteReal.analisis} umbrales={u} cultivo={enFrase} />
          ) : (
            <>
              {lote && <p className="rounded-2xl bg-dorado/20 px-4 py-3 text-base font-bold">{t("sinDatosAqui")}</p>}
              <Consejo titulo={`${t("zonaDe")} ${area?.zona ?? ""}`} analisis={analisisZona} umbrales={u} cultivo={enFrase}>
                {selectorZona}
              </Consejo>
              {!chacra && <p className="px-1 text-base text-texto-suave">👆 {t("pistaChacra")}</p>}
            </>
          )}
        </div>

        <section className="mx-3 min-w-0 rounded-3xl border border-borde bg-tarjeta p-4 md:col-span-5 md:mx-0 md:p-5">
          <h2 className="font-display text-2xl font-bold">{t("graficoTitulo")}</h2>
          <p className="mt-1 text-base text-texto-suave">{t("graficoSub", { cultivo: enFrase })}</p>
          <div className="mt-3">
            {loteReal?.serie?.length ? (
              <GraficoHumedad serie={loteReal.serie} umbrales={u} />
            ) : area ? (
              <GraficoHumedad serie={area.serie} umbrales={u} />
            ) : (
              <p className="text-base text-texto-suave">{t("cargando")}</p>
            )}
          </div>
        </section>
      </div>
    </Marco>
  );
}
