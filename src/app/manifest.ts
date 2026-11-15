import type { MetadataRoute } from "next";

// Manifest PWA (rol Frontend). El ícono es src/app/icon.svg (hoja + ondas de radar).
// Funciona sin conexión con public/sw.js (registrado en src/components/RegistrarSW.tsx).
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
