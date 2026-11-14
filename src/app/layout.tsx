import type { Metadata, Viewport } from "next";
import { Nunito, Patrick_Hand } from "next/font/google";
import { IdiomaProvider } from "@/components/idioma";
import "./globals.css";

// Tipografías aproximadas al diseño (confirmar con la diseñadora las fuentes exactas).
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700"] });
const patrick = Patrick_Hand({ variable: "--font-patrick", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "AgroSAR Itapúa",
  description: "Soil moisture from NISAR radar for farmers in Itapúa, Paraguay (NASA Space Apps 2026).",
};

export const viewport: Viewport = { themeColor: "#287d45" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunito.variable} ${patrick.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <IdiomaProvider>{children}</IdiomaProvider>
      </body>
    </html>
  );
}
