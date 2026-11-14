import type { MetadataRoute } from "next";

// Manifest PWA (rol Frontend). TODO Frontend: íconos PNG 192x192 y 512x512 en public/icons/
// y un service worker (public/sw.js) para que se pueda instalar y funcione sin conexión.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgroSAR Itapúa",
    short_name: "AgroSAR",
    description: "Soil moisture from NISAR radar for farmers in Itapúa, Paraguay.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#2e7d32",
    lang: "en",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
