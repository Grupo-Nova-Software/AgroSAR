"use client";
// Mantiene al día el resultado de cada chacra: si hay internet y el resultado guardado no corresponde a la forma
// y el cultivo actuales (o tiene más de 6 horas), lo pide a /api/lote y lo guarda en el teléfono junto a la chacra.
// Sin internet no hace nada: la app muestra lo último guardado.
import { useEffect, useRef, useState } from "react";
import { claveDe, useEnLinea, type Chacra } from "../chacras";
import { analizarLote } from "./api";

const VIGENCIA_MS = 6 * 3_600_000;

export function useResultados(chacras: Chacra[], actualizar: (id: string, cambios: Partial<Chacra>) => void) {
  const enLinea = useEnLinea();
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const enCurso = useRef(new Set<string>());

  useEffect(() => {
    if (!enLinea) return;
    const ahora = Date.now();
    const vencidas = chacras.filter((c) => {
      const clave = claveDe(c);
      const vieja = !c.resultado || ahora - new Date(c.resultado.consultado).getTime() > VIGENCIA_MS;
      return (c.claveResultado !== clave || vieja) && !enCurso.current.has(clave);
    });
    for (const c of vencidas) {
      const clave = claveDe(c);
      enCurso.current.add(clave);
      setPendientes((p) => new Set(p).add(c.id));
      analizarLote({ type: "Polygon", coordinates: [[...c.vertices, c.vertices[0]]] }, c.cultivo)
        .then((r) =>
          actualizar(c.id, {
            resultado: { consultado: new Date().toISOString(), analisis: r.analisis, serie: r.serie },
            claveResultado: clave,
          }),
        )
        .catch(() => {})
        .finally(() => {
          enCurso.current.delete(clave);
          setPendientes((p) => {
            const n = new Set(p);
            n.delete(c.id);
            return n;
          });
        });
    }
  }, [chacras, enLinea, actualizar]);

  return { pendientes, enLinea };
}
