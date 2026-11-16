"use client";
// Pantalla "Mi suelo": el mapa aéreo de Itapúa arriba; abajo, el cartel de recomendación y el gráfico.
// El agricultor puede marcar varias chacras en cualquier lugar de Itapúa (guardadas en el teléfono, ver chacras.ts).
// Al guardar una, la pantalla baja sola hasta el resultado; si queda fuera de la vista, aparece un botón para ir.
// Sin chacra elegida se muestra el promedio de todo el departamento.
// Datos: /data/humedad/itapua.json (rol Datos) + /api/analisis, /api/lote, /api/cultivos (rol Backend).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SerieHumedad } from "@/types/contratos";
import { ITAPUA_ID } from "@/lib/itapua";
import { centroDeChacra, claveDe, fueraDeItapua, useChacras } from "../chacras";
import { CULTIVOS } from "../cultivos";
import { FondoGlobal } from "../FondoCultivoScroll";
import { useIdioma } from "../idioma";
import Icono from "../Icono";
import Marco from "../Marco";
import { useCultivoGuardado } from "../preferencias";
import { hectareasDe, pedirAnalisis, pedirUmbrales, UMBRALES_DEFECTO, type Analisis, type LonLat, type UmbralesHumedad } from "./api";
import Consejo from "./Consejo";
import EditorChacra from "./EditorChacra";
import GraficoHumedad from "./GraficoHumedad";
import MapaCampo from "./MapaCampo";
import { useResultados } from "./useResultados";

type Cultivo = (typeof CULTIVOS)[number]["id"];

export default function VistaSuelo({
  cultivo: cultivoParam,
  chacra: chacraParam,
  nueva = false,
}: {
  cultivo?: string;
  /** Ya no hay zonas: se acepta el parámetro para que los enlaces viejos no fallen, pero no se usa. */
  area?: string;
  chacra?: string;
  nueva?: boolean;
}) {
  const { t, tr, fecha, idioma } = useIdioma();
  const router = useRouter();
  const { chacras, cargadas, agregar, actualizar, borrar } = useChacras();
  const { pendientes, enLinea } = useResultados(chacras, actualizar);

  // Cultivo compartido con Inicio y Clima: la URL manda; sin parámetros, el último elegido.
  const [cultivoGuardado, guardarCultivo] = useCultivoGuardado();

  // Chacra a mostrar: la pedida en la URL; si no, la primera que siembra el cultivo elegido.
  const cultivoUrl = CULTIVOS.find((c) => c.id === cultivoParam)?.id;
  const cultivoElegido = cultivoUrl ?? cultivoGuardado ?? undefined;
  const chacra =
    chacras.find((c) => c.id === chacraParam) ??
    (chacraParam === "ninguna" ? undefined : chacras.find((c) => !cultivoElegido || c.cultivo === cultivoElegido));
  const cultivo: Cultivo = chacra?.cultivo ?? cultivoElegido ?? "soja";
  const cultivoCfg = CULTIVOS.find((c) => c.id === cultivo)!;
  const chacraFuera = !!chacra && fueraDeItapua(chacra);

  const [itapua, setItapua] = useState<SerieHumedad | null>(null);
  const [umbrales, setUmbrales] = useState<{ cultivo: string; u: UmbralesHumedad }>({ cultivo: "", u: UMBRALES_DEFECTO });
  const [analisis, setAnalisis] = useState<{ clave: string; datos: Analisis } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recienGuardada, setRecienGuardada] = useState<string | null>(null);

  // Lo que el usuario elige acá (cultivo o chacra en la URL) pasa a Inicio y Clima.
  const eligioCultivo = !!(cultivoUrl || (chacraParam && chacra));
  useEffect(() => {
    if (eligioCultivo) guardarCultivo(cultivo);
  }, [eligioCultivo, cultivo, guardarCultivo]);

  const ir = (p: Record<string, string>) => router.replace(`/suelo?${new URLSearchParams(p).toString()}`, { scroll: false });
  const elegirChacra = (id: string) => ir({ chacra: id });

  // Serie NISAR de todo Itapúa (una vez): es el gráfico cuando no hay chacra elegida
  useEffect(() => {
    fetch(`/data/humedad/${ITAPUA_ID}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setItapua)
      .catch((e) => setError((e as Error).message));
  }, []);

  // Por cultivo: límites de seco / bueno / mojado
  useEffect(() => {
    let vigente = true;
    pedirUmbrales(cultivo).then((u) => vigente && setUmbrales({ cultivo, u }));
    return () => {
      vigente = false;
    };
  }, [cultivo]);

  // Análisis de todo Itapúa (solo si no se está mirando una chacra)
  const claveItapua = `${ITAPUA_ID}|${cultivo}`;
  useEffect(() => {
    if (chacra) return;
    let vigente = true;
    pedirAnalisis(ITAPUA_ID, cultivo)
      .then((a) => vigente && setAnalisis({ clave: `${ITAPUA_ID}|${cultivo}`, datos: a }))
      .catch((e) => vigente && setError(enLinea ? (e as Error).message : null));
    return () => {
      vigente = false;
    };
  }, [cultivo, chacra, enLinea]);

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

  const analisisItapua = analisis?.clave === claveItapua ? analisis.datos : undefined;
  const u = umbrales.cultivo === cultivo ? umbrales.u : UMBRALES_DEFECTO;
  const enFrase = tr(cultivoCfg.enFrase);
  const num = (n: number) => n.toLocaleString(idioma === "es" ? "es-PY" : "en-US", { maximumFractionDigits: n < 10 ? 1 : 0 });

  // Resultado de la chacra elegida: el guardado (aunque sea viejo) mientras se actualiza
  const res = chacra?.resultado;
  const resActual = chacra && chacra.claveResultado === claveDe(chacra);
  const chacraSinDatoReal = res && res.analisis.es_ejemplo;

  const avisoChacra = chacra && (
    <>
      {chacra.id === recienGuardada && <p className="mt-2 rounded-xl bg-primario px-4 py-3 text-lg font-bold text-sobre-primario">{t("chacraGuardada")}</p>}
      {!enLinea && res && (
        <p className="mt-2 rounded-xl bg-dorado/25 px-4 py-2 text-base font-bold">
          {t("sinConexion")} {t("guardadoEl", { fecha: fecha(res.consultado.slice(0, 10), true) })}
        </p>
      )}
      {!enLinea && !res && <p className="mt-2 rounded-xl bg-dorado/25 px-4 py-2 text-base font-bold">{t("sinResultado")}</p>}
      {enLinea && pendientes.has(chacra.id) && res && !resActual && <p className="mt-2 text-base font-bold text-texto-suave">{t("actualizando")}</p>}
      {chacraFuera && <p className="mt-2 rounded-xl bg-peligro/15 px-4 py-3 text-base font-bold text-peligro">{t("chacraFuera")}</p>}
      {!chacraFuera && chacraSinDatoReal && <p className="mt-2 rounded-xl bg-dorado/25 px-4 py-2 text-base font-bold">{t("sinDatosAqui")}</p>}
    </>
  );

  const serieGrafico = chacra ? (res?.serie?.length ? res.serie : null) : (itapua?.serie ?? null);

  return (
    <Marco variante="compacta" cultivo={cultivo} fondo={<FondoGlobal cultivo={cultivo} punto={chacra && !chacraFuera ? centroDeChacra(chacra) : null} />}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-5 md:px-8">
        <div className="min-w-0 md:col-span-3">
          {cargadas ? (
            <MapaCampo
              chacras={chacras}
              chacraSel={chacra?.id ?? null}
              alElegirChacra={elegirChacra}
              alGuardarChacra={alGuardarChacra}
              dibujarAlAbrir={nueva}
            />
          ) : (
            <div className="grid h-[62svh] min-h-[22rem] place-items-center bg-tarjeta text-lg text-texto-suave md:h-[34rem] md:rounded-2xl">
              {t("cargando")}
            </div>
          )}
        </div>

        <div ref={refResultado} className="min-w-0 scroll-mt-3 space-y-4 px-3 md:col-span-2 md:px-0">
          {error && enLinea && <p className="rounded-xl bg-peligro/15 px-4 py-3 text-base font-bold text-peligro">Error: {error}</p>}

          {chacra ? (
            <Consejo
              key={chacra.id}
              titulo={`${chacra.nombre} · ${num(hectareasDe(chacra.vertices))} ${t("ha")}`}
              marca={chacra.color}
              analisis={chacraFuera ? undefined : res?.analisis}
              sinDatos={chacraFuera}
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
              <Consejo titulo={t("todoItapua")} subtitulo={t("promedioItapua")} analisis={analisisItapua} umbrales={u} cultivo={enFrase} />
              {chacras.length > 0 && <p className="px-1 text-sm text-texto-suave">{t("elegirChacra")}</p>}
            </>
          )}
        </div>

        <section className="mx-3 min-w-0 rounded-2xl border border-borde bg-tarjeta px-3 py-4 shadow-suave md:col-span-5 md:mx-0 md:p-5">
          <h2 className="px-1 font-display text-xl font-bold">{t("graficoTitulo")}</h2>
          <p className="mt-0.5 px-1 text-sm text-texto-suave">{t("graficoSub", { cultivo: enFrase })}</p>
          <div className="mt-3">
            {serieGrafico ? <GraficoHumedad serie={serieGrafico} umbrales={u} /> : <p className="text-base text-texto-suave">{t("cargando")}</p>}
          </div>
        </section>
      </div>

      {/* Botón para bajar al resultado cuando no se ve (gente que no sabe que tiene que deslizar) */}
      {!resultadoVisible && (chacra ? res && !chacraFuera : analisisItapua) && (
        <button
          type="button"
          onClick={bajarAlResultado}
          className="fixed inset-x-4 bottom-[5.5rem] z-[1200] mx-auto flex h-14 max-w-sm items-center justify-center gap-2 rounded-full bg-primario px-5 text-lg font-bold text-sobre-primario shadow-2xl md:bottom-24"
        >
          <Icono nombre="abajo" />
          {chacra ? t("verResultado") : t("verConsejo")}
        </button>
      )}
    </Marco>
  );
}
