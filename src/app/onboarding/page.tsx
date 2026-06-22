import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Users, KeyRound, Settings2, LayoutDashboard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Onboarding" };

const STEPS = [
  { icon: Building2, title: "Organization Setup", desc: "Company info, timezone, and working hours." },
  { icon: Users, title: "Invite Team", desc: "Add teammates and assign departments." },
  { icon: KeyRound, title: "Create Roles", desc: "Define roles and permissions." },
  { icon: Settings2, title: "Tracking Configuration", desc: "Idle thresholds and screenshot frequency." },
  { icon: LayoutDashboard, title: "Personalize Dashboard", desc: "Choose the widgets you care about." },
];

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to WorkPulse</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A quick tour of how you&apos;ll get set up. (Simulated for the demo.)
      </p>
      <div className="mt-6 space-y-3">
        {STEPS.map((step, i) => (
          <Card key={step.title}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {i + 1}. {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button
        render={<Link href="/dashboard" />}
        nativeButton={false}
        className="mt-6 self-end"
      >
        Go to dashboard <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
