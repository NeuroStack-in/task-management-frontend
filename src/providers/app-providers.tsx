"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    // Light by default, and **not** `system`: the product is a calm, HR-grade light surface, and
    // following the OS meant an employee on a dark-mode laptop landed in dark on first run without
    // ever choosing it. `enableSystem` stays on so "System" is still offered in the theme toggle —
    // this changes the default, not the choice.
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={200}>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
