"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ONBOARDING_STEPS } from "@/modules/onboarding/steps";
import { cn } from "@/lib/utils";

function ToggleRow({
  label,
  description,
  defaultOn,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(Boolean(defaultOn));
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={on} onCheckedChange={setOn} />
    </label>
  );
}

function CheckRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(Boolean(defaultOn));
  return (
    <label className="flex items-center gap-2.5 rounded-lg border p-3 text-sm">
      <Checkbox checked={on} onCheckedChange={(v) => setOn(v === true)} />
      {label}
    </label>
  );
}

function InviteStep() {
  const [rows, setRows] = useState(3);
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Label htmlFor={`ob-invite-${i}`} className="sr-only">
            Teammate email {i + 1}
          </Label>
          <Input
            id={`ob-invite-${i}`}
            type="email"
            placeholder="teammate@acme.com"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((n) => n + 1)}
      >
        <Plus className="size-4" /> Add another
      </Button>
    </div>
  );
}

function StepContent({ index }: { index: number }) {
  switch (ONBOARDING_STEPS[index].key) {
    case "team":
      return <InviteStep />;
    case "roles":
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <CheckRow label="Admin" defaultOn />
          <CheckRow label="Manager" defaultOn />
          <CheckRow label="HR" />
          <CheckRow label="Finance" />
          <CheckRow label="Employee" defaultOn />
        </div>
      );
    case "tracking":
      return (
        <div className="space-y-3">
          <ToggleRow
            label="Idle detection"
            description="Pause timers after inactivity."
            defaultOn
          />
          <ToggleRow
            label="Screenshots"
            description="Capture periodic screenshots."
            defaultOn
          />
          <ToggleRow
            label="Silent mode"
            description="Track quietly in the background."
          />
        </div>
      );
    case "dashboard":
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <CheckRow label="Productivity heatmap" defaultOn />
          <CheckRow label="Attendance" defaultOn />
          <CheckRow label="Team comparison" defaultOn />
          <CheckRow label="Top employees" />
          <CheckRow label="Recent alerts" defaultOn />
          <CheckRow label="Billing overview" />
        </div>
      );
    default:
      return null;
  }
}

export function OnboardingWizard({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const last = ONBOARDING_STEPS.length - 1;

  const next = () => {
    if (step < last) setStep((s) => s + 1);
    else {
      toast.success("Setup complete", {
        description: "Your workspace is ready.",
      });
      router.push("/dashboard");
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="gap-3">
        {/* Stepper */}
        <div className="flex items-center gap-1.5">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <CardTitle>{ONBOARDING_STEPS[step].title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {ONBOARDING_STEPS.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{ONBOARDING_STEPS[step].hint}</p>
      </CardHeader>

      <CardContent>
        <StepContent index={step} />
      </CardContent>

      <div className="flex items-center justify-between px-(--card-spacing)">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button type="button" onClick={next}>
          {step === last ? (
            <>
              Finish <Check className="size-4" />
            </>
          ) : (
            <>
              Continue <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
