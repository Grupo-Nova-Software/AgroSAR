"use client";
// Pantalla "Clima". Primero lo simple: ahora, hoy, mañana, qué conviene hacer y los próximos días.
// El botón «Ver datos avanzados» abre el mapa del clima, hora por hora, balance de agua y la campaña.
// Se puede ver el clima de cada chacra guardada (en su ubicación exacta) o de una zona.
// Datos: GET /api/clima (punto o zona). Rol Backend: src/lib/clima.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IndiceHumedad, SerieHumedad } from "@/types/contratos";
import type { RespuestaClima } from "@/lib/clima/tipos";
import { useChacras } from "./chacras";
import ClimaSimple from "./clima/ClimaSimple";
import { useClimaTextos } from "./clima/textos";
import { CULTIVOS } from "./cultivos";
import Icono, { Dibujo, type NombreDibujo } from "./Icono";
import { cieloActual, cieloDeDia, humedadDe, type EstadoCielo } from "./fondo/cielo";
import FondoCultivoScroll from "./FondoCultivoScroll";
import Marco from "./Marco";
import { esCultivo, useCultivoGuardado, useZonaGuardada } from "./preferencias";

const NOMBRE_CIELO: Record<EstadoCielo, { icono: NombreDibujo; es: string; en: string }> = {
  soleado_calor: { icono: "clima-sol", es: "Sol y calor fuerte", en: "Sunny and very hot" },
  despejado: { icono: "clima-sol", es: "Despejado", en: "Clear" },
  parcial_nublado: { icono: "clima-parcial", es: "Parcialmente nublado", en: "Partly cloudy" },
  nublado: { icono: "clima-nube", es: "Nublado", en: "Cloudy" },
  lluvia_suave: { icono: "clima-lluvia", es: "Lluvia", en: "Rain" },
  tormenta: { icono: "clima-tormenta", es: "Tormenta", en: "Storm" },
  helada_frio: { icono: "clima-nube", es: "Frío / riesgo de helada", en: "Cold / frost risk" },
};

// Lo avanzado (mapa incluido) se descarga recién cuando se pide.
const ClimaAvanzado = dynamic(() => import("./clima/ClimaAvanzado"), {
  ssr: false,
  loading: () => <div className="mx-3 h-64 animate-pulse rounded-2xl bg-tarjeta-2 md:mx-8" />,
});

const FUENTES_UI: Record<"nasa_power" | "open_meteo" | "climatologia", string> = {
  nasa_power: "NASA POWER",
  open_meteo: "Open-Meteo",
  climatologia: "NASA POWER (climatology)",
};
const CLAVE_AVANZADO = "agrosar.clima.avanzado";

export default function VistaClima({ cultivo: cultivoParam, area: areaParam }: { cultivo?: string; area?: string }) {
  const { tc, idioma } = useClimaTextos();
  const es = idioma === "es";
  const router = useRouter();
  const { chacras, cargadas } = useChacras();

  const [areas, setAreas] = useState<SerieHumedad[]>([]);
  /** "chacra:<id>" · "zona:<id>" · "punto" (tocado en el mapa avanzado) · null = todavía sin elegir */
  const [lugar, setLugar] = useState<string | null>(areaParam ? `zona:${areaParam}` : null);
  const [puntoMapa, setPuntoMapa] = useState<{ lat: number; lon: number } | null>(null);
  const [resultado, setResultado] = useState<{ clave: string; datos: RespuestaClima } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null); // clave de la consulta que falló
  const [intento, setIntento] = useState(0);
  const [avanzado, setAvanzado] = useState(false);
  const refAvanzado = useRef<HTMLDivElement>(null);
  // Cultivo y zona compartidos con Inicio y Mi suelo
  const [cultivoGuardado, guardarCultivo] = useCultivoGuardado();
  const [zonaGuardada, guardarZona] = useZonaGuardada();
  /** Momento que muestra el cielo del fondo: "ahora" o un día del pronóstico (AAAA-MM-DD). */
  const [momento, setMomento] = useState<string>("ahora");

  // Lugar por defecto: la última zona elegida; si no hay, la primera chacra guardada; si no, la primera zona
  const zonaPrevia = zonaGuardada && areas.some((a) => a.id === zonaGuardada) ? `zona:${zonaGuardada}` : null;
  const lugarActual = lugar ?? (cargadas ? (zonaPrevia ?? (chacras[0] ? `chacra:${chacras[0].id}` : areas[0] ? `zona:${areas[0].id}` : null)) : null);
  const chacra = lugarActual?.startsWith("chacra:") ? chacras.find((c) => `chacra:${c.id}` === lugarActual) : undefined;
  const zonaElegida = lugarActual?.startsWith("zona:") ? lugarActual.slice(5) : "";
  const areaId = (areas.some((a) => a.id === zonaElegida) ? zonaElegida : areas[0]?.id) ?? "";
  const cultivoUrl = esCultivo(cultivoParam) ? cultivoParam : null;
  const cultivo = chacra?.cultivo ?? cultivoUrl ?? cultivoGuardado ?? CULTIVOS[0].id;
  useEffect(() => {
    if (cultivoUrl) guardarCultivo(cultivoUrl);
  }, [cultivoUrl, guardarCultivo]);
  const punto = chacra
    ? {
        lat: Number((chacra.vertices.reduce((s, v) => s + v[1], 0) / chacra.vertices.length).toFixed(4)),
        lon: Number((chacra.vertices.reduce((s, v) => s + v[0], 0) / chacra.vertices.length).toFixed(4)),
      }
    : lugarActual === "punto"
      ? puntoMapa
      : null;

  useEffect(() => {
    (async () => {
      try {
        const indice: IndiceHumedad = await (await fetch("/data/humedad/index.json")).json();
        setAreas(await Promise.all(indice.zonas.map(async (z) => (await fetch(`/data/humedad/${z.archivo}`)).json())));
      } catch {
        setFallo("zonas");
      }
    })();
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
      if (localStorage.getItem(CLAVE_AVANZADO) === "1") setAvanzado(true);
    } catch {}
  }, []);

  // Clima del punto (chacra o toque en el mapa) o del centro de la zona
  const clave = !lugarActual ? "" : punto ? `${punto.lat},${punto.lon}|${cultivo}` : areaId ? `${areaId}|${cultivo}` : "";
  useEffect(() => {
    if (!clave) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` resume lugar y cultivo
  }, [clave, intento]);

  const elegirPunto = useCallback((lat: number, lon: number) => {
    setPuntoMapa({ lat, lon });
    setLugar("punto");
  }, []);
  const cambiarLugar = (v: string) => {
    setLugar(v);
    if (v.startsWith("zona:")) {
      guardarZona(v.slice(5));
      router.replace(`/clima?${new URLSearchParams({ cultivo, area: v.slice(5) }).toString()}`, { scroll: false });
    }
    const elegida = v.startsWith("chacra:") ? chacras.find((c) => `chacra:${c.id}` === v) : undefined;
    if (elegida && esCultivo(elegida.cultivo)) guardarCultivo(elegida.cultivo);
  };
  const alternarAvanzado = () => {
    const nuevo = !avanzado;
    setAvanzado(nuevo);
    try {
      localStorage.setItem(CLAVE_AVANZADO, nuevo ? "1" : "0");
    } catch {}
    if (nuevo) window.setTimeout(() => refAvanzado.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const datos = resultado?.datos ?? null;
  const cargando = !!clave && resultado?.clave !== clave && fallo !== clave;
  const caidas = datos ? (Object.keys(FUENTES_UI) as (keyof typeof FUENTES_UI)[]).filter((f) => !datos.estado_fuentes[f].ok) : [];
  const control = "h-12 w-full rounded-xl border border-borde bg-tarjeta px-3 text-base font-bold text-texto";
  // Fondo "Del cielo a la raíz": el cielo del momento elegido (ahora o un día del pronóstico) y halos de agua
  // si la última pasada NISAR dice que el suelo está bien de agua. Sin datos todavía: despejado y sin halos.
  const dias = datos?.diario.slice(0, 7) ?? [];
  const diaElegido = momento === "ahora" ? undefined : dias.find((d) => d.fecha === momento);
  const cielo: EstadoCielo = (diaElegido ? cieloDeDia(diaElegido) : cieloActual(datos)) ?? "despejado";
  const fondo = <FondoCultivoScroll cultivoActivo={esCultivo(cultivo) ? cultivo : "soja"} cielo={cielo} humedad={humedadDe(datos)} />;
  const nombreDia = (fecha: string, i: number) =>
    i === 0
      ? es ? "Hoy" : "Today"
      : i === 1
        ? es ? "Mañana" : "Tomorrow"
        : new Date(`${fecha}T12:00:00`).toLocaleDateString(es ? "es-PY" : "en-US", { weekday: "short", day: "numeric" });
  const chip = (activo: boolean) =>
    `min-h-11 shrink-0 rounded-full border-2 px-3 text-sm font-bold ${activo ? "border-primario bg-primario text-sobre-primario" : "border-borde bg-fondo text-texto"}`;

  return (
    <Marco variante="compacta" cultivo={cultivo} fondo={fondo}>
      <div className="space-y-4 px-3 md:px-8">
        <header className="sobre-fondo rounded-3xl p-4">
          <h1 className="font-display text-3xl font-bold leading-tight">{es ? "El clima en tu chacra" : "Weather on your field"}</h1>
          <label className="mt-2 flex flex-col gap-1 text-sm font-bold text-texto-suave">
            {es ? "¿Dónde?" : "Where?"}
            <select className={control} value={lugarActual ?? ""} onChange={(e) => cambiarLugar(e.target.value)}>
              {chacras.length > 0 && (
                <optgroup label={es ? "Mis chacras" : "My fields"}>
                  {chacras.map((c) => (
                    <option key={c.id} value={`chacra:${c.id}`}>{c.nombre}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={es ? "Zonas" : "Zones"}>
                {areas.map((a) => (
                  <option key={a.id} value={`zona:${a.id}`}>{a.zona}</option>
                ))}
              </optgroup>
              {puntoMapa && <option value="punto">{es ? "Punto elegido en el mapa" : "Point picked on the map"}</option>}
            </select>
          </label>
          {!chacra && (
            <label className="mt-2 flex flex-col gap-1 text-sm font-bold text-texto-suave">
              {tc("cultivo")}
              <select
                className={control}
                value={cultivo}
                onChange={(e) => {
                  if (esCultivo(e.target.value)) guardarCultivo(e.target.value);
                  router.replace(`/clima?${new URLSearchParams({ cultivo: e.target.value, ...(areaId ? { area: areaId } : {}) }).toString()}`, { scroll: false });
                }}
              >
                {CULTIVOS.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre[idioma]}</option>
                ))}
              </select>
            </label>
          )}
        </header>

        {fallo === clave && clave && (
          <div role="alert" className="rounded-2xl border-2 border-peligro bg-tarjeta p-4 text-base font-bold">
            <p>{tc("errorClima")}</p>
            <button type="button" onClick={() => setIntento((v) => v + 1)} className="mt-2 h-12 rounded-full bg-primario px-5 font-bold text-sobre-primario">
              {tc("reintentar")}
            </button>
          </div>
        )}
        {caidas.map((f) => (
          <p key={f} role="status" className="rounded-xl border border-dorado bg-tarjeta px-4 py-2 text-base">
            ! {tc("fuenteCaida", { fuente: FUENTES_UI[f] })}
          </p>
        ))}

        <div aria-busy={cargando} className={cargando && datos ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {datos ? <ClimaSimple datos={datos} /> : fallo !== clave && <p className="rounded-2xl bg-tarjeta p-6 text-center text-lg text-texto-suave">{tc("cargando")}</p>}
        </div>

        {datos && dias.length > 0 && (
          <div className="sobre-fondo rounded-2xl px-3 py-2">
            <p className="text-sm font-bold text-texto-suave" id="cielo-fondo">
              {es ? "Cielo del fondo" : "Background sky"}: <Dibujo nombre={NOMBRE_CIELO[cielo].icono} className="h-6 w-6 align-[-6px]" /> {NOMBRE_CIELO[cielo][idioma]}
            </p>
            <div role="radiogroup" aria-labelledby="cielo-fondo" className="slider-sin-barra mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
              <button type="button" role="radio" aria-checked={momento === "ahora"} onClick={() => setMomento("ahora")} className={chip(momento === "ahora")}>
                {es ? "Ahora" : "Now"}
              </button>
              {dias.map((d, i) => (
                <button key={d.fecha} type="button" role="radio" aria-checked={momento === d.fecha} onClick={() => setMomento(d.fecha)} className={chip(momento === d.fecha)}>
                  <span aria-hidden>{NOMBRE_CIELO[cieloDeDia(d)].icono}</span> {nombreDia(d.fecha, i)}
                </button>
              ))}
            </div>
          </div>
        )}

        {datos && (
          <>
            <button
              type="button"
              onClick={alternarAvanzado}
              aria-expanded={avanzado}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-borde bg-tarjeta px-4 text-base font-bold text-acento shadow-suave"
            >
              <Icono nombre={avanzado ? "arriba" : "mapa"} />
              {avanzado ? (es ? "Ocultar datos avanzados" : "Hide advanced data") : es ? "Ver datos avanzados y mapa del clima" : "Show advanced data and weather map"}
            </button>
            <p className="sobre-fondo rounded-2xl px-4 py-2 text-sm leading-snug text-texto-suave">
              {es
                ? "Pronóstico: Open-Meteo (modelo; no es dato de NASA). Lluvia de los últimos días: NASA POWER. Agua del suelo: radar NISAR (NASA-ISRO)."
                : "Forecast: Open-Meteo (model; not NASA data). Recent rain: NASA POWER. Soil water: NISAR radar (NASA-ISRO)."}
            </p>
          </>
        )}
      </div>

      <div ref={refAvanzado} className="mt-4 scroll-mt-20">
        {avanzado && datos && <ClimaAvanzado datos={datos} areas={areas} areaId={areaId} punto={punto} alElegirPunto={elegirPunto} />}
      </div>
    </Marco>
  );
}
