"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react";

/**
 * Toasts, in WorkPulse's own clothes.
 *
 * ## Why every variable below is set explicitly
 *
 * This component used to set only the `--normal-*` trio, so `success`, `error`, `warning` and
 * `info` fell through to sonner's built-in palette — which is how an error arrived as a saturated
 * red slab in a product whose surfaces are graphite and whose one accent is indigo. It looked like
 * a third-party component pasted into the page, because that is exactly what it was.
 *
 * Pointing **all** of them at the popover tokens is deliberate rather than redundant: sonner injects
 * its own stylesheet into the document at runtime, so its rules can land after `globals.css`. Class
 * and attribute selectors carry the same specificity, which would leave the winner decided by
 * injection order — something this file does not control. Setting the variables settles it from the
 * inside instead, so the surface is the same in every variant no matter which rule wins.
 *
 * The semantic colour is not gone; it moved. `.cn-toast` in `globals.css` paints a 3px rail and the
 * icon from `--toast-accent`, keyed off `[data-type]`. That follows DESIGN.md — *"spend boldness
 * only on the pulse motif and the featured card; keep everything else quiet"* — and it keeps the
 * title and description on the ordinary foreground tokens, so both stay legible in both themes. A
 * filled panel would have forced white text and cost the description its contrast, which is the half
 * that tells you what to do.
 *
 * ## The icons
 *
 * One family, one weight. `error` was an octagon among circles — a stop sign next to a check mark,
 * heavier than everything around it. `CircleAlertIcon` matches `CircleCheckIcon` stroke for stroke,
 * so the row of variants reads as one set rather than four borrowed marks.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleAlertIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Every variant resolves to the same neutral surface. The rail and icon carry the meaning.
          "--success-bg": "var(--popover)",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "var(--border)",
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "var(--border)",
          "--info-bg": "var(--popover)",
          "--info-text": "var(--popover-foreground)",
          "--info-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
