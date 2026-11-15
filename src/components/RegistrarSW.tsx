"use client";
// Registra el service worker (public/sw.js) para que la app funcione sin internet.
// Solo en producción: en desarrollo guardaría versiones viejas del código.
import { useEffect } from "react";

export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
