import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

// Meridian type system (Docs/REDESIGN.md §6): one engineered, highly legible
// enterprise family for UI + headings (hierarchy via weight/size), plus a tabular
// mono for time and metric figures. Grounded in IBM Carbon.
const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Headings reuse the same family (restraint = the enterprise move).
const display = IBM_Plex_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${display.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        {/* Apply the saved colour palette before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('wp-palette');if(p!=='meridian'&&p!=='indigo')p='meridian';if(p!=='indigo'){document.documentElement.setAttribute('data-palette',p);}}catch(e){document.documentElement.setAttribute('data-palette','meridian');}})();`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
