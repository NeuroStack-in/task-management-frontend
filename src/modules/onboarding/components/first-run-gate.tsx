"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PALETTES, applyPalette } from "@/lib/palette";
import { useAuthStore } from "@/stores/auth.store";
import {
  getMyProfile,
  updateMyProfile,
} from "@/modules/profile/services/profile.service";
import { useAppearance } from "@/modules/settings/use-appearance";
import type { AppearanceTheme } from "@/modules/settings/services/appearance.service";

/**
 * The four self-entered facts the profile page shows. A record missing any of them renders "—",
 * which is what this gate exists to stop.
 */
export interface Details {
  phone: string;
  location: string;
  dateOfBirth: string;
  workMode: string;
}

const EMPTY: Details = {
  phone: "",
  location: "",
  dateOfBirth: "",
  workMode: "",
};

/** Digits, not characters: `PhoneInput` emits `+<dial>` for a country picked with no number typed. */
const hasPhone = (v: string) => v.replace(/[^\d]/g, "").length >= 6;

export function complete(d: Details): boolean {
  return (
    hasPhone(d.phone) &&
    d.location.trim().length > 0 &&
    d.dateOfBirth.length > 0 &&
    d.workMode.length > 0
  );
}

/**
 * The one-time completion gate.
 *
 * **Why it exists.** Signup and invite acceptance now require the whole profile, but a form cannot
 * reach the accounts created before it did — every one of those still shows "—" for contact number,
 * date of birth and work mode, and nobody visits Settings to finish a record they were never asked
 * to complete. This asks once, on the next visit, and then never again.
 *
 * **Why there is no "seen" flag.** Completeness IS the flag. A stored profile with all four fields
 * is the thing we wanted, and it is per-account rather than per-device — a localStorage marker
 * would re-ask on a second machine and, worse, could suppress the prompt for someone whose profile
 * is still empty. Nothing extra is persisted and nothing can drift out of step with the truth.
 *
 * **Why the details cannot be skipped and the settings can.** The details are a record the
 * organisation needs and only this person can supply. The preferences are theirs alone and have
 * sensible defaults, so demanding them would be detaining someone over a colour.
 */
export function FirstRunGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [step, setStep] = useState<"idle" | "details" | "settings">("idle");
  const [form, setForm] = useState<Details>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [saving, setSaving] = useState(false);

  // Ask once per signed-in account. `checked` stops a re-render or a store update re-running the
  // read; the gate is a one-shot per session, not a subscription.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !userId || checkedFor === userId) return;
    setCheckedFor(userId);
    let live = true;
    getMyProfile()
      .then((p) => {
        if (!live) return;
        const current: Details = {
          phone: p.phone ?? "",
          location: p.location ?? "",
          dateOfBirth: p.date_of_birth ?? "",
          workMode: p.work_mode ?? "",
        };
        // Seed the form with whatever IS recorded, so someone who supplied a phone years ago is not
        // asked to type it again — only the gaps are theirs to fill.
        setForm(current);
        if (!complete(current)) setStep("details");
      })
      .catch(() => {
        // A failed read must not lock anyone out of the app over a profile field. Stay silent and
        // let the next visit try again — the gate is a nudge, not a turnstile with a broken hinge.
      });
    return () => {
      live = false;
    };
  }, [hydrated, isAuthenticated, userId, checkedFor]);

  const set = <K extends keyof Details>(k: K) => (v: Details[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const submitDetails = useCallback(async () => {
    const next: Partial<Record<keyof Details, string>> = {};
    if (!hasPhone(form.phone)) next.phone = "Enter your contact number";
    if (!form.location.trim()) next.location = "Enter your location";
    if (!form.dateOfBirth) next.dateOfBirth = "Enter your date of birth";
    if (!form.workMode) next.workMode = "Choose how you work";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await updateMyProfile({
        phone: form.phone.trim(),
        location: form.location.trim(),
        date_of_birth: form.dateOfBirth,
        work_mode: form.workMode,
      });
      setStep("settings");
    } catch {
      toast.error("Couldn't save your details", {
        description: "Please try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (step === "idle") return null;

  // `open` with no `onOpenChange`: a controlled dialog that owns no state cannot close itself, so
  // Escape and a click outside have nothing to call and are inert. With the close button hidden
  // too, this is the one screen in the app that has to be answered rather than waved away.
  return step === "details" ? (
    <Dialog open>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finish setting up your profile</DialogTitle>
          <DialogDescription>
            Your organisation needs these details, and only you can give them. It takes a
            moment and you will not be asked again.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact number" error={errors.phone}>
            <PhoneInput value={form.phone} onChange={set("phone")} className="w-full" />
          </Field>
          <Field label="Date of birth" error={errors.dateOfBirth}>
            <DatePicker
              value={form.dateOfBirth}
              onChange={set("dateOfBirth")}
              max={todayIso()}
              min="1900-01-01"
              className="w-full"
            />
          </Field>
          <Field label="Location" error={errors.location}>
            <Input
              value={form.location}
              onChange={(e) => set("location")(e.target.value)}
              placeholder="City"
            />
          </Field>
          <Field label="Work mode" error={errors.workMode}>
            <select
              value={form.workMode}
              onChange={(e) => set("workMode")(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Select…</option>
              {/* Exactly `identity::shared::profile::WORK_MODES`. */}
              <option value="on-site">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={submitDetails} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : (
    <SettingsStep onDone={() => setStep("idle")} />
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

const THEMES: { id: AppearanceTheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

/**
 * The skippable half: how the app looks.
 *
 * Shown immediately after the details are saved, which is exactly once per account — a complete
 * profile is what stops the gate opening again, so this rides on the same signal and needs no flag
 * of its own.
 *
 * Appearance only. Working hours and tracking mode were considered for an owner's first run and
 * left out on purpose: both are org-wide, the nightly attendance close reads the first and the
 * second decides which agent every employee installs. Neither belongs in a step whose defining
 * feature is a Skip button — a consequential setting made in passing is worse than one made
 * deliberately in Settings, where the surrounding explanation lives.
 */
function SettingsStep({ onDone }: { onDone: () => void }) {
  const { serverTheme, serverPalette, saveTheme, savePalette } = useAppearance();
  const [theme, setTheme] = useState<AppearanceTheme>("system");
  const [palette, setPalette] = useState<string>("teal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (serverTheme) setTheme(serverTheme);
    if (serverPalette) setPalette(serverPalette);
  }, [serverTheme, serverPalette]);

  const choosePalette = (id: string) => {
    setPalette(id);
    // Apply immediately: picking a colour scheme from swatches alone is guesswork, and the whole
    // point of this step is that the choice is visible while you make it.
    applyPalette(id);
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([saveTheme(theme), savePalette(palette)]);
    } catch {
      // A preference that failed to store is not worth blocking anyone over; it stays applied for
      // this session and Settings can set it again.
      toast.error("Couldn't save your preferences", {
        description: "You can set them any time in Settings → Appearance.",
      });
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make it yours</DialogTitle>
          <DialogDescription>
            Optional — you can change any of this later in Settings → Appearance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                    theme === t.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input hover:bg-muted/40",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.name} — ${p.note}`}
                  onClick={() => choosePalette(p.id)}
                  aria-label={p.name}
                  className={cn(
                    "size-8 rounded-full ring-offset-2 ring-offset-[var(--background)] transition-all",
                    palette === p.id
                      ? "ring-foreground/60 ring-2"
                      : "ring-border ring-1 hover:ring-foreground/30",
                  )}
                  style={{ backgroundColor: p.swatch }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {/* Skip does NOT revert the live preview. Someone who tried a palette, liked it, and then
              pressed Skip meant "don't make me decide", not "undo that" — but nothing is stored, so
              the next sign-in shows the account's saved appearance. */}
          <Button variant="ghost" onClick={onDone} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
