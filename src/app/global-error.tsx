"use client";

/**
 * The last-resort boundary — an error in the root layout or its providers, which no other
 * boundary can catch (Next would show its bare "Application error"). It replaces the whole
 * document, so it brings its own `<html>`/`<body>` and inline styles.
 *
 * It also offers a way out of a crash loop: if the shell itself throws (corrupted persisted state),
 * "Try again" lands on the same crash, so "Reset and sign in" clears this app's local data and
 * starts over (QA audit 2026-10-08, WP-118).
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root error", error);
  }, [error]);

  const resetAndSignIn = () => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("wp-") || key.startsWith("CognitoIdentityServiceProvider.")) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Storage unavailable — the navigation below still starts a fresh page.
    }
    window.location.href = "/login";
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8fa",
          color: "#14171c",
        }}
      >
        <div style={{ maxWidth: 440, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>WorkPulse couldn&apos;t start</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#4b5563", margin: 0 }}>
            Something went wrong while loading the app. Try again — and if it keeps happening,
            reset this browser&apos;s WorkPulse data and sign in again.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
            <button
              type="button"
              onClick={reset}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #0f766e", background: "#0f766e", color: "#fff", cursor: "pointer" }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={resetAndSignIn}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#14171c", cursor: "pointer" }}
            >
              Reset and sign in
            </button>
          </div>
          {error.digest ? (
            <p style={{ marginTop: 20, fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
