"use client";

/**
 * "Add whole team" for the project form — a **snapshot**.
 *
 * Pick a team; its current members are merged into the project's member list. It is a one-time add,
 * not a live link: later team changes don't touch the project, which is what "will be added" implies
 * and avoids a whole class of sync surprises.
 *
 * It only reports how many it added, and warns if a team member isn't in the pickable directory
 * (deactivated, or outside the caller's reach) — those can't be added, and a silent shortfall would
 * read as the team being smaller than it is.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTeams,
  listTeamMembers,
  type ApiTeam,
} from "@/modules/employees/services/employees.service";

export function AddFromTeam({
  knownUserIds,
  onAdd,
}: {
  /** The ids the project form can actually add (its `leads` directory). Team members outside this
   *  can't be selected, so we surface them rather than drop them silently. */
  knownUserIds: Set<string>;
  onAdd: (userIds: string[]) => void;
}) {
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    // Best-effort: if teams can't be read, the control just shows nothing to pick — the manual
    // member picker below still works.
    listTeams()
      .then((t) => live && setTeams(t.filter((x) => (x.member_count ?? 0) > 0)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function addTeam() {
    if (!teamId || loading) return;
    setLoading(true);
    try {
      const members = await listTeamMembers(teamId);
      const addable = members.filter((m) => knownUserIds.has(m.user_id));
      const missing = members.length - addable.length;
      if (addable.length === 0) {
        toast.info(
          missing > 0
            ? "None of this team's members can be added here."
            : "This team has no members yet.",
        );
        return;
      }
      onAdd(addable.map((m) => m.user_id));
      const name = teams.find((t) => t.id === teamId)?.name ?? "team";
      toast.success(
        `Added ${addable.length} from ${name}` +
          (missing > 0 ? ` (${missing} couldn't be added)` : ""),
      );
      setTeamId("");
    } catch {
      toast.error("Couldn't load that team's members.");
    } finally {
      setLoading(false);
    }
  }

  // Nothing to offer — don't show an empty control.
  if (teams.length === 0) return null;

  return (
    <div className="mb-2 flex items-center gap-2">
      <Users className="text-muted-foreground size-4 shrink-0" />
      <Select
        value={teamId}
        onValueChange={(v) => setTeamId(v as string)}
        disabled={loading}
        items={Object.fromEntries(teams.map((t) => [t.id, t.name]))}
      >
        <SelectTrigger className="h-9 flex-1">
          <SelectValue placeholder="Add everyone from a team…" />
        </SelectTrigger>
        <SelectContent>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name} · {t.member_count ?? 0}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addTeam}
        disabled={!teamId || loading}
      >
        <Plus className="size-3.5" /> Add
      </Button>
    </div>
  );
}
