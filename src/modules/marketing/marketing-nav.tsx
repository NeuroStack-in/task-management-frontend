"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { PRODUCTS, productHref } from "@/modules/marketing/products";

const SECONDARY = [
  { label: "Solutions", href: "/#solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/#faq" },
];

export function MarketingNav({ onDark = false }: { onDark?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [mobileProducts, setMobileProducts] = useState(false);

  // Over a dark hero the nav is transparent with light text — until the user
  // scrolls (or opens the mega-menu), when it becomes a frosted light bar.
  const light = onDark && !scrolled && !productOpen;
  const linkColor = light ? "rgb(255 255 255 / 0.82)" : "var(--m-muted)";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mega-menu on Escape.
  useEffect(() => {
    if (!productOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProductOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [productOpen]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-[background,backdrop-filter,border-color] duration-300"
      style={{
        background: scrolled || productOpen
          ? "color-mix(in srgb, var(--m-bg) 82%, transparent)"
          : "transparent",
        backdropFilter: scrolled || productOpen ? "blur(14px)" : "none",
        WebkitBackdropFilter: scrolled || productOpen ? "blur(14px)" : "none",
        borderBottom: scrolled || productOpen ? "1px solid var(--m-border)" : "1px solid transparent",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="WorkPulse home" className="shrink-0">
          <Logo className={light ? "[&_span]:text-white" : ""} />
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 md:flex">
          <li
            className="relative"
            onMouseEnter={() => setProductOpen(true)}
            onMouseLeave={() => setProductOpen(false)}
          >
            <button
              type="button"
              onClick={() => setProductOpen((o) => !o)}
              aria-expanded={productOpen}
              className="inline-flex items-center gap-1 text-sm"
              style={{ color: productOpen ? "var(--m-text)" : linkColor }}
            >
              Product
              <ChevronDown
                className="size-3.5 transition-transform"
                style={{ transform: productOpen ? "rotate(180deg)" : "none" }}
              />
            </button>

            {productOpen ? (
              <div className="absolute left-1/2 top-full w-[min(92vw,640px)] -translate-x-1/2 pt-4">
                <div
                  className="m-card m-enter-scale grid grid-cols-1 gap-1 p-3 sm:grid-cols-2"
                  style={{ boxShadow: "0 30px 70px -30px rgb(18 28 40 / 0.4)" }}
                >
                  {PRODUCTS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <Link
                        key={p.slug}
                        href={productHref(p.slug)}
                        onClick={() => setProductOpen(false)}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[color-mix(in_srgb,var(--m-accent)_8%,transparent)]"
                      >
                        <span
                          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: "color-mix(in srgb, var(--m-accent) 14%, transparent)", color: "var(--m-accent)" }}
                        >
                          <Icon className="size-[18px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{p.name}</span>
                          <span className="block text-xs leading-snug" style={{ color: "var(--m-muted)" }}>
                            {p.tagline}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </li>

          {SECONDARY.map((l) => (
            <li key={l.label}>
              <Link href={l.href} className="text-sm" style={{ color: linkColor }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/login"
            className={`m-btn text-sm ${light ? "" : "m-btn-ghost"}`}
            style={light ? { background: "rgb(255 255 255 / 0.14)", color: "#fff", borderColor: "rgb(255 255 255 / 0.32)", backdropFilter: "blur(6px)" } : undefined}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={`m-btn text-sm ${light ? "" : "m-btn-primary"}`}
            style={light ? { background: "#ffffff", color: "var(--m-accent-ink)" } : undefined}
          >
            Get started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border md:hidden"
          style={{ borderColor: light ? "rgb(255 255 255 / 0.4)" : "var(--m-border-strong)", color: light ? "#fff" : "var(--m-text)" }}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen ? (
        <div
          className="max-h-[80vh] overflow-y-auto border-t md:hidden"
          style={{ borderColor: "var(--m-border)", background: "color-mix(in srgb, var(--m-bg) 96%, transparent)", backdropFilter: "blur(14px)" }}
        >
          <div className="space-y-1 px-5 py-4">
            <button
              type="button"
              onClick={() => setMobileProducts((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium"
              style={{ color: "var(--m-text)" }}
            >
              Product
              <ChevronDown className="size-4" style={{ transform: mobileProducts ? "rotate(180deg)" : "none" }} />
            </button>
            {mobileProducts ? (
              <div className="space-y-0.5 pb-1 pl-2">
                {PRODUCTS.map((p) => (
                  <Link
                    key={p.slug}
                    href={productHref(p.slug)}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm"
                    style={{ color: "var(--m-muted)" }}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            ) : null}
            {SECONDARY.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm"
                style={{ color: "var(--m-text)" }}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 px-1 pt-2">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="m-btn m-btn-ghost flex-1">
                Log in
              </Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="m-btn m-btn-primary flex-1">
                Get started
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
