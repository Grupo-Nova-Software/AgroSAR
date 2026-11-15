import type { MetadataRoute } from "next";

// Manifest PWA: con esto el teléfono puede instalar AgroSAR como aplicación (ícono, nombre y pantalla completa).
// Íconos PNG generados a partir de src/app/icon.svg (hoja + ondas de radar). El «maskable» deja margen para que
// Android lo recorte en círculo o cuadrado sin cortar el dibujo.
// Funciona sin conexión con public/sw.js (registrado en src/components/RegistrarSW.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AgroSAR",
    short_name: "AgroSAR",
    description: "Soil moisture from NISAR radar for farmers in Itapúa, Paraguay.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f1",
    theme_color: "#1f7a3f",
    lang: "es",
    categories: ["productivity", "weather"],
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Mi suelo", url: "/suelo" },
      { name: "Mis chacras", url: "/chacras" },
      { name: "Clima", url: "/clima" },
    ],
  };
}
