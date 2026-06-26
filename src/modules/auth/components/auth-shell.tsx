import Link from "next/link";
import { Activity } from "lucide-react";

/** Centered card shell for the secondary auth pages (forgot / mfa / reset). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">WorkPulse</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
