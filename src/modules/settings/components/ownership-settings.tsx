"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Lock,
  TriangleAlert,
  ArrowLeftRight,
  Trash2,
  ChevronDown,
  Check,
  Download,
  CheckCircle2,
  ShieldOff,
  FolderX,
  ReceiptText,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";
import { WILDCARD } from "@/constants/permissions";
import { users, organization, projects, tasks } from "@/lib/data";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** What permanent deletion removes — shown before the user commits. */
const CONSEQUENCES = [
  {
    icon: ShieldOff,
    text: "Every member immediately loses access and their accounts are removed.",
  },
  {
    icon: FolderX,
    text: "All projects, tasks, time entries, reports, and activity history are erased.",
  },
  {
    icon: ReceiptText,
    text: "The subscription is cancelled and billing for this organization stops.",
  },
];

export function OwnershipSettings() {
  const router = useRouter();
  const { role } = usePermissions();
  const currentUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isOwner = role?.permissions.includes(WILDCARD) ?? false;

  // Eligible successors: active teammates other than the current owner.
  const candidates = useMemo(
    () =>
      users.filter((u) => u.status === "active" && u.id !== currentUser?.id),
    [currentUser?.id],
  );

  const [newOwnerId, setNewOwnerId] = useState<string | null>(null);
  const newOwner = candidates.find((u) => u.id === newOwnerId) ?? null;

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferConfirm, setTransferConfirm] = useState("");

  const [exported, setExported] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const canDelete = isOwner && exported && acknowledged;

  function handleExport() {
    const archive = {
      organization,
      members: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        jobTitle: u.jobTitle,
        department: u.department,
        team: u.team,
        status: u.status,
      })),
      projects,
      tasks,
      counts: {
        members: users.length,
        projects: projects.length,
        tasks: tasks.length,
      },
    };
    const blob = new Blob([JSON.stringify(archive, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, `${slug(organization.name)}-export.json`);
    setExported(true);
    toast.success("Data exported", {
      description: `${slug(organization.name)}-export.json · ${users.length} members, ${projects.length} projects`,
    });
  }

  function handleTransfer() {
    if (!newOwner) return;
    setTransferOpen(false);
    setTransferConfirm("");
    toast.success("Ownership transferred", {
      description: `${newOwner.name} is now the Organization Owner.`,
    });
    setNewOwnerId(null);
  }

  function handleDelete() {
    setDeleteOpen(false);
    toast.success("Organization deleted", {
      description: `${organization.name} and all its data have been removed.`,
    });
    logout();
    router.push("/");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ownership & deletion"
        description="Transfer the organization to another owner, export your data, or permanently close this organization."
      />

      {!isOwner && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Only the{" "}
          <span className="font-medium text-foreground">Organization Owner</span>{" "}
          can transfer ownership or close the organization.
        </div>
      )}

      {/* ── Transfer ownership ── */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
            <ArrowLeftRight className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Transfer ownership
            </h3>
            <p className="text-sm text-muted-foreground">
              Hand the Organization Owner role to another active member. They gain
              full, unrestricted access and your role changes to Admin.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  disabled={!isOwner}
                  className="w-full justify-between gap-2 sm:w-72"
                />
              }
            >
              {newOwner ? (
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-5">
                    <AvatarImage src={newOwner.avatarUrl} alt={newOwner.name} />
                    <AvatarFallback className="text-[10px]">
                      {initials(newOwner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{newOwner.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Select new owner…</span>
              )}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-72 w-72 overflow-y-auto"
            >
              {candidates.map((u) => (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => setNewOwnerId(u.id)}
                  className="gap-2"
                >
                  <Avatar className="size-6">
                    <AvatarImage src={u.avatarUrl} alt={u.name} />
                    <AvatarFallback className="text-[10px]">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {u.jobTitle}
                    </span>
                  </span>
                  <Check
                    className={cn(
                      "size-4",
                      u.id === newOwnerId ? "opacity-100" : "opacity-0",
                    )}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            disabled={!isOwner || !newOwner}
            onClick={() => setTransferOpen(true)}
          >
            <ArrowLeftRight className="size-4" /> Transfer ownership
          </Button>
        </div>
      </Card>

      {/* ── Export data ── */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Download className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Download organization data
            </h3>
            <p className="text-sm text-muted-foreground">
              Download a complete copy of your organization — members, projects,
              tasks, and configuration — as a JSON archive. Required before you can
              close the organization.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {exported ? (
            <span className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Data downloaded
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              No download yet for this session.
            </span>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            {exported ? "Download again" : "Download data"}
          </Button>
        </div>
      </Card>

      {/* ── Close / delete organization ── */}
      <Card className="gap-0 border border-destructive/30 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Close this organization
            </h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>
              . This cannot be undone.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-destructive/20 px-6 py-5">
          <ul className="space-y-2.5">
            {CONSEQUENCES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>

          {!exported && (
            <p className="text-sm text-muted-foreground">
              Download your organization data above before continuing.
            </p>
          )}

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(Boolean(v))}
              disabled={!isOwner || !exported}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              I understand this permanently deletes{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>{" "}
              and all of its data, and that it cannot be recovered.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end border-t border-destructive/20 bg-destructive/5 px-6 py-4">
          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={() => {
              setDeleteConfirm("");
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" /> Delete organization
          </Button>
        </div>
      </Card>

      {/* ── Transfer confirmation ── */}
      <Dialog
        open={transferOpen}
        onOpenChange={(o) => {
          setTransferOpen(o);
          if (!o) setTransferConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership?</DialogTitle>
            <DialogDescription>
              {newOwner?.name} will become the Organization Owner with full
              access, and your role will change to Admin. Type{" "}
              <span className="font-medium text-foreground">
                {newOwner?.email}
              </span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={transferConfirm}
            onChange={(e) => setTransferConfirm(e.target.value)}
            placeholder={newOwner?.email}
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={transferConfirm.trim() !== newOwner?.email}
              onClick={handleTransfer}
            >
              Transfer ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>{" "}
              and signs you out. Type{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={organization.name}
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm.trim() !== organization.name}
              onClick={handleDelete}
            >
              <Trash2 className="size-4" /> Delete organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
