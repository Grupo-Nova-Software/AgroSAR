import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { IdiomaProvider } from "@/components/idioma";
import { SCRIPT_TEMA, TemaProvider } from "@/components/tema";
import "./globals.css";

// Fraunces: logo y títulos (serif con carácter). Plus Jakarta Sans: texto (legible, moderna).
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "600", "700"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "AgroSAR Itapúa",
  description: "Soil moisture from NISAR radar for farmers in Itapúa, Paraguay (NASA Space Apps 2026).",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#287d45" },
    { media: "(prefers-color-scheme: dark)", color: "#101613" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">
        <TemaProvider>
          <IdiomaProvider>{children}</IdiomaProvider>
        </TemaProvider>
      </body>
    </html>
  );
}
