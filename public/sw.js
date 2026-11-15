/* AgroSAR — service worker: que la app funcione en el campo sin señal.
 * - Pantallas: primero la red; sin red, la última copia guardada.
 * - Archivos de la app (JS, CSS, fuentes, fotos): se guardan la primera vez y se usan desde el teléfono.
 * - Datos NISAR (/data/...): se usa lo guardado y se actualiza en segundo plano.
 * - Respuestas de la API (GET): primero la red; sin red, la última respuesta guardada.
 * - Mapa (vista aérea Esri, nombres, calles OSM): las partes ya vistas quedan guardadas (con tope).
 * Las chacras y su último resultado se guardan aparte, en localStorage (src/components/chacras.ts).
 */
const VERSION = "agrosar-v1";
const APP = `${VERSION}-app`;
const PAGINAS = `${VERSION}-paginas`;
const DATOS = `${VERSION}-datos`;
const API = `${VERSION}-api`;
const MAPA = `${VERSION}-mapa`;
const MAX_TESELAS = 2500;

const PRECARGA = ["/", "/suelo", "/chacras", "/ayuda", "/clima", "/data/humedad/index.json", "/data/mapa_humedad/index.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(PAGINAS)
      .then((c) => Promise.allSettled(PRECARGA.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const esTesela = (u) => /(^|\.)arcgisonline\.com$/.test(u.hostname) || u.hostname === "tile.openstreetmap.org";

async function redPrimero(req, cache, { ignorarQuery = false, respaldo } = {}) {
  const c = await caches.open(cache);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const guardada = (await c.match(req)) || (ignorarQuery && (await c.match(req, { ignoreSearch: true })));
    if (guardada) return guardada;
    if (respaldo) {
      const r = await c.match(respaldo);
      if (r) return r;
    }
    throw err;
  }
}

async function guardadoPrimero(req, cache, maximo) {
  const c = await caches.open(cache);
  const guardada = await c.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  if (r.ok) {
    await c.put(req, r.clone());
    if (maximo) recortar(c, maximo);
  }
  return r;
}

async function guardadoYActualizar(req, cache) {
  const c = await caches.open(cache);
  const guardada = await c.match(req);
  const red = fetch(req)
    .then((r) => {
      if (r.ok) c.put(req, r.clone());
      return r;
    })
    .catch(() => guardada);
  return guardada || red;
}

let recortando = false;
async function recortar(c, maximo) {
  if (recortando) return;
  recortando = true;
  try {
    const ks = await c.keys();
    for (let i = 0; i < ks.length - maximo; i++) await c.delete(ks[i]); // las más viejas primero
  } finally {
    recortando = false;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);

  if (esTesela(u)) {
    e.respondWith(guardadoPrimero(req, MAPA, MAX_TESELAS));
    return;
  }
  if (u.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(redPrimero(req, PAGINAS, { ignorarQuery: true, respaldo: "/" }));
  } else if (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/_next/image") || u.pathname.startsWith("/imagenes/") || u.pathname === "/icon.svg") {
    e.respondWith(guardadoPrimero(req, APP));
  } else if (u.pathname.startsWith("/data/")) {
    e.respondWith(guardadoYActualizar(req, DATOS));
  } else if (u.pathname.startsWith("/api/")) {
    e.respondWith(redPrimero(req, API));
  } else if (req.headers.get("RSC") === "1" || u.searchParams.has("_rsc")) {
    // Navegación interna de Next.js: primero la red, si no, lo guardado
    e.respondWith(redPrimero(req, PAGINAS));
  }
});
