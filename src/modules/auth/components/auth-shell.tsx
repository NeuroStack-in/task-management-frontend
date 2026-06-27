import Link from "next/link";
import { Logo } from "@/modules/marketing/logo";

/** Centered card shell for the secondary auth pages (forgot / mfa / reset). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" aria-label="WorkPulse home" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
