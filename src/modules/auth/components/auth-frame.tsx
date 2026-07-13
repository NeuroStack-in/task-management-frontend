"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { cn } from "@/lib/utils";

/**
 * Shared auth chrome — split composition over the login_desktop_bg_2 wave
 * artwork (with a dark scrim). The logo pins to the page's top-left corner;
 * the per-page headline + copy sit vertically centred beside the glass form
 * card, and the whole two-column band is width-capped and centred so the
 * brand text and card read as one gathered composition (no dead flanks).
 * On mobile the brand column collapses to a compact logo above the card.
 */
export function AuthFrame({
  children,
  headline,
  copy,
  brandSide = "left",
  maxWidth = 440,
}: {
  children: React.ReactNode;
  /** Brand-column display headline (per page). */
  headline: string;
  /** Supporting paragraph under the headline. */
  copy: string;
  /** Which side the wordings sit on (login: left · sign-up: right). */
  brandSide?: "left" | "right";
  /** Form card width — sized per page to the fields it carries. */
  maxWidth?: number;
}) {
  return (
    <div
      className="m-root relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-5 py-10 sm:px-10"
      style={{ background: "#04100e" }}
    >
      {/* Background artwork + scrim */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/login_desktop_bg_2.png"
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

      {/* Centred two-column band: brand block · form card */}
      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* ---- Brand column (desktop): logo leads, wordings follow ---- */}
        <aside
          className={cn(
            "m-enter-up hidden max-w-md text-white lg:block",
            brandSide === "right" && "lg:order-2 lg:ml-auto",
          )}
          style={{ animationDelay: "130ms" }}
        >
          <Link href="/" className="inline-flex">
            <Logo className="text-white" size="xl" />
          </Link>
          <h2 className="m-display mt-7 text-2xl font-semibold leading-snug xl:text-[1.75rem]">
            {headline}
          </h2>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-white/75">
            {copy}
          </p>
        </aside>

        {/* ---- Form column ---- */}
        <main
          className={cn(
            "flex flex-col items-center gap-6",
            brandSide === "right" && "lg:order-1",
          )}
        >
          {/* Compact brand on mobile, where the panel is hidden */}
          <Link href="/" className="inline-flex lg:hidden">
            <Logo className="text-white" />
          </Link>
          <div
            className={cn("w-full", brandSide === "right" ? "lg:mr-auto" : "lg:ml-auto")}
            style={{ maxWidth }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** The glassmorphic auth card. Visuals + token overrides live in `.m-authglass`. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return <div className="m-authglass m-auth-in w-full">{children}</div>;
}

/** Left-aligned title + subtitle header. */
export function AuthCardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <h1
        className="m-display text-2xl font-semibold tracking-tight"
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

/** Labelled input with a trailing adornment: the password toggle when given,
 *  otherwise a muted icon. Padding is inline so the (unlayered) global
 *  `.m-input` rule can't clobber it. */
export function AuthField({
  id,
  label,
  icon: Icon,
  type,
  value,
  onChange,
  error,
  autoComplete,
  toggle,
}: {
  id: string;
  label: string;
  icon?: LucideIcon;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean | string;
  autoComplete?: string;
  toggle?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium"
        style={{ color: "var(--m-muted)" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={`m-input ${error ? "m-error" : ""}`}
          style={{
            paddingLeft: "1rem",
            paddingRight: toggle || Icon ? "2.75rem" : "1rem",
          }}
        />
        {toggle ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {toggle}
          </span>
        ) : Icon ? (
          <Icon
            className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2"
            style={{ color: "var(--m-faint)" }}
          />
        ) : null}
      </div>
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

/** In-card switch — a single line: prompt + inline link. */
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
      <Link
        href={href}
        className="font-semibold hover:underline"
        style={{ color: "var(--m-accent-ink)" }}
      >
        {label}
      </Link>
    </p>
  );
}
