"use client";
// Chacras del agricultor, guardadas EN EL TELÉFONO (localStorage): funcionan sin internet.
// Cada chacra guarda también su último resultado, así "Mis chacras" muestra el estado aunque no haya señal.
// Si más adelante se suma Supabase (respaldo / varios teléfonos), solo cambia este archivo:
// leer() / escribir() pasan a sincronizar con la base, el resto de la app no se entera.
import { useCallback, useEffect, useState } from "react";
import type { PuntoSerie } from "@/types/contratos";
import type { Analisis, LonLat } from "./suelo/api";

export interface ResultadoGuardado {
  consultado: string; // ISO de cuándo se pidió al servidor
  analisis: Analisis;
  serie?: PuntoSerie[];
}

export interface Chacra {
  id: string;
  nombre: string;
  color: string; // distintivo en el mapa y en la lista
  cultivo: "soja" | "maiz" | "mandioca";
  vertices: LonLat[];
  creada: string;
  resultado?: ResultadoGuardado;
  claveResultado?: string; // para saber si el resultado corresponde a la forma y cultivo actuales
}

const CLAVE = "agrosar.chacras.v1";
const CLAVE_VIEJA = "agrosar.chacra"; // versión anterior: una sola chacra
const EVENTO = "agrosar:chacras";

// Colores distintivos: fuertes y fáciles de distinguir sobre la vista aérea
export const COLORES_CHACRA = ["#ffd400", "#ff5fa2", "#00e5ff", "#ff8a00", "#b388ff", "#76ff03"];

export const claveDe = (c: Pick<Chacra, "vertices" | "cultivo">) => `${JSON.stringify(c.vertices)}|${c.cultivo}`;

function leer(): Chacra[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (Array.isArray(v)) return v;
    // Migrar la chacra única de la versión anterior
    const vieja = JSON.parse(localStorage.getItem(CLAVE_VIEJA) ?? "null");
    if (Array.isArray(vieja) && vieja.length >= 3) {
      const lista: Chacra[] = [
        { id: nuevoId(), nombre: "Chacra 1", color: COLORES_CHACRA[0], cultivo: "soja", vertices: vieja, creada: new Date().toISOString() },
      ];
      localStorage.setItem(CLAVE, JSON.stringify(lista));
      localStorage.removeItem(CLAVE_VIEJA);
      return lista;
    }
  } catch {}
  return [];
}

function escribir(lista: Chacra[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

function nuevoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Lista de chacras guardadas y acciones. Se mantiene sincronizada entre pantallas y pestañas. */
export function useChacras() {
  const [chacras, setChacras] = useState<Chacra[]>([]);
  const [cargadas, setCargadas] = useState(false);

  useEffect(() => {
    const actualizar = () => {
      setChacras(leer());
      setCargadas(true);
    };
    actualizar();
    window.addEventListener(EVENTO, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  const agregar = useCallback((vertices: LonLat[], cultivo: Chacra["cultivo"]): Chacra => {
    const lista = leer();
    const usados = new Set(lista.map((c) => c.color));
    const nueva: Chacra = {
      id: nuevoId(),
      nombre: `Chacra ${lista.length + 1}`,
      color: COLORES_CHACRA.find((c) => !usados.has(c)) ?? COLORES_CHACRA[lista.length % COLORES_CHACRA.length],
      cultivo,
      vertices,
      creada: new Date().toISOString(),
    };
    escribir([...lista, nueva]);
    return nueva;
  }, []);

  const actualizar = useCallback((id: string, cambios: Partial<Omit<Chacra, "id">>) => {
    escribir(leer().map((c) => (c.id === id ? { ...c, ...cambios } : c)));
  }, []);

  const borrar = useCallback((id: string) => {
    escribir(leer().filter((c) => c.id !== id));
  }, []);

  return { chacras, cargadas, agregar, actualizar, borrar };
}

// ---------- Última ubicación conocida (para abrir el mapa ahí aunque el GPS tarde) ----------
const CLAVE_UBIC = "agrosar.ubicacion";
export function leerUltimaUbicacion(): LonLat | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_UBIC) ?? "null");
    return Array.isArray(v) && v.length === 2 ? (v as LonLat) : null;
  } catch {
    return null;
  }
}
export function guardarUbicacion(p: LonLat) {
  try {
    localStorage.setItem(CLAVE_UBIC, JSON.stringify(p));
  } catch {}
}

// ---------- Conexión ----------
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const act = () => setEnLinea(navigator.onLine);
    act();
    window.addEventListener("online", act);
    window.addEventListener("offline", act);
    return () => {
      window.removeEventListener("online", act);
      window.removeEventListener("offline", act);
    };
  }, []);
  return enLinea;
}
