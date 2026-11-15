"use client";
// Pantalla "Clima": respuestas rápidas para el agricultor, mapa del clima sobre la vista aérea, hora por hora,
// balance de agua (NASA POWER + radar NISAR) y los próximos meses de la campaña.
// Datos: GET /api/clima (punto o zona) y GET /api/clima/mapa (grilla para las capas). Rol Backend: src/lib/clima.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { IndiceHumedad, SerieHumedad } from "@/types/contratos";
import type { GrillaClima, RespuestaClima } from "@/lib/clima/tipos";
import BalanceHidrico from "./clima/BalanceHidrico";
import DetalleHorario from "./clima/DetalleHorario";
import Perspectiva from "./clima/Perspectiva";
import Tarjetas from "./clima/Tarjetas";
import { useClimaTextos } from "./clima/textos";
import { CULTIVOS } from "./cultivos";
import type { Idioma } from "./idioma";
import Marco from "./Marco";

// Leaflet usa `window`: el mapa se carga solo en el navegador.
const MapaClima = dynamic(() => import("./clima/MapaClima"), {
  ssr: false,
  loading: () => <div className="h-[68svh] min-h-[26rem] w-full animate-pulse bg-tarjeta-2 md:h-[36rem] md:rounded-3xl" />,
});

const FUENTES_UI: Record<"nasa_power" | "open_meteo" | "climatologia", string> = {
  nasa_power: "NASA POWER",
  open_meteo: "Open-Meteo",
  climatologia: "NASA POWER (climatology)",
};

export default function VistaClima({ cultivo: cultivoParam, area: areaParam }: { cultivo?: string; area?: string }) {
  const { tc, idioma, setIdioma, fecha } = useClimaTextos();
  const router = useRouter();
  const cultivo = (CULTIVOS.find((c) => c.id === cultivoParam) ?? CULTIVOS[0]).id;

  const [areas, setAreas] = useState<SerieHumedad[]>([]);
  const [punto, setPunto] = useState<{ lat: number; lon: number } | null>(null);
  const [resultado, setResultado] = useState<{ clave: string; datos: RespuestaClima } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null); // clave de la consulta que falló
  const [intento, setIntento] = useState(0);
  const [grilla, setGrilla] = useState<GrillaClima | null>(null);
  const [errorGrilla, setErrorGrilla] = useState(false);
  const areaId = (areaParam && areas.some((a) => a.id === areaParam) ? areaParam : areas[0]?.id) ?? "";

  const irA = (cambios: { cultivo?: string; area?: string }) => {
    const p = new URLSearchParams({ cultivo, ...(areaId ? { area: areaId } : {}), ...cambios });
    router.replace(`/clima?${p.toString()}`, { scroll: false });
  };

  // Zonas con su serie NISAR (una vez) y grilla del mapa
  useEffect(() => {
    (async () => {
      try {
        const indice: IndiceHumedad = await (await fetch("/data/humedad/index.json")).json();
        setAreas(await Promise.all(indice.zonas.map(async (z) => (await fetch(`/data/humedad/${z.archivo}`)).json())));
      } catch {
        setFallo("zonas");
      }
    })();
    fetch("/api/clima/mapa")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setGrilla)
      .catch(() => setErrorGrilla(true));
  }, []);

  // Clima del punto elegido o del centro de la zona
  const clave = punto ? `${punto.lat},${punto.lon}|${cultivo}` : `${areaId}|${cultivo}`;
  useEffect(() => {
    if (!areaId && !punto) return;
    let vigente = true;
    const q = new URLSearchParams({ cultivo });
    if (punto) {
      q.set("lat", String(punto.lat));
      q.set("lon", String(punto.lon));
    } else q.set("area", areaId);
    fetch(`/api/clima?${q.toString()}`)
      .then(async (r) => (r.ok ? ((await r.json()) as RespuestaClima) : Promise.reject(new Error(String(r.status)))))
      .then((datos) => {
        if (!vigente) return;
        setResultado({ clave, datos });
        setFallo(null);
      })
      .catch(() => vigente && setFallo(clave));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` resume zona, punto y cultivo
  }, [clave, intento]);

  const elegirPunto = useCallback((lat: number, lon: number) => setPunto({ lat, lon }), []);
  const datos = resultado?.datos ?? null;
  const cargando = resultado?.clave !== clave && fallo !== clave;
  const caidas = datos ? (Object.keys(FUENTES_UI) as (keyof typeof FUENTES_UI)[]).filter((f) => !datos.estado_fuentes[f].ok) : [];
  const control = "h-12 rounded-2xl border-2 border-borde bg-fondo px-3 text-base font-bold text-texto";

  return (
    <Marco variante="compacta">
      <div className="space-y-4 px-3 md:px-8">
        {/* Zona, cultivo e idioma */}
        <header className="rounded-3xl border border-borde bg-tarjeta p-4">
          <h1 className="font-display text-3xl font-bold leading-tight">{tc("titulo")}</h1>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm font-bold text-texto-suave">
              {tc("zona")}
              <select
                className={control}
                value={areaId}
                onChange={(e) => {
                  setPunto(null);
                  irA({ area: e.target.value });
                }}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.zona}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm font-bold text-texto-suave">
              {tc("cultivo")}
              <select className={control} value={cultivo} onChange={(e) => irA({ cultivo: e.target.value })}>
                {CULTIVOS.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre[idioma]}</option>
                ))}
              </select>
            </label>
            <div role="group" aria-label={tc("idioma")} className="flex h-12 rounded-2xl border-2 border-borde p-1">
              {(["en", "es"] as Idioma[]).map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={idioma === i}
                  onClick={() => setIdioma(i)}
                  className={`rounded-xl px-4 text-base font-bold uppercase ${idioma === i ? "bg-primario text-sobre-primario" : "text-texto-suave"}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-snug text-texto-suave">{tc("contexto")}</p>
          {datos && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-texto">
              📍{" "}
              {datos.punto.origen === "coordenada"
                ? tc("puntoElegido", { lat: datos.punto.lat.toFixed(2), lon: datos.punto.lon.toFixed(2) })
                : tc("puntoZona", { zona: datos.punto.zona ?? "" })}
              {punto && (
                <button type="button" onClick={() => setPunto(null)} className="rounded-full border border-borde px-3 py-1 text-sm font-bold text-acento">
                  {tc("volverZona")}
                </button>
              )}
            </p>
          )}
        </header>

        {fallo === clave && (
          <div role="alert" className="rounded-3xl border-2 border-peligro bg-tarjeta p-4 text-base font-bold">
            <p>{tc("errorClima")}</p>
            <button type="button" onClick={() => setIntento((v) => v + 1)} className="mt-2 h-11 rounded-full bg-primario px-5 font-bold text-sobre-primario">
              {tc("reintentar")}
            </button>
          </div>
        )}
        {caidas.map((f) => (
          <p key={f} role="status" className="rounded-2xl border border-dorado bg-tarjeta px-4 py-2 text-base">
            ! {tc("fuenteCaida", { fuente: FUENTES_UI[f] })}
          </p>
        ))}

        <div aria-busy={cargando} className={cargando && datos ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {datos ? <Tarjetas datos={datos} /> : fallo !== clave && <p className="rounded-3xl bg-tarjeta p-6 text-center text-lg text-texto-suave">{tc("cargando")}</p>}
        </div>
      </div>

      {/* El mapa ocupa todo el ancho en el celular */}
      <section className="mt-4 md:px-8" aria-label={tc("mapaTitulo")}>
        <MapaClima grilla={grilla} errorGrilla={errorGrilla} areas={areas} areaId={areaId} datos={datos} punto={punto} alElegirPunto={elegirPunto} />
      </section>

      {datos && (
        <div className="mt-4 space-y-4 px-3 md:px-8">
          <DetalleHorario datos={datos} />
          <BalanceHidrico datos={datos} />
          <Perspectiva datos={datos} />

          <section className="rounded-3xl border border-borde bg-tarjeta p-4">
            <h2 className="font-display text-2xl font-bold">{tc("nodosTitulo")}</h2>
            <p className="mt-1 text-base leading-snug">{tc("nodosTexto")}</p>
            {grilla && (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {grilla.nodos.map((nodo) => (
                  <li key={nodo.id} className="rounded-full border border-borde bg-fondo px-3 py-1">
                    {nodo.nombre} <span className="text-texto-suave">({nodo.lat.toFixed(2)}, {nodo.lon.toFixed(2)})</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="rounded-3xl border border-borde bg-tarjeta p-4 text-sm leading-relaxed text-texto-suave">
            <h2 className="text-base font-bold text-texto">{tc("fuentesTitulo")}</h2>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {datos.fuentes.map((f) => (
                <li key={f}>{f}</li>
              ))}
              <li>{tc("fuenteMapa")}</li>
            </ul>
            {datos.estado_fuentes.nasa_power.hasta && <p className="mt-2">{tc("powerHasta", { dia: fecha(datos.estado_fuentes.nasa_power.hasta, true) })}</p>}
            <p className="mt-2 font-bold text-texto">{tc("aviso")}</p>
          </footer>
        </div>
      )}
    </Marco>
  );
}
