"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_ORDER,
  type Project,
  type ProjectStatus,
  type Task,
} from "../types";
import {
  portfolioStats,
  toneDot,
  type UserMini,
} from "../lib";
import { ProjectCard } from "./project-card";
import { ProjectsList } from "./projects-list";
import { ProjectsStatBand } from "./projects-stat-band";
import { ProjectDetailSheet } from "./project-detail-sheet";
import { MyTasksView } from "./my-tasks-view";
import {
  NewProjectDialog,
  type NewProjectInput,
} from "./new-project-dialog";
import { Segmented } from "./parts";

type View = "portfolio" | "mine";
type Layout = "grid" | "list";
type StatusFilter = ProjectStatus | "all";

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  userMap: Record<string, UserMini>;
}

export function ProjectsView({
  projects,
  tasks,
  userMap,
}: ProjectsViewProps) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const { can } = usePermissions();

  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [view, setView] = useState<View>("portfolio");
  const [layout, setLayout] = useState<Layout>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const localSeq = useRef(0);
  const didInit = useRef(false);

  // Role-aware default: members without manage access land on "My tasks".
  useEffect(() => {
    if (didInit.current || !hydrated) return;
    didInit.current = true;
    if (!can("projects:manage")) setView("mine");
  }, [hydrated, can]);

  const stats = useMemo(() => portfolioStats(localProjects), [localProjects]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = map.get(t.projectId);
      if (arr) arr.push(t);
      else map.set(t.projectId, [t]);
    }
    return map;
  }, [tasks]);

  const projectMap = useMemo(() => {
    const map: Record<string, Project> = {};
    for (const p of localProjects) map[p.id] = p;
    return map;
  }, [localProjects]);

  const taskSummary = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const p of localProjects) {
      const list = tasksByProject.get(p.id) ?? [];
      map[p.id] = {
        done: list.filter((t) => t.status === "done").length,
        total: list.length,
      };
    }
    return map;
  }, [localProjects, tasksByProject]);

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: localProjects.length,
      active: 0,
      on_hold: 0,
      completed: 0,
      archived: 0,
    };
    for (const p of localProjects) c[p.status] += 1;
    return c;
  }, [localProjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return localProjects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
      );
    });
  }, [localProjects, statusFilter, query]);

  const myTasks = useMemo(
    () => (user ? tasks.filter((t) => t.assigneeId === user.id) : []),
    [tasks, user],
  );

  const leads = useMemo(
    () =>
      Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name)),
    [userMap],
  );

  const membersFor = (p: Project): UserMini[] =>
    p.memberIds.map((id) => userMap[id]).filter(Boolean) as UserMini[];

  const openProject = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const handleCreate = (input: NewProjectInput) => {
    localSeq.current += 1;
    const lead = userMap[input.leadUserId];
    const project: Project = {
      id: `proj-local-${localSeq.current}`,
      name: input.name,
      key: input.key,
      status: input.status,
      progress: 0,
      leadUserId: input.leadUserId,
      memberIds: lead ? [lead.id] : [],
      department: input.department,
      budget: input.budget,
      spent: 0,
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: input.dueDate,
      velocity: [6, 9, 8, 11, 10, 13, 15],
    };
    setLocalProjects((prev) => [project, ...prev]);
    toast.success(`Project “${project.name}” created`, {
      description: "Added to your portfolio for this session.",
    });
  };

  const selected = selectedId ? projectMap[selectedId] ?? null : null;
  const canCreate = can("projects:create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every project across the organization — status, budget health, and delivery at a glance."
        actions={
          canCreate ? (
            <Button onClick={() => setNewOpen(true)} className="gap-1.5">
              <Plus />
              New project
            </Button>
          ) : null
        }
      />

      {/* KPI stat band */}
      <ProjectsStatBand stats={stats} />

      {/* View toggle + tools */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          options={[
            { value: "portfolio", label: "Portfolio", count: localProjects.length },
            { value: "mine", label: "My tasks", count: myTasks.length },
          ]}
          value={view}
          onChange={setView}
        />

        {view === "portfolio" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                label="All"
                count={statusCounts.all}
              />
              {PROJECT_STATUS_ORDER.map((s) => (
                <FilterChip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  label={PROJECT_STATUS_META[s].label}
                  count={statusCounts[s]}
                  dot={toneDot[PROJECT_STATUS_META[s].tone]}
                />
              ))}
            </div>
            <div className="relative sm:w-52">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="pl-8"
              />
            </div>

            {/* Grid / list layout toggle */}
            <div className="inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
              <LayoutToggleButton
                active={layout === "grid"}
                onClick={() => setLayout("grid")}
                icon={LayoutGrid}
                label="Grid view"
              />
              <LayoutToggleButton
                active={layout === "list"}
                onClick={() => setLayout("list")}
                icon={List}
                label="List view"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Content */}
      {view === "portfolio" ? (
        filtered.length > 0 ? (
          layout === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((p) => {
                const summary = taskSummary[p.id] ?? { done: 0, total: 0 };
                return (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    members={membersFor(p)}
                    doneCount={summary.done}
                    totalCount={summary.total}
                    onOpen={() => openProject(p.id)}
                  />
                );
              })}
            </div>
          ) : (
            <ProjectsList
              projects={filtered}
              userMap={userMap}
              taskSummary={taskSummary}
              onOpen={openProject}
            />
          )
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects match"
            description="Try a different status or clear your search."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setQuery("");
                }}
              >
                Reset filters
              </Button>
            }
          />
        )
      ) : (
        <MyTasksView
          tasks={myTasks}
          projectMap={projectMap}
          onOpenProject={openProject}
        />
      )}

      <ProjectDetailSheet
        project={selected}
        tasks={selected ? tasksByProject.get(selected.id) ?? [] : []}
        userMap={userMap}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {canCreate ? (
        <NewProjectDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          leads={leads}
          onCreate={handleCreate}
        />
      ) : null}
    </div>
  );
}

function LayoutToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {dot ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            active ? "bg-primary-foreground/80" : dot,
          )}
        />
      ) : null}
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-primary-foreground/80" : "text-muted-foreground/70",
        )}
      >
        {count}
      </span>
    </button>
  );
}
