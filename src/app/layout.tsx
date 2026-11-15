import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import { IdiomaProvider } from "@/components/idioma";
import RegistrarSW from "@/components/RegistrarSW";
import { SCRIPT_TEMA, TemaProvider } from "@/components/tema";
import "./globals.css";

// Bricolage Grotesque: logo y títulos (con carácter). Atkinson Hyperlegible: texto, diseñada para leerse fácil.
const titulo = Bricolage_Grotesque({ variable: "--font-titulo", subsets: ["latin"] });
const texto = Atkinson_Hyperlegible({ variable: "--font-texto", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "AgroSAR",
  applicationName: "AgroSAR",
  appleWebApp: { capable: true, title: "AgroSAR", statusBarStyle: "default" },
  description: "Soil moisture from NISAR radar for farmers in Itapúa, Paraguay (NASA Space Apps 2026).",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f7a3f" },
    { media: "(prefers-color-scheme: dark)", color: "#101613" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning className={`${titulo.variable} ${texto.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">
        <TemaProvider>
          <IdiomaProvider>{children}</IdiomaProvider>
          <RegistrarSW />
        </TemaProvider>
      </body>
    </html>
  );
}
