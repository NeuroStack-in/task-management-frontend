"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Reveal } from "@/modules/marketing/reveal";

interface GalleryItem {
  src: string;
  title: string;
  body: string;
}

export function ProductGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);

  // Lock scroll + Escape-to-close while the lightbox is open.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active]);

  return (
    <>
      <div className="mt-14 space-y-16">
        {items.map((g, i) => (
          <Reveal key={g.src}>
            <div className={`grid items-center gap-8 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <h3 className="m-display text-xl font-semibold text-white sm:text-2xl">{g.title}</h3>
                <p className="mt-3 text-base leading-relaxed" style={{ color: "rgb(255 255 255 / 0.72)" }}>
                  {g.body}
                </p>
                <button
                  type="button"
                  onClick={() => setActive(g)}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: "#7fd1c5" }}
                >
                  <Maximize2 className="size-4" /> View full length
                </button>
              </div>

              {/* Framed image — click anywhere to open the lightbox */}
              <button
                type="button"
                onClick={() => setActive(g)}
                aria-label={`View ${g.title} full length`}
                className="group relative block overflow-hidden rounded-2xl p-2 text-left transition-transform duration-300 hover:-translate-y-1"
                style={{ background: "rgb(255 255 255 / 0.07)", border: "1px solid rgb(255 255 255 / 0.18)", backdropFilter: "blur(10px)", boxShadow: "0 40px 90px -40px rgb(0 0 0 / 0.6)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.title} className="block w-full rounded-xl" />
                {/* hover overlay */}
                <span
                  className="absolute inset-2 flex items-center justify-center rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ background: "rgb(8 30 28 / 0.4)", backdropFilter: "blur(1px)" }}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-lg" style={{ background: "rgb(255 255 255 / 0.92)", color: "var(--m-accent-ink)" }}>
                    <Maximize2 className="size-4" /> View full length
                  </span>
                </span>
              </button>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Lightbox */}
      {active ? (
        <div
          className="m-enter-scale fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
          style={{ background: "rgb(6 20 18 / 0.88)", backdropFilter: "blur(8px)" }}
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-label="Close"
            className="fixed top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/25"
            style={{ background: "rgb(255 255 255 / 0.14)", color: "#fff", border: "1px solid rgb(255 255 255 / 0.32)" }}
          >
            <X className="size-5" />
          </button>
          <figure className="my-auto w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.src} alt={active.title} className="block w-full rounded-xl" style={{ boxShadow: "0 40px 100px -30px rgb(0 0 0 / 0.7)" }} />
            <figcaption className="mt-3 text-center text-sm" style={{ color: "rgb(255 255 255 / 0.7)" }}>
              {active.title}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
