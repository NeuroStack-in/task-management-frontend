"use client";

import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  ArrowLeft,
  Activity,
  Download,
  FileText,
  Sheet,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { usePageTitle } from "@/stores/page-header.store";
import { cn } from "@/lib/utils";
import { useEmployeeProfile, type EmployeeProfileVM } from "../use-employee-profile";

const STATUS_META: Record<EmployeeProfileVM["status"], string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
};

const fileStem = (p: EmployeeProfileVM) => (p.empId ?? p.id).replace(/[^\w-]/g, "") || "employee";

function reportRows(p: EmployeeProfileVM): (string)[][] {
  const v = (s: string | null) => s ?? "—";
  return [
    ["Field", "Value"],
    ["Employee", p.name],
    ["Employee ID", v(p.empId)],
    ["Role", v(p.roleName)],
    ["Title", v(p.title)],
    ["Department", v(p.department)],
    ["Team", v(p.team)],
    ["Status", p.status],
    ["Email", p.email],
    ["Phone", v(p.phone)],
    ["Location", v(p.location)],
    ["Hire date", v(p.hireDate)],
  ];
}

function exportCsv(p: EmployeeProfileVM) {
  downloadBlob(
    new Blob([Papa.unparse(reportRows(p))], { type: "text/csv;charset=utf-8;" }),
    `${fileStem(p)}-profile.csv`,
  );
  toast.success("Profile exported", { description: `${fileStem(p)}-profile.csv` });
}

function exportPdf(p: EmployeeProfileVM) {
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(18);
  doc.text(p.name, 14, y);
  doc.setFontSize(10);
  doc.setTextColor(120);
  y += 6;
  doc.text([p.title, p.department, p.empId].filter(Boolean).join(" · ") || p.email, 14, y);
  doc.setDrawColor(210);
  y += 6;
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(10);
  for (const [k, val] of reportRows(p).slice(1)) {
    doc.setTextColor(120);
    doc.text(k, 14, y);
    doc.setTextColor(20);
    doc.text(String(val), 60, y);
    y += 6;
  }
  doc.save(`${fileStem(p)}-profile.pdf`);
  toast.success("Profile exported", { description: `${fileStem(p)}-profile.pdf` });
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function EmployeeProfile({ id }: { id: string }) {
  const router = useRouter();
  const { profile, loading, error, notFound, reload } = useEmployeeProfile(id);

  usePageTitle(
    profile?.name ?? "Employee",
    profile ? [profile.title, profile.department].filter(Boolean).join(" · ") : "",
  );

  if (loading && !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading profile…" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-16">
        <EmptyState
          icon={Users}
          title="Employee not found"
          description="This employee doesn't exist or you don't have access."
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/employees")}>
              Back to employees
            </Button>
          }
        />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Profile unavailable."}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  const p = profile;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.push("/employees")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Employees
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Download className="size-4" /> Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportPdf(p)}>
              <FileText className="size-4" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportCsv(p)}>
              <Sheet className="size-4" /> CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Identity */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold">{p.name}</h1>
              {p.empId ? (
                <span className="font-mono text-xs text-muted-foreground">{p.empId}</span>
              ) : null}
              <Badge className={cn("capitalize", STATUS_META[p.status])}>{p.status}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[p.title, p.department].filter(Boolean).join(" · ") || p.email}
            </p>
            {p.roleName ? (
              <Badge variant="outline" className="mt-2 font-normal">
                {p.roleName}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Detail label="Email" value={p.email} />
          <Detail label="Phone" value={p.phone} />
          <Detail label="Employee ID" value={p.empId} />
          <Detail label="Department" value={p.department} />
          <Detail label="Team" value={p.team} />
          <Detail label="Role" value={p.roleName} />
          <Detail label="Location" value={p.location} />
          <Detail label="Hire date" value={p.hireDate} />
          <Detail label="Status" value={p.status} />
        </CardContent>
      </Card>

      {/* Activity — agent-gated, honest */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Activity className="size-4" />
            </span>
            Activity &amp; productivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Productivity scores, tracked hours, and this person&apos;s projects come from the desktop
            agent&apos;s activity data, which isn&apos;t reporting yet — so they&apos;re intentionally
            blank rather than estimated. They&apos;ll appear here once monitoring is live.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
