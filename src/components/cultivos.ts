// Cultivos de la app (diseño: public/imagenes/MainScreen.png).
// El color de fondo de cada cultivo está en globals.css como --fondo-<id> (versión clara y oscura).
// PROVISIONAL: la paleta no define un color por cultivo; se usaron tonos derivados. Confirmar con la diseñadora.
import type { Texto } from "./idioma";

export interface Cultivo {
  id: "soja" | "mandioca" | "maiz";
  nombre: Texto;
  descripcion?: Texto;
  imagen: string;
}

export const CULTIVOS: Cultivo[] = [
  {
    id: "soja",
    nombre: { es: "Soja", en: "Soybean" },
    imagen: "/imagenes/Soja.jpeg",
  },
  {
    id: "mandioca",
    nombre: { es: "Mandioca", en: "Cassava" },
    descripcion: {
      es: "Cultivo tradicional de gran valor alimentario.",
      en: "Traditional crop of great nutritional value.",
    },
    imagen: "/imagenes/Mandioca.jpeg",
  },
  {
    id: "maiz",
    nombre: { es: "Maíz", en: "Corn" },
    descripcion: {
      es: "Cultivo esencial para la producción alimentaria.",
      en: "Essential crop for food production.",
    },
    imagen: "/imagenes/Maiz.jpeg",
  },
];

export const fondoDe = (id: string) => `var(--fondo-${id})`;
