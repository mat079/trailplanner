import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { fr } from "@/i18n/fr";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: fr.app.name,
    template: `%s — ${fr.app.name}`,
  },
  description: fr.app.description,
  keywords: ["randonnée", "trail", "ultra", "planificateur", "GPX", "outdoor", "bivouac"],
  authors: [{ name: "TrailPlanner" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#1a4731",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
