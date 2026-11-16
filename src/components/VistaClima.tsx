"use client";
// Pantalla "Clima" de todo Itapúa.
// 1) Lo simple: ahora, hoy, mañana, qué conviene hacer y los próximos días, para el lugar elegido.
// 2) El mapa del clima de todo el departamento (capas, línea de tiempo, viento): tocar el mapa cambia el lugar.
// 3) «Ver más datos»: hora por hora, balance de agua y la campaña (se descargan recién ahí).
// Lugar: una chacra guardada (su ubicación exacta), donde estoy ahora (GPS), un punto tocado en el mapa
// o, si no hay nada de eso, el centro de Itapúa. Ya no hay zonas.
// Datos: GET /api/clima (punto o área "itapua"). Rol Backend: src/lib/clima.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RespuestaClima } from "@/lib/clima/tipos";
import { ITAPUA_ID } from "@/lib/itapua";
import { centroDeChacra, fueraDeItapua, useChacras } from "./chacras";
import ClimaSimple from "./clima/ClimaSimple";
import SeccionMapaClima from "./clima/SeccionMapaClima";
import { useClimaTextos } from "./clima/textos";
import { CULTIVOS } from "./cultivos";
import Icono, { Dibujo, type NombreDibujo } from "./Icono";
import { cieloActual, cieloDeDia, humedadDe, type EstadoCielo } from "./fondo/cielo";
import FondoCultivoScroll from "./FondoCultivoScroll";
import Marco from "./Marco";
import { esCultivo, useCultivoGuardado } from "./preferencias";
import { reintentarUbicacion, textoPrecision, useUbicacion } from "./ubicacion";

const NOMBRE_CIELO: Record<EstadoCielo, { icono: NombreDibujo; es: string; en: string }> = {
  soleado_calor: { icono: "clima-sol", es: "Sol y calor fuerte", en: "Sunny and very hot" },
  despejado: { icono: "clima-sol", es: "Despejado", en: "Clear" },
  parcial_nublado: { icono: "clima-parcial", es: "Parcialmente nublado", en: "Partly cloudy" },
  nublado: { icono: "clima-nube", es: "Nublado", en: "Cloudy" },
  lluvia_suave: { icono: "clima-lluvia", es: "Lluvia", en: "Rain" },
  tormenta: { icono: "clima-tormenta", es: "Tormenta", en: "Storm" },
  helada_frio: { icono: "clima-nube", es: "Frío / riesgo de helada", en: "Cold / frost risk" },
};

// Los datos pesados se descargan recién cuando se piden.
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
/** Para el clima alcanza con una ubicación aproximada (el pronóstico cambia poco en pocos km). SUPUESTO. */
const PRECISION_CLIMA_M = 15_000;

export default function VistaClima({ cultivo: cultivoParam }: { cultivo?: string; /** ya no hay zonas: se ignora */ area?: string }) {
  const { tc, idioma } = useClimaTextos();
  const es = idioma === "es";
  const router = useRouter();
  const { chacras, cargadas } = useChacras();
  const misChacras = chacras.filter((c) => !fueraDeItapua(c));

  /** "chacra:<id>" · "ubicacion" (GPS) · "punto" (tocado en el mapa) · "itapua" (centro) · null = todavía sin elegir */
  const [lugar, setLugar] = useState<string | null>(null);
  const [puntoMapa, setPuntoMapa] = useState<{ lat: number; lon: number } | null>(null);
  const [resultado, setResultado] = useState<{ clave: string; datos: RespuestaClima } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null); // clave de la consulta que falló
  const [intento, setIntento] = useState(0);
  const [avanzado, setAvanzado] = useState(false);
  const refAvanzado = useRef<HTMLDivElement>(null);
  const [cultivoGuardado, guardarCultivo] = useCultivoGuardado();
  /** Momento que muestra el cielo del fondo: "ahora" o un día del pronóstico (AAAA-MM-DD). */
  const [momento, setMomento] = useState<string>("ahora");

  // GPS: solo se enciende si el usuario eligió «Donde estoy ahora» (no se pide permiso al entrar)
  const { ubic, estado: estadoUbic } = useUbicacion(lugar === "ubicacion");
  const ubicSirve = !!ubic && ubic.enItapua && ubic.precision_m <= PRECISION_CLIMA_M;

  // Lugar por defecto: la chacra del cultivo elegido (o la primera); sin chacras, el centro de Itapúa
  const cultivoUrl = esCultivo(cultivoParam) ? cultivoParam : null;
  const cultivoPreferido = cultivoUrl ?? cultivoGuardado;
  const chacraPorDefecto = misChacras.find((c) => c.cultivo === cultivoPreferido) ?? misChacras[0];
  const lugarActual = lugar ?? (cargadas ? (chacraPorDefecto ? `chacra:${chacraPorDefecto.id}` : "itapua") : null);
  const chacra = lugarActual?.startsWith("chacra:") ? misChacras.find((c) => `chacra:${c.id}` === lugarActual) : undefined;
  const cultivo = chacra?.cultivo ?? cultivoPreferido ?? CULTIVOS[0].id;
  useEffect(() => {
    if (cultivoUrl) guardarCultivo(cultivoUrl);
  }, [cultivoUrl, guardarCultivo]);

  const punto = chacra
    ? centroDeChacra(chacra)
    : lugarActual === "punto"
      ? puntoMapa
      : lugarActual === "ubicacion" && ubicSirve
        ? { lat: Number(ubic!.pos[1].toFixed(4)), lon: Number(ubic!.pos[0].toFixed(4)) }
        : null;
  const esperandoUbic = lugarActual === "ubicacion" && !ubicSirve;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
      if (localStorage.getItem(CLAVE_AVANZADO) === "1") setAvanzado(true);
    } catch {}
  }, []);

  // Clima del punto (chacra, GPS o toque en el mapa) o del centro de Itapúa
  const clave = !lugarActual ? "" : punto ? `${punto.lat},${punto.lon}|${cultivo}` : `${ITAPUA_ID}|${cultivo}`;
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    const q = new URLSearchParams({ cultivo });
    if (punto) {
      q.set("lat", String(punto.lat));
      q.set("lon", String(punto.lon));
    } else q.set("area", ITAPUA_ID);
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
  const pedirUbicacion = useCallback(() => {
    setLugar("ubicacion");
    reintentarUbicacion();
  }, []);
  const cambiarLugar = (v: string) => {
    setLugar(v);
    const elegida = v.startsWith("chacra:") ? misChacras.find((c) => `chacra:${c.id}` === v) : undefined;
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
    `flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${activo ? "border-primario bg-primario text-sobre-primario" : "border-borde bg-tarjeta text-texto"}`;

  // Qué decir mientras el GPS no sirve para el clima
  const avisoUbic = !esperandoUbic
    ? null
    : estadoUbic === "denegada"
      ? es ? "La app no tiene permiso para ver tu ubicación. Activalo en los ajustes del navegador." : "The app has no permission to see your location. Enable it in the browser settings."
      : estadoUbic === "sin_soporte" || estadoUbic === "error"
        ? es ? "No se pudo obtener tu ubicación. Mientras tanto se muestra el centro de Itapúa." : "Your location could not be obtained. Showing the centre of Itapúa meanwhile."
        : ubic && !ubic.enItapua
          ? es ? "Estás fuera de Itapúa: se muestra el centro del departamento." : "You are outside Itapúa: showing the centre of the department."
          : ubic
            ? es ? `Tu ubicación es muy aproximada (${textoPrecision(ubic.precision_m)}). Se muestra el centro de Itapúa; tocá el mapa para elegir tu lugar.` : `Your location is very approximate (${textoPrecision(ubic.precision_m)}). Showing the centre of Itapúa; tap the map to pick your place.`
            : es ? "Buscando tu ubicación…" : "Finding your location…";

  return (
    <Marco variante="compacta" cultivo={cultivo} fondo={fondo}>
      <div className="space-y-4 px-3 md:px-8">
        <header className="sobre-fondo rounded-2xl p-4">
          <h1 className="font-display text-3xl font-bold leading-tight">{es ? "El clima en Itapúa" : "Weather in Itapúa"}</h1>
          <label className="mt-2 flex flex-col gap-1 text-sm font-bold text-texto-suave">
            {es ? "¿Dónde?" : "Where?"}
            <select className={control} value={lugarActual ?? ""} onChange={(e) => (e.target.value === "ubicacion" ? pedirUbicacion() : cambiarLugar(e.target.value))}>
              {misChacras.length > 0 && (
                <optgroup label={es ? "Mis chacras" : "My fields"}>
                  {misChacras.map((c) => (
                    <option key={c.id} value={`chacra:${c.id}`}>{c.nombre}</option>
                  ))}
                </optgroup>
              )}
              <option value="ubicacion">{es ? "Donde estoy ahora" : "Where I am now"}</option>
              <option value="itapua">{es ? "Itapúa (centro del departamento)" : "Itapúa (centre of the department)"}</option>
              {puntoMapa && (
                <option value="punto">
                  {es ? "Punto que toqué en el mapa" : "Point I tapped on the map"} ({puntoMapa.lat.toFixed(2)}, {puntoMapa.lon.toFixed(2)})
                </option>
              )}
            </select>
          </label>
          {avisoUbic && <p role="status" className="mt-2 rounded-lg bg-dorado/25 px-3 py-2 text-sm font-bold leading-snug">{avisoUbic}</p>}
          {!chacra && (
            <label className="mt-2 flex flex-col gap-1 text-sm font-bold text-texto-suave">
              {tc("cultivo")}
              <select
                className={control}
                value={cultivo}
                onChange={(e) => {
                  if (esCultivo(e.target.value)) guardarCultivo(e.target.value);
                  router.replace(`/clima?${new URLSearchParams({ cultivo: e.target.value }).toString()}`, { scroll: false });
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
      </div>

      {/* Mapa del clima de todo Itapúa: ocupa todo el ancho en el celular */}
      <div className="mt-4">
        <SeccionMapaClima datos={datos} punto={punto} alElegirPunto={elegirPunto} alPedirUbicacion={pedirUbicacion} />
      </div>

      <div className="mt-4 space-y-4 px-3 md:px-8">
        {datos && dias.length > 0 && (
          <div className="sobre-fondo rounded-xl px-3 py-2">
            <p className="text-sm font-bold text-texto-suave" id="cielo-fondo">
              {es ? "Cielo del fondo" : "Background sky"}: <Dibujo nombre={NOMBRE_CIELO[cielo].icono} className="h-6 w-6 align-[-6px]" /> {NOMBRE_CIELO[cielo][idioma]}
            </p>
            <div role="radiogroup" aria-labelledby="cielo-fondo" className="slider-sin-barra mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
              <button type="button" role="radio" aria-checked={momento === "ahora"} onClick={() => setMomento("ahora")} className={chip(momento === "ahora")}>
                {es ? "Ahora" : "Now"}
              </button>
              {dias.map((d, i) => (
                <button key={d.fecha} type="button" role="radio" aria-checked={momento === d.fecha} onClick={() => setMomento(d.fecha)} className={chip(momento === d.fecha)}>
                  <Dibujo nombre={NOMBRE_CIELO[cieloDeDia(d)].icono} className="h-6 w-6" /> {nombreDia(d.fecha, i)}
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
              <Icono nombre={avanzado ? "arriba" : "abajo"} />
              {avanzado
                ? es ? "Ocultar los datos avanzados" : "Hide advanced data"
                : es ? "Ver más datos: hora por hora, balance de agua y campaña" : "More data: hour by hour, water balance and season"}
            </button>
            <p className="sobre-fondo rounded-xl px-4 py-2 text-sm leading-snug text-texto-suave">
              {es
                ? "Pronóstico: Open-Meteo (modelo; no es dato de NASA). Lluvia de los últimos días: NASA POWER. Agua del suelo: radar NISAR (NASA-ISRO)."
                : "Forecast: Open-Meteo (model; not NASA data). Recent rain: NASA POWER. Soil water: NISAR radar (NASA-ISRO)."}
            </p>
          </>
        )}
      </div>

      <div ref={refAvanzado} className="mt-4 scroll-mt-20">
        {avanzado && datos && <ClimaAvanzado datos={datos} />}
      </div>
    </Marco>
  );
}
