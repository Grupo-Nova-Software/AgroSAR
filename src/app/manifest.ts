import type { MetadataRoute } from "next";

// Manifest PWA (rol Frontend). El ícono es src/app/icon.svg (hoja + ondas de radar).
// TODO Frontend: service worker (public/sw.js) para que funcione sin conexión.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgroSAR Itapúa",
    short_name: "AgroSAR",
    description: "Soil moisture from NISAR radar for farmers in Itapúa, Paraguay.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#287d45",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
