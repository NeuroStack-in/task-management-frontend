import { Plug } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Brand marks for the marketplace cards, inline so there's no external request and they render
 * identically in light and dark. Keyed by the provider's wire id (`slack`, `google_calendar`);
 * anything unknown falls back to a neutral plug icon rather than a broken image.
 */
export function ProviderLogo({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  if (provider === "slack") {
    return (
      <svg
        viewBox="0 0 122.8 122.8"
        className={cn("shrink-0", className)}
        role="img"
        aria-label="Slack"
      >
        <path
          d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z"
          fill="#e01e5a"
        />
        <path
          d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
          fill="#e01e5a"
        />
        <path
          d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z"
          fill="#36c5f0"
        />
        <path
          d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
          fill="#36c5f0"
        />
        <path
          d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z"
          fill="#2eb67d"
        />
        <path
          d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
          fill="#2eb67d"
        />
        <path
          d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z"
          fill="#ecb22e"
        />
        <path
          d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
          fill="#ecb22e"
        />
      </svg>
    );
  }

  if (provider === "google_calendar") {
    return (
      <svg
        viewBox="0 0 48 48"
        className={cn("shrink-0", className)}
        role="img"
        aria-label="Google Calendar"
      >
        <rect x="10" y="10" width="28" height="28" fill="#fff" />
        <path fill="#4285f4" d="M10 10h28v6H10z" />
        <path fill="#188038" d="M38 10h6v28h-6z" />
        <path fill="#fbbc04" d="M38 38l6-6v6z" />
        <path fill="#34a853" d="M10 38h28v6H10z" />
        <path fill="#1967d2" d="M4 10h6v28H4z" />
        <path fill="#4285f4" d="M4 10a6 6 0 0 1 6-6v6z" transform="translate(0 0)" />
        <path
          fill="#1a73e8"
          d="M21.36 30.9c-.98-.66-1.66-1.62-2.03-2.9l2.28-.94c.2.78.56 1.38 1.06 1.8.5.42 1.1.63 1.82.63.73 0 1.35-.22 1.86-.66.5-.44.76-1 .76-1.68 0-.7-.27-1.27-.8-1.71-.53-.44-1.2-.66-2-.66h-1.32v-2.26h1.18c.68 0 1.26-.18 1.73-.55.47-.36.7-.86.7-1.5 0-.56-.2-1.02-.62-1.36-.41-.34-.93-.51-1.57-.51-.62 0-1.12.16-1.49.5-.37.33-.65.75-.83 1.24l-2.24-.93c.3-.86.86-1.62 1.68-2.28.82-.66 1.87-.99 3.14-.99.94 0 1.78.18 2.53.55.75.36 1.33.87 1.76 1.51.42.64.63 1.36.63 2.16 0 .82-.2 1.51-.6 2.08-.39.57-.87 1-1.45 1.31v.14c.76.32 1.39.8 1.87 1.46.49.66.73 1.44.73 2.36 0 .91-.23 1.73-.7 2.44-.46.72-1.1 1.28-1.92 1.68-.82.4-1.74.61-2.76.61-1.18 0-2.27-.34-3.29-1.03z"
        />
      </svg>
    );
  }

  return <Plug className={cn("text-muted-foreground", className)} />;
}
