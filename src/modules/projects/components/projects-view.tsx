"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";
import { Loader } from "@/components/shared/loader";
import type { ProjectFormValues } from "@/stores/projects.store";
import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_ORDER,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskStatus,
} from "../types";
import { isTaskOverdue, projectStats, toneDot, type UserMini } from "../lib";
import { useProjectsData } from "../use-projects-data";
import { ProjectCard } from "./project-card";
import { ProjectsList } from "./projects-list";
import { ProjectsStatBand } from "./projects-stat-band";
import { TasksView } from "./tasks-view";
import { ProjectFormDialog } from "./project-form-dialog";
import { Segmented } from "./parts";

type View = "projects" | "tasks";
type Layout = "grid" | "list";
type StatusFilter = ProjectStatus | "all" | "overdue";

export function ProjectsView() {
  const router = useRouter();
  const { can } = usePermissions();

  // Real backend. The server scopes the list (oversight sees all, members see theirs), so there's
  // no client-side member filter anymore.
  const { projects, tasks, userMap, loading, error, reload, createProject } =
    useProjectsData();
  const visibleTasks = tasks;

  const [view, setView] = useState<View>("projects");
  const [layout, setLayout] = useState<Layout>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskStatus | "all" | "overdue">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const stats = useMemo(() => projectStats(projects), [projects]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of visibleTasks) {
      const arr = map.get(t.projectId);
      if (arr) arr.push(t);
      else map.set(t.projectId, [t]);
    }
    return map;
  }, [visibleTasks]);

  const projectMap = useMemo(() => {
    const map: Record<string, Project> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const taskSummary = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const p of projects) {
      const list = tasksByProject.get(p.id) ?? [];
      map[p.id] = {
        done: list.filter((t) => t.status === "done").length,
        total: list.length,
      };
    }
    return map;
  }, [projects, tasksByProject]);

  // Projects carrying at least one open, past-due task.
  const overdueProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) {
      const list = tasksByProject.get(p.id) ?? [];
      if (list.some(isTaskOverdue)) ids.add(p.id);
    }
    return ids;
  }, [projects, tasksByProject]);

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: projects.length,
      active: 0,
      on_hold: 0,
      completed: 0,
      overdue: overdueProjectIds.size,
    };
    for (const p of projects) c[p.status] += 1;
    return c;
  }, [projects, overdueProjectIds]);

  // Tasks matching the shared search (title or parent project name/key).
  const searchedTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleTasks;
    return visibleTasks.filter((t) => {
      const project = projectMap[t.projectId];
      return (
        t.title.toLowerCase().includes(q) ||
        (project?.name.toLowerCase().includes(q) ?? false) ||
        (project?.key.toLowerCase().includes(q) ?? false)
      );
    });
  }, [visibleTasks, projectMap, query]);

  const taskCounts = useMemo(() => {
    const c: Record<TaskStatus | "all" | "overdue", number> = {
      all: searchedTasks.length,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      closed: 0,
      blocked: 0,
      overdue: 0,
    };
    for (const t of searchedTasks) {
      c[t.status] += 1;
      if (isTaskOverdue(t)) c.overdue += 1;
    }
    return c;
  }, [searchedTasks]);

  // Projects matching the search: by name/key OR by a task title inside them.
  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter === "overdue") {
        if (!overdueProjectIds.has(p.id)) return false;
      } else if (statusFilter !== "all" && p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      if (
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
        return true;
      const list = tasksByProject.get(p.id) ?? [];
      return list.some((t) => t.title.toLowerCase().includes(q));
    });
  }, [projects, statusFilter, query, tasksByProject, overdueProjectIds]);

  const leads = useMemo(
    () => Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name)),
    [userMap],
  );

  const membersFor = (p: Project): UserMini[] =>
    p.memberIds.map((id) => userMap[id]).filter(Boolean) as UserMini[];

  const openProject = (id: string) => router.push(`/projects/${id}`);

  const handleCreate = async (values: ProjectFormValues) => {
    try {
      const id = await createProject(values);
      toast.success(`Project “${values.name}” created`);
      router.push(`/projects/${id}`);
    } catch (err) {
      // Surface the server's own message. The API returns specific, actionable validation errors
      // ("manager_user_id is required", "billable is required", "end_date precedes start_date");
      // a bare `catch` swallowed all of them into one generic line, which is indistinguishable
      // from a network failure and leaves the user with nothing to act on.
      toast.error("Couldn't create the project", {
        description:
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      });
    }
  };

  const canCreate = can("projects:create");

  if (loading && projects.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader label="Loading projects…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projects" description="Your organization's projects." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <TriangleAlert className="size-5 text-warning" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Your projects — status, progress, and delivery at a glance."
      />

      {/* KPI stat band */}
      <ProjectsStatBand stats={stats} />

      {/* Toolbar — row 1: tabs · status filters · view toggle · New project;
          row 2: search beneath the tabs. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Segmented
            options={[
              { value: "projects", label: "Projects", count: projects.length },
              { value: "tasks", label: "Tasks", count: visibleTasks.length },
            ]}
            value={view}
            onChange={setView}
          />

          {view === "projects" ? (
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
              <FilterChip
                active={statusFilter === "overdue"}
                onClick={() => setStatusFilter("overdue")}
                label="Overdue"
                count={statusCounts.overdue}
                dot="bg-destructive"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={taskFilter === "all"}
                onClick={() => setTaskFilter("all")}
                label="All"
                count={taskCounts.all}
              />
              {TASK_STATUS_ORDER.map((s) => (
                <FilterChip
                  key={s}
                  active={taskFilter === s}
                  onClick={() => setTaskFilter(s)}
                  label={TASK_STATUS_META[s].label}
                  count={taskCounts[s]}
                  dot={toneDot[TASK_STATUS_META[s].tone]}
                />
              ))}
              <FilterChip
                active={taskFilter === "overdue"}
                onClick={() => setTaskFilter("overdue")}
                label="Overdue"
                count={taskCounts.overdue}
                dot="bg-destructive"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2.5">
            {view === "projects" ? (
              <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-background p-0.5">
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
            ) : null}

            {canCreate ? (
              <Button
                onClick={() => setNewOpen(true)}
                className="shrink-0 gap-1.5"
              >
                <Plus />
                New project
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by project, task, or ID…"
            className="pl-8"
          />
        </div>
      </div>

      {/* Content */}
      {view === "projects" ? (
        filteredProjects.length > 0 ? (
          layout === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredProjects.map((p) => {
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
              projects={filteredProjects}
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
        <TasksView
          tasks={searchedTasks}
          filter={taskFilter}
          projectMap={projectMap}
          query={query}
          onOpenProject={openProject}
        />
      )}

      {canCreate ? (
        <ProjectFormDialog
          mode="create"
          open={newOpen}
          onOpenChange={setNewOpen}
          leads={leads}
          onSubmit={handleCreate}
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
