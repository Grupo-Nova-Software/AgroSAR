// Cultivos de la app (diseño: public/imagenes/MainScreen.png).
// El color de fondo de cada cultivo está en globals.css como --fondo-<id> (claro y oscuro):
// soja = verde vaina, maíz = amarillo choclo, mandioca = cáscara / tierra colorada.
import type { Texto } from "./idioma";

export interface Cultivo {
  id: "soja" | "mandioca" | "maiz";
  nombre: Texto;
  /** Nombre en minúscula para usar dentro de una frase. */
  enFrase: Texto;
  descripcion: Texto;
  imagen: string;
}

export const CULTIVOS: Cultivo[] = [
  {
    id: "soja",
    nombre: { es: "Soja", en: "Soybean" },
    enFrase: { es: "soja", en: "soybean" },
    descripcion: { es: "Cultivo de gran importancia en Paraguay.", en: "A crop of great importance in Paraguay." },
    imagen: "/imagenes/Soja.jpeg",
  },
  {
    id: "mandioca",
    nombre: { es: "Mandioca", en: "Cassava" },
    enFrase: { es: "mandioca", en: "cassava" },
    descripcion: { es: "Cultivo tradicional de gran valor alimentario.", en: "Traditional crop of great nutritional value." },
    imagen: "/imagenes/Mandioca.jpeg",
  },
  {
    id: "maiz",
    nombre: { es: "Maíz", en: "Corn" },
    enFrase: { es: "maíz", en: "corn" },
    descripcion: { es: "Cultivo esencial para la producción alimentaria.", en: "Essential crop for food production." },
    imagen: "/imagenes/Maiz.jpeg",
  },
];

export const fondoDe = (id: string) => `var(--fondo-${id})`;
