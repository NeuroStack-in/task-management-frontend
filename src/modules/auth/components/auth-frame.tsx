"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Logo } from "@/modules/marketing/logo";

/**
 * Shared auth chrome: the logindesign01 wave artwork as a full-bleed background
 * with a dark scrim, a compact centered column (logo + tagline), then a
 * glassmorphic card. The surface is locked to the viewport (h-[100dvh] +
 * overflow-hidden) so login / sign-up never scroll; the card is sized to its
 * content and re-themes the m-* tokens to a dark-glass context (see the
 * `.m-authglass` block in marketing.css).
 */
export function AuthFrame({
  children,
  maxWidth = 420,
}: {
  children: React.ReactNode;
  /** Card column width — sized per page to the fields it carries. */
  maxWidth?: number;
}) {
  return (
    <div
      className="m-root relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-5 py-6"
      style={{ background: "#04100e" }}
    >
      {/* Background artwork + scrim */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/logindesign01.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -5%, rgba(4,16,14,0.18), rgba(4,16,14,0.80) 100%)",
          }}
        />
      </div>

      {/* Teal glow behind the card for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(20,184,166,0.18), transparent 66%)",
          filter: "blur(28px)",
        }}
      />

      {/* Centered column */}
      <div
        className="relative z-10 flex w-full flex-col items-center"
        style={{ maxWidth }}
      >
        <Link
          href="/"
          className="m-enter-up inline-flex"
          style={{ animationDelay: "40ms" }}
        >
          <Logo className="text-white" />
        </Link>
        <p
          className="m-enter-up mt-2 text-center text-sm text-white/55"
          style={{ animationDelay: "90ms" }}
        >
          Your workforce, in perfect rhythm.
        </p>
        <div className="mt-5 w-full">{children}</div>
      </div>
    </div>
  );
}

/** The glassmorphic auth card. Visuals + token overrides live in `.m-authglass`. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return <div className="m-authglass m-auth-in w-full">{children}</div>;
}

/** Title + subtitle header — no icon chip (reference-clean). */
export function AuthCardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-5 text-center">
      <h1
        className="m-display text-[1.5rem] font-semibold tracking-tight"
        style={{ color: "var(--m-text)" }}
      >
        {title}
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: "var(--m-muted)" }}>
        {subtitle}
      </p>
    </div>
  );
}

/** Icon-leading input (mail/lock/etc. inside the field).
 *  Padding is set inline so it can't be clobbered by the (unlayered) global
 *  `.m-input` rule — that override was what made the icon overlap the text. */
export function AuthField({
  id,
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  toggle,
}: {
  id: string;
  icon: LucideIcon;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: boolean | string;
  autoComplete?: string;
  toggle?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2"
        style={{ color: "var(--m-muted)" }}
      />
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className={`m-input ${error ? "m-error" : ""}`}
        style={{
          paddingLeft: "2.9rem",
          paddingRight: toggle ? "2.75rem" : "0.9rem",
        }}
      />
      {toggle ? (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">{toggle}</span>
      ) : null}
    </div>
  );
}

export function PwToggle({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={show ? "Hide password" : "Show password"}
      className="flex size-8 items-center justify-center rounded-md transition-colors"
      style={{ color: "var(--m-muted)" }}
    >
      {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
    </button>
  );
}

/** Dotted "or" divider. */
export function Divider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="flex-1" style={{ borderTop: "1.5px dotted var(--m-border-strong)" }} />
      <span className="text-xs" style={{ color: "var(--m-muted)" }}>
        or
      </span>
      <span className="flex-1" style={{ borderTop: "1.5px dotted var(--m-border-strong)" }} />
    </div>
  );
}

/** Cross-link inside the card. */
export function CardSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-5 text-center text-sm" style={{ color: "var(--m-muted)" }}>
      {prompt}{" "}
      <Link href={href} className="font-semibold hover:underline" style={{ color: "var(--m-text)" }}>
        {label}
      </Link>
    </p>
  );
}
