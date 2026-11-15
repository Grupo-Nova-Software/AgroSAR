"use client";
// Pantalla "Mi suelo": el mapa aéreo grande arriba; abajo, el cartel de recomendación y el gráfico.
// El agricultor puede marcar varias chacras (guardadas en el teléfono, ver chacras.ts). Al guardar una,
// la pantalla baja sola hasta el resultado; si el resultado queda fuera de la vista, aparece un botón para ir.
// Datos: /data/humedad/*.json (rol Datos) + /api/ranking, /api/analisis, /api/lote, /api/cultivos (rol Backend).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { EstadoRecomendacion, IndiceHumedad, SerieHumedad } from "@/types/contratos";
import { claveDe, useChacras } from "../chacras";
import { CULTIVOS } from "../cultivos";
import { useIdioma } from "../idioma";
import Marco from "../Marco";
import {
  dentroDe, hectareasDe, pedirAnalisis, pedirEstados, pedirUmbrales,
  UMBRALES_DEFECTO, type Analisis, type LonLat, type UmbralesHumedad,
} from "./api";
import Consejo from "./Consejo";
import EditorChacra from "./EditorChacra";
import GraficoHumedad from "./GraficoHumedad";
import MapaCampo from "./MapaCampo";
import { useResultados } from "./useResultados";

type Cultivo = (typeof CULTIVOS)[number]["id"];

export default function VistaSuelo({
  cultivo: cultivoParam,
  area: areaParam,
  chacra: chacraParam,
  nueva = false,
}: {
  cultivo?: string;
  area?: string;
  chacra?: string;
  nueva?: boolean;
}) {
  const { t, tr, fecha, idioma } = useIdioma();
  const router = useRouter();
  const { chacras, cargadas, agregar, actualizar, borrar } = useChacras();
  const { pendientes, enLinea } = useResultados(chacras, actualizar);

  // Chacra a mostrar: la pedida en la URL; si no, la primera que siembra el cultivo elegido.
  const cultivoUrl = CULTIVOS.find((c) => c.id === cultivoParam)?.id;
  const chacra =
    chacras.find((c) => c.id === chacraParam) ??
    (chacraParam === "ninguna" || areaParam ? undefined : chacras.find((c) => !cultivoUrl || c.cultivo === cultivoUrl));
  const cultivo: Cultivo = chacra?.cultivo ?? cultivoUrl ?? "soja";
  const cultivoCfg = CULTIVOS.find((c) => c.id === cultivo)!;

  const [areas, setAreas] = useState<SerieHumedad[]>([]);
  const [estados, setEstados] = useState<Record<string, EstadoRecomendacion>>({});
  const [umbrales, setUmbrales] = useState<{ cultivo: string; u: UmbralesHumedad }>({ cultivo: "", u: UMBRALES_DEFECTO });
  const [analisis, setAnalisis] = useState<{ clave: string; datos: Analisis } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recienGuardada, setRecienGuardada] = useState<string | null>(null);
  const areaId = (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id) ?? "";

  const ir = (p: Record<string, string>) => router.replace(`/suelo?${new URLSearchParams(p).toString()}`, { scroll: false });
  const elegirZona = (id: string) => ir({ cultivo, area: id, chacra: "ninguna" });
  const elegirChacra = (id: string) => ir({ chacra: id });

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
    pedirEstados(cultivo).then((e) => vigente && setEstados(e)).catch(() => {});
    pedirUmbrales(cultivo).then((u) => vigente && setUmbrales({ cultivo, u }));
    return () => {
      vigente = false;
    };
  }, [cultivo]);

  // Análisis de la zona (solo si no se está mirando una chacra)
  const claveZona = `${areaId}|${cultivo}`;
  useEffect(() => {
    if (!areaId || chacra) return;
    let vigente = true;
    pedirAnalisis(areaId, cultivo)
      .then((a) => vigente && setAnalisis({ clave: `${areaId}|${cultivo}`, datos: a }))
      .catch((e) => vigente && setError(enLinea ? (e as Error).message : null));
    return () => {
      vigente = false;
    };
  }, [areaId, cultivo, chacra, enLinea]);

  // Si el usuario está dentro de una zona y no tiene chacras, se elige su zona (la más chica que lo contenga).
  const alUbicar = (p: LonLat) => {
    if (areaParam || chacras.length) return;
    const tam = (a: SerieHumedad) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
    const suya = areas.filter((a) => dentroDe(p, a.bbox)).sort((a, b) => tam(a) - tam(b))[0];
    if (suya && suya.id !== areaId) ir({ cultivo, area: suya.id });
  };

  const alGuardarChacra = (vertices: LonLat[], editandoId: string | null) => {
    if (editandoId) {
      actualizar(editandoId, { vertices });
      setRecienGuardada(editandoId);
      elegirChacra(editandoId);
    } else {
      const nueva = agregar(vertices, cultivo);
      setRecienGuardada(nueva.id);
      elegirChacra(nueva.id);
    }
  };

  // ---------- Llevar al usuario al resultado ----------
  const refResultado = useRef<HTMLDivElement>(null);
  const [resultadoVisible, setResultadoVisible] = useState(true);
  useEffect(() => {
    const el = refResultado.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setResultadoVisible(e.isIntersecting), { rootMargin: "0px 0px -35% 0px" });
    io.observe(el);
    return () => io.disconnect();
  });
  const bajarAlResultado = () => refResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Después de guardar una chacra, bajar solo cuando su resultado esté listo
  const resultadoListo = chacra && chacra.id === recienGuardada && chacra.claveResultado === claveDe(chacra);
  useEffect(() => {
    if (!resultadoListo) return;
    const id = setTimeout(bajarAlResultado, 250);
    const fin = setTimeout(() => setRecienGuardada(null), 4000);
    return () => {
      clearTimeout(id);
      clearTimeout(fin);
    };
  }, [resultadoListo]);

  const area = areas.find((a) => a.id === areaId);
  const analisisZona = analisis?.clave === claveZona ? analisis.datos : undefined;
  const u = umbrales.cultivo === cultivo ? umbrales.u : UMBRALES_DEFECTO;
  const enFrase = tr(cultivoCfg.enFrase);
  const num = (n: number) => n.toLocaleString(idioma === "es" ? "es-PY" : "en-US", { maximumFractionDigits: n < 10 ? 1 : 0 });

  // Resultado de la chacra elegida: el guardado (aunque sea viejo) mientras se actualiza
  const res = chacra?.resultado;
  const resActual = chacra && chacra.claveResultado === claveDe(chacra);
  const chacraSinDatoReal = res && res.analisis.es_ejemplo;

  const avisoChacra = chacra && (
    <>
      {chacra.id === recienGuardada && <p className="mt-2 rounded-2xl bg-primario px-4 py-3 text-lg font-bold text-sobre-primario">{t("chacraGuardada")}</p>}
      {!enLinea && res && (
        <p className="mt-2 rounded-2xl bg-dorado/25 px-4 py-2 text-base font-bold">
          📵 {t("sinConexion")} {t("guardadoEl", { fecha: fecha(res.consultado.slice(0, 10), true) })}
        </p>
      )}
      {!enLinea && !res && <p className="mt-2 rounded-2xl bg-dorado/25 px-4 py-2 text-base font-bold">📵 {t("sinResultado")}</p>}
      {enLinea && pendientes.has(chacra.id) && res && !resActual && <p className="mt-2 text-base font-bold text-texto-suave">{t("actualizando")}</p>}
      {chacraSinDatoReal && <p className="mt-2 rounded-2xl bg-dorado/25 px-4 py-2 text-base font-bold">{t("sinDatosAqui")}</p>}
    </>
  );

  const selectorZona = (
    <label className="mt-2 flex items-center gap-2 text-base font-bold text-texto-suave">
      {t("zona")}
      <select
        value={areaId}
        onChange={(e) => elegirZona(e.target.value)}
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

  const serieGrafico = chacra ? (res?.serie?.length ? res.serie : null) : (area?.serie ?? null);

  return (
    <Marco variante="compacta" cultivo={cultivo}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-5 md:px-8">
        <div className="min-w-0 md:col-span-3">
          {areas.length && cargadas ? (
            <MapaCampo
              areas={areas}
              estados={estados}
              seleccionada={chacra ? "" : areaId}
              alSeleccionar={elegirZona}
              chacras={chacras}
              chacraSel={chacra?.id ?? null}
              alElegirChacra={elegirChacra}
              alGuardarChacra={alGuardarChacra}
              dibujarAlAbrir={nueva}
              alUbicar={alUbicar}
            />
          ) : (
            <div className="grid h-[62svh] min-h-[22rem] place-items-center bg-tarjeta text-lg text-texto-suave md:h-[34rem] md:rounded-3xl">
              {t("cargando")}
            </div>
          )}
        </div>

        <div ref={refResultado} className="min-w-0 scroll-mt-3 space-y-4 px-3 md:col-span-2 md:px-0">
          {error && enLinea && <p className="rounded-2xl bg-peligro/15 px-4 py-3 text-base font-bold text-peligro">Error: {error}</p>}

          {chacra ? (
            <Consejo
              key={chacra.id}
              titulo={`${chacra.nombre} · ${num(hectareasDe(chacra.vertices))} ${t("ha")}`}
              marca={chacra.color}
              analisis={res?.analisis}
              umbrales={u}
              cultivo={enFrase}
              aviso={avisoChacra}
              pie={
                <EditorChacra
                  chacra={chacra}
                  alCambiar={(c) => actualizar(chacra.id, c)}
                  alBorrar={() => {
                    borrar(chacra.id);
                    ir({ cultivo, chacra: "ninguna" });
                  }}
                />
              }
            />
          ) : (
            <>
              <Consejo titulo={`${t("zonaDe")} ${area?.zona ?? ""}`} analisis={analisisZona} umbrales={u} cultivo={enFrase}>
                {selectorZona}
              </Consejo>
              <p className="px-1 text-base text-texto-suave">👆 {chacras.length ? t("elegirChacra") : t("pistaChacra")}</p>
            </>
          )}
        </div>

        <section className="mx-3 min-w-0 rounded-3xl border border-borde bg-tarjeta p-4 md:col-span-5 md:mx-0 md:p-5">
          <h2 className="font-display text-2xl font-bold">{t("graficoTitulo")}</h2>
          <p className="mt-1 text-base text-texto-suave">{t("graficoSub", { cultivo: enFrase })}</p>
          <div className="mt-3">
            {serieGrafico ? <GraficoHumedad serie={serieGrafico} umbrales={u} /> : <p className="text-base text-texto-suave">{t("cargando")}</p>}
          </div>
        </section>
      </div>

      {/* Botón para bajar al resultado cuando no se ve (gente que no sabe que tiene que deslizar) */}
      {!resultadoVisible && (chacra ? res : analisisZona) && (
        <button
          type="button"
          onClick={bajarAlResultado}
          className="fixed inset-x-4 bottom-[5.5rem] z-[1200] mx-auto flex h-14 max-w-sm items-center justify-center gap-2 rounded-full bg-primario px-5 text-lg font-bold text-sobre-primario shadow-2xl md:bottom-24"
        >
          ↓ {chacra ? t("verResultado") : t("verConsejo")}
        </button>
      )}
    </Marco>
  );
}
