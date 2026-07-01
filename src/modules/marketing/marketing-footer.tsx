import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { PRODUCTS, productHref } from "@/modules/marketing/products";

const COLUMNS = [
  {
    h: "Solutions",
    links: [
      { label: "Field service", href: "/#solutions" },
      { label: "Remote & hybrid", href: "/#solutions" },
      { label: "Agencies", href: "/#solutions" },
      { label: "BPO & support", href: "/#solutions" },
    ],
  },
  {
    h: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    h: "Resources",
    links: [
      { label: "Help center", href: "/help" },
      { label: "API docs", href: productHref("integrations") },
      { label: "Security", href: productHref("security") },
      { label: "Status", href: "#" },
    ],
  },
  {
    h: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "DPA", href: "#" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t px-5 pt-16 pb-10" style={{ borderColor: "var(--m-border)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_repeat(5,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm" style={{ color: "var(--m-muted)" }}>
              Workforce activity &amp; productivity — one clear pulse for the whole
              organization.
            </p>
            <div className="mt-5 flex gap-2.5">
              <CheckCheck className="size-4" style={{ color: "var(--m-muted)" }} />
              <span className="text-xs" style={{ color: "var(--m-muted)" }}>SOC 2 · GDPR ready</span>
            </div>
          </div>

          {/* Product column — all feature pages */}
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-text)" }}>
              Product
            </p>
            <ul className="mt-3 space-y-2.5">
              {PRODUCTS.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={productHref(p.slug)}
                    className="text-sm transition-colors hover:opacity-70"
                    style={{ color: "var(--m-muted)" }}
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {COLUMNS.map((c) => (
            <div key={c.h}>
              <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-text)" }}>
                {c.h}
              </p>
              <ul className="mt-3 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--m-muted)" }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row" style={{ borderColor: "var(--m-border)" }}>
          <p className="text-xs" style={{ color: "var(--m-muted)" }}>
            © 2026 WorkPulse. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs" style={{ color: "var(--m-muted)" }}>
            <Link href="#" className="hover:opacity-70">Privacy</Link>
            <Link href="#" className="hover:opacity-70">Terms</Link>
            <Link href="#" className="hover:opacity-70">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
