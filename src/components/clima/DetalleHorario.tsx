"use client";
// Hora por hora (48 h): temperatura, lluvia, viento y si se puede pulverizar. Se desliza hacia el costado.
// Es una tabla de verdad (filas y columnas con encabezados), así la lee también un lector de pantalla.
import type { RespuestaClima } from "@/lib/clima/tipos";
import { useClimaTextos } from "./textos";

export default function DetalleHorario({ datos }: { datos: RespuestaClima }) {
  const { tc, n, diaCorto, rumbo } = useClimaTextos();
  const horas = datos.horario;
  if (!horas.length) return null;

  const temps = horas.map((h) => h.temp_c).filter((v): v is number => typeof v === "number");
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const mmMax = Math.max(1, ...horas.map((h) => h.mm ?? 0));
  // Máxima y mínima de cada día, para rotularlas
  const extremos = new Map<string, "max" | "min">();
  for (const dia of new Set(horas.map((h) => h.t.slice(0, 10)))) {
    const delDia = horas.filter((h) => h.t.startsWith(dia) && typeof h.temp_c === "number");
    if (delDia.length < 6) continue;
    extremos.set(delDia.reduce((a, b) => (b.temp_c! > a.temp_c! ? b : a)).t, "max");
    extremos.set(delDia.reduce((a, b) => (b.temp_c! < a.temp_c! ? b : a)).t, "min");
  }
  const regla = datos.pulverizacion?.regla;
  const celda = "min-w-[3.25rem] px-1 text-center align-bottom";
  const cabeza = "sticky left-0 z-10 bg-tarjeta pr-2 text-left text-sm font-bold text-texto-suave";

  return (
    <section className="rounded-2xl border border-borde bg-tarjeta p-4">
      <h2 className="font-display text-2xl font-bold">{tc("horasTitulo")}</h2>
      <p className="text-base text-texto-suave">{tc("horasSub")}</p>
      <div className="slider-sin-barra relative mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={tc("horasTitulo")}>
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={cabeza} />
              {horas.map((h, i) => {
                const nuevoDia = i === 0 || h.t.slice(11, 13) === "00";
                return (
                  <th key={h.t} scope="col" className={`${celda} pb-1 font-bold ${nuevoDia ? "border-l-2 border-borde" : ""}`}>
                    <span className="block h-4 whitespace-nowrap text-xs text-acento">{nuevoDia ? diaCorto(h.t) : ""}</span>
                    {h.t.slice(11, 13)} h
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={cabeza}>{tc("filaTemp")}</th>
              {horas.map((h) => {
                const ext = extremos.get(h.t);
                const alto = typeof h.temp_c === "number" ? 14 + ((h.temp_c - tMin) / Math.max(1, tMax - tMin)) * 34 : 14;
                return (
                  <td key={h.t} className={celda}>
                    <span className="block h-4 text-[11px] font-bold text-texto-suave">{ext ? tc(ext) : ""}</span>
                    <span className="flex h-14 items-end justify-center">
                      <span className="w-1.5 rounded-t" style={{ height: alto, background: ext === "max" ? "var(--peligro)" : ext === "min" ? "var(--agua-mojado)" : "var(--dorado)" }} />
                    </span>
                    <span className={ext ? "font-bold" : ""}>{n(h.temp_c, 0)}°</span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className={cabeza}>{tc("filaLluvia")}</th>
              {horas.map((h) => {
                const mm = h.mm ?? 0;
                return (
                  <td key={h.t} className={`${celda} pt-2`} title={typeof h.prob_pct === "number" ? tc("probabilidad", { p: h.prob_pct }) : undefined}>
                    <span className="flex h-9 items-end justify-center">
                      {mm >= 0.1 && <span className="w-4 rounded-t" style={{ height: Math.max(4, (mm / mmMax) * 36), background: "var(--agua-mojado)" }} />}
                    </span>
                    <span className={mm >= 0.1 ? "font-bold" : "text-texto-suave"}>{mm >= 0.1 ? n(mm, 1) : "0"}</span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className={cabeza}>{tc("filaViento")}</th>
              {horas.map((h) => (
                <td key={h.t} className={`${celda} pt-2`} title={typeof h.rafaga_kmh === "number" ? tc("rafagas", { v: n(h.rafaga_kmh, 0) }) : undefined}>
                  {n(h.viento_kmh, 0)}
                  <span className="block text-[11px] text-texto-suave">{rumbo(h.dir_grados)}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={cabeza}>{tc("filaPulv")}</th>
              {horas.map((h) => (
                <td key={h.t} className={`${celda} pt-2`} title={h.motivos.map((m) => tc(`motivo_${m}`)).join(", ") || undefined}>
                  <span
                    className={`mx-auto grid h-7 w-7 place-items-center rounded-full border-2 text-sm font-bold ${
                      h.pulverizar ? "border-primario bg-primario text-sobre-primario" : "border-borde text-texto-suave"
                    }`}
                  >
                    <span aria-hidden>{h.pulverizar ? "✓" : "✕"}</span>
                    <span className="sr-only">{h.pulverizar ? tc("apta") : `${tc("noApta")}: ${h.motivos.map((m) => tc(`motivo_${m}`)).join(", ")}`}</span>
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {regla && (
        <p className="mt-3 text-sm leading-snug text-texto-suave">
          {tc("reglaPulv", { v1: regla.viento_min_kmh, v2: regla.viento_max_kmh, t: regla.temp_max_c, h: regla.hr_min_pct })}
        </p>
      )}
    </section>
  );
}
