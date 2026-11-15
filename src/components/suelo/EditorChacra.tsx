"use client";
// Datos propios de una chacra: nombre, color distintivo, qué se siembra y borrar.
import Image from "next/image";
import { useState } from "react";
import { COLORES_CHACRA, type Chacra } from "../chacras";
import { CULTIVOS } from "../cultivos";
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
  const [editando, setEditando] = useState(false);

  const guardarNombre = () => {
    const limpio = nombre.trim().slice(0, 40);
    if (limpio) alCambiar({ nombre: limpio });
    else setNombre(chacra.nombre);
    setEditando(false);
  };

  return (
    <div className="mt-3 space-y-3">
      {editando ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarNombre();
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor={`nombre-${chacra.id}`}>
            {t("nombreChacra")}
          </label>
          <input
            id={`nombre-${chacra.id}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            maxLength={40}
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-primario bg-fondo px-3 text-lg font-bold text-texto"
          />
          <button type="submit" className="h-12 rounded-xl bg-primario px-4 text-base font-bold text-sobre-primario">
            ✓ {t("guardar")}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="text-base font-bold text-acento underline underline-offset-4">
          ✏️ {t("renombrar")}
        </button>
      )}

      {/* Color distintivo */}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
        {COLORES_CHACRA.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={chacra.color === c}
            aria-label={c}
            onClick={() => alCambiar({ color: c })}
            className={`h-9 w-9 rounded-full border-[3px] ${chacra.color === c ? "border-texto" : "border-transparent"}`}
            style={{ background: c, boxShadow: "inset 0 0 0 2px rgba(0,0,0,.15)" }}
          />
        ))}
      </div>

      {/* Qué se siembra acá */}
      <div>
        <p className="text-base font-bold text-texto-suave">{t("queSiembra")}</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {CULTIVOS.map((c) => {
            const sel = c.id === chacra.cultivo;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={sel}
                onClick={() => alCambiar({ cultivo: c.id })}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-base font-bold ${
                  sel ? "border-primario bg-tarjeta-2 text-acento" : "border-borde bg-fondo text-texto"
                }`}
              >
                <Image src={c.imagen} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
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
        className="text-base font-bold text-peligro underline underline-offset-4"
      >
        🗑️ {t("borrarChacra")}
      </button>
    </div>
  );
}
