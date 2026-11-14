// Cultivos del slider de la página principal (diseño: public/imagenes/MainScreen.png).
// `fondo`: color al que cambia el fondo cuando el cultivo está activo.
// PROVISIONAL: la paleta no define un color por cultivo; se usaron tonos derivados de la paleta.
// Confirmar con la diseñadora.
import type { Texto } from "./idioma";

export interface Cultivo {
  id: string;
  nombre: Texto;
  descripcion?: Texto;
  imagen: string;
  fondo: string;
}

export const CULTIVOS: Cultivo[] = [
  {
    id: "soja",
    nombre: { es: "Soja", en: "Soybean" },
    imagen: "/imagenes/Soja.jpeg",
    fondo: "#dfeccb", // tono claro de verde campo #A9C47F
  },
  {
    id: "mandioca",
    nombre: { es: "Mandioca", en: "Cassava" },
    descripcion: {
      es: "Cultivo tradicional de gran valor alimentario.",
      en: "Traditional crop of great nutritional value.",
    },
    imagen: "/imagenes/Mandioca.jpeg",
    fondo: "#cfe3d4", // tono de verde principal #287D45
  },
  {
    id: "maiz",
    nombre: { es: "Maíz", en: "Corn" },
    descripcion: {
      es: "Cultivo esencial para la producción alimentaria.",
      en: "Essential crop for food production.",
    },
    imagen: "/imagenes/Maiz.jpeg",
    fondo: "#f3e2bd", // tono claro de dorado cosecha #D9A441
  },
];
