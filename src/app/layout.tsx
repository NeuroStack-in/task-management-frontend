import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Geist,
  Geist_Mono,
  Manrope,
  Space_Grotesk,
  Fraunces,
} from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

// All selectable type families are loaded under neutral CSS variables; the
// active pairing is chosen at runtime via `data-font` on <html> (globals.css),
// switched from Settings → Appearance. IBM Plex is the default.
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});
// Editorial serif — the homepage's display face. Loaded here so the whole marketing
// surface (pricing, product, auth) can share it via `.m-root`, matching the landing.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const fontVars = [
  ibmPlexSans.variable,
  ibmPlexMono.variable,
  inter.variable,
  jetbrainsMono.variable,
  geist.variable,
  geistMono.variable,
  manrope.variable,
  spaceGrotesk.variable,
  fraunces.variable,
].join(" ");

export const metadata: Metadata = {
  title: {
    default: "WorkPulse — Workforce Activity & Productivity",
    template: "%s · WorkPulse",
  },
  description:
    "Time tracking, task management, activity monitoring, and AI-powered productivity insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fontVars} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {/* Apply the saved colour palette + font pairing before paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var p=localStorage.getItem('wp-palette')||'meridian';if(p!=='indigo'){d.setAttribute('data-palette',p);}var f=localStorage.getItem('wp-font');if(f&&f!=='ibmplex'){d.setAttribute('data-font',f);}}catch(e){document.documentElement.setAttribute('data-palette','meridian');}})();`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
