"use client";
// Datos propios de una chacra: nombre, color distintivo, qué se siembra y borrar.
import Image from "next/image";
import { useState } from "react";
import { COLORES_CHACRA, type Chacra } from "../chacras";
import { CULTIVOS } from "../cultivos";
import Icono from "../Icono";
import { useIdioma } from "../idioma";

export default function EditorChacra({
  chacra,
  alCambiar,
  alBorrar,
}: {
  chacra: Chacra;
  alCambiar: (cambios: Partial<Chacra>) => void;
  alBorrar: () => void;
}) {
  const { t, tr } = useIdioma();
  const [nombre, setNombre] = useState(chacra.nombre);

  const guardarNombre = () => {
    const limpio = nombre.trim().slice(0, 40);
    if (limpio && limpio !== chacra.nombre) alCambiar({ nombre: limpio });
    else if (!limpio) setNombre(chacra.nombre);
  };
  const rotulo = "text-sm font-bold text-texto-suave";

  return (
    <details className="group mt-3 rounded-xl bg-tarjeta-2">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3.5 text-base font-bold text-acento [&::-webkit-details-marker]:hidden">
        <Icono nombre="lapiz" />
        {t("editarChacra")}
        <Icono nombre="arriba" className="ml-auto h-5 w-5 rotate-180 transition-transform group-open:rotate-0" />
      </summary>

      <div className="space-y-4 px-3.5 pb-3.5 pt-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarNombre();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <label className={rotulo} htmlFor={`nombre-${chacra.id}`}>
            {t("nombreChacra")}
          </label>
          <input
            id={`nombre-${chacra.id}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            maxLength={40}
            enterKeyHint="done"
            className="mt-1 h-12 w-full rounded-lg border border-borde bg-tarjeta px-3 text-lg font-bold text-texto focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/30"
          />
        </form>

        <div>
          <p className={rotulo}>{t("colorChacra")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2.5" role="radiogroup" aria-label={t("colorChacra")}>
            {COLORES_CHACRA.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={chacra.color === c}
                aria-label={c}
                onClick={() => alCambiar({ color: c })}
                className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-tarjeta-2 ${chacra.color === c ? "ring-2 ring-texto" : ""}`}
                style={{ background: c, boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,.18)" }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className={rotulo}>{t("queSiembra")}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {CULTIVOS.map((c) => {
              const sel = c.id === chacra.cultivo;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => alCambiar({ cultivo: c.id })}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-[15px] font-bold ${
                    sel ? "border-primario bg-primario text-sobre-primario" : "border-borde bg-tarjeta text-texto"
                  }`}
                >
                  <Image src={c.imagen} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
                  {tr(c.nombre)}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (window.confirm(t("confirmarBorrar", { nombre: chacra.nombre }))) alBorrar();
          }}
          className="flex min-h-11 items-center gap-2 text-base font-bold text-peligro"
        >
          <Icono nombre="basura" />
          {t("borrarChacra")}
        </button>
      </div>
    </details>
  );
}
