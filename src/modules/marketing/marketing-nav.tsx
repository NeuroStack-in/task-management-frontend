"use client";

/**
 * The one navbar for every marketing route — landing, `/pricing`, `/product/*`.
 *
 * All three groups (Product · Solutions · Resources) are dropdowns, mirroring the footer's columns,
 * and both surfaces read the same lists from `products.ts`. They used to be separate arrays that
 * had already drifted apart, which is how the landing ended up advertising a different product set
 * from the rest of the site.
 *
 * Only one menu is open at a time — a single `openMenu` key rather than a boolean per group, so two
 * panels can never overlap.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, type LucideIcon } from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { PRODUCTS, RESOURCES, SOLUTIONS, productHref } from "@/modules/marketing/products";

type MenuKey = "product" | "solutions" | "resources";

interface MenuItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  tagline?: string;
}

/** All three menus render the same row shape, so `PRODUCTS` is normalised into it. */
function menuItems(key: MenuKey): MenuItem[] {
  if (key === "product") {
    return PRODUCTS.map((p) => ({
      label: p.name,
      href: productHref(p.slug),
      icon: p.icon,
      tagline: p.tagline,
    }));
  }
  return key === "solutions" ? SOLUTIONS : RESOURCES;
}

/** One row: icon tile, label, supporting line. Shared so the three menus can't drift apart. */
function MenuRow({
  label,
  href,
  icon: Icon,
  tagline,
  onNavigate,
}: MenuItem & { onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[color-mix(in_srgb,var(--m-accent)_8%,transparent)]"
    >
      {Icon ? (
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--m-accent) 14%, transparent)",
            color: "var(--m-accent)",
          }}
        >
          <Icon className="size-[18px]" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {tagline ? (
          <span className="block text-xs leading-snug" style={{ color: "var(--m-muted)" }}>
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function MarketingNav({ onDark = false }: { onDark?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileSection, setMobileSection] = useState<MenuKey | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Over a dark hero the nav is transparent with light text, and becomes a frosted light bar once
  // the user scrolls.
  //
  // Scroll position is the ONLY input. Opening a menu used to flip the bar to its light state too,
  // which meant the whole header changed theme mid-interaction — you click a trigger and the thing
  // you clicked turns white underneath you. The dropdown is a light card either way; a light panel
  // hanging from a transparent bar over a dark hero is the normal, calm result.
  const light = onDark && !scrolled;
  const linkColor = light ? "rgb(255 255 255 / 0.82)" : "var(--m-muted)";
  /** The open trigger has to stay legible against whichever bar it's sitting on. */
  const activeLinkColor = light ? "#ffffff" : "var(--m-text)";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes, and so does a click outside — a hover-opened menu that only
  // closes on hover-out strands keyboard users who opened it with Enter.
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(null);
    const onDown = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openMenu]);

  const trigger = (key: MenuKey, label: string) => (
    <li
      className="relative"
      onMouseEnter={() => setOpenMenu(key)}
      onMouseLeave={() => setOpenMenu((k) => (k === key ? null : k))}
    >
      <button
        type="button"
        onClick={() => setOpenMenu((k) => (k === key ? null : key))}
        aria-expanded={openMenu === key}
        className="inline-flex items-center gap-1 py-2 text-sm"
        style={{ color: openMenu === key ? activeLinkColor : linkColor }}
      >
        {label}
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{ transform: openMenu === key ? "rotate(180deg)" : "none" }}
        />
      </button>

      {openMenu === key ? (
        <div
          className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 ${
            key === "product" ? "w-[min(92vw,640px)]" : "w-[min(92vw,320px)]"
          }`}
        >
          <div
            className={`m-card m-enter-scale gap-1 p-3 ${
              /* Product has ten entries and earns two columns; five and three read
                 better as a single column than as a grid with a hole in it. */
              key === "product" ? "grid grid-cols-1 sm:grid-cols-2" : "grid grid-cols-1"
            }`}
            style={{ boxShadow: "0 30px 70px -30px rgb(18 28 40 / 0.4)" }}
          >
            {menuItems(key).map((item) => (
              <MenuRow key={item.href + item.label} {...item} onNavigate={() => setOpenMenu(null)} />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );

  const mobileSectionBlock = (key: MenuKey, label: string, links: { label: string; href: string }[]) => (
    <>
      <button
        type="button"
        onClick={() => setMobileSection((s) => (s === key ? null : key))}
        aria-expanded={mobileSection === key}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium"
        style={{ color: "var(--m-text)" }}
      >
        {label}
        <ChevronDown
          className="size-4 transition-transform"
          style={{ transform: mobileSection === key ? "rotate(180deg)" : "none" }}
        />
      </button>
      {mobileSection === key ? (
        <div className="space-y-0.5 pb-1 pl-2">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm"
              style={{ color: "var(--m-muted)" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <header
      ref={navRef}
      className="fixed inset-x-0 top-0 z-50 transition-[background,backdrop-filter,border-color] duration-300"
      style={{
        background: scrolled ? "color-mix(in srgb, var(--m-bg) 82%, transparent)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? "1px solid var(--m-border)" : "1px solid transparent",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="WorkPulse home" className="shrink-0">
          <Logo className={light ? "[&_span]:text-white" : ""} />
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 md:flex">
          {trigger("product", "Product")}
          {trigger("solutions", "Solutions")}
          {trigger("resources", "Resources")}
        </ul>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/login"
            className={`m-btn text-sm ${light ? "" : "m-btn-ghost"}`}
            style={
              light
                ? {
                    background: "rgb(255 255 255 / 0.14)",
                    color: "#fff",
                    borderColor: "rgb(255 255 255 / 0.32)",
                    backdropFilter: "blur(6px)",
                  }
                : undefined
            }
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
          aria-expanded={menuOpen}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border md:hidden"
          style={{
            borderColor: light ? "rgb(255 255 255 / 0.4)" : "var(--m-border-strong)",
            color: light ? "#fff" : "var(--m-text)",
          }}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen ? (
        <div
          className="max-h-[80vh] overflow-y-auto border-t md:hidden"
          style={{
            borderColor: "var(--m-border)",
            background: "color-mix(in srgb, var(--m-bg) 96%, transparent)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div className="space-y-1 px-5 py-4">
            {mobileSectionBlock(
              "product",
              "Product",
              PRODUCTS.map((p) => ({ label: p.name, href: productHref(p.slug) })),
            )}
            {mobileSectionBlock("solutions", "Solutions", SOLUTIONS)}
            {mobileSectionBlock("resources", "Resources", RESOURCES)}
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
