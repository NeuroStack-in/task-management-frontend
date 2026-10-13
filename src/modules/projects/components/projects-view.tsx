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
import { RefreshButton } from "@/components/shared/refresh-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";
import { Loader } from "@/components/shared/loader";
import type { ProjectFormValues } from "@/modules/projects/forms";
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
import { isTaskOverdue, projectStats, selectablePeople, toneDot, type UserMini } from "../lib";
import { useProjectsData } from "../use-projects-data";
import { useQueryState } from "../use-query-state";
import { ProjectCard } from "./project-card";
import { ProjectsList } from "./projects-list";
import { ProjectsStatBand } from "./projects-stat-band";
import { TasksView } from "./tasks-view";
import { ProjectFormDialog } from "./project-form-dialog";
import { Segmented } from "./parts";

type View = "projects" | "tasks";
type Layout = "grid" | "list";
type StatusFilter = ProjectStatus | "all" | "overdue";
type TaskFilter = TaskStatus | "all" | "overdue";

// The values each URL parameter may take — anything else in a link falls back to the default.
const VIEWS: readonly View[] = ["projects", "tasks"];
const LAYOUTS: readonly Layout[] = ["grid", "list"];
const STATUS_FILTERS: readonly StatusFilter[] = ["all", ...PROJECT_STATUS_ORDER, "overdue"];
const TASK_FILTERS: readonly TaskFilter[] = ["all", ...TASK_STATUS_ORDER, "overdue"];

export function ProjectsView() {
  const router = useRouter();
  const { can } = usePermissions();

  // Real backend. The server scopes the list (oversight sees all, members see theirs), so there's
  // no client-side member filter anymore.
  const {
    projects,
    tasks,
    taskSummary,
    userMap,
    departments,
    directoryAvailable,
    loading,
    tasksLoading,
    error,
    failedProjects,
    hiddenProjects,
    failedBoards,
    reload,
    createProject,
  } = useProjectsData();
  const visibleTasks = tasks;
  // The boards load after the projects (WP-315). Until they have, task-derived counts are unknown,
  // not zero.
  const tasksPending = tasksLoading && tasks.length === 0;

  // Tab, layout, filters and search live in the URL, so Back from a project, a refresh and a shared
  // link all return to the same view (QA audit 2026-10-08, WP-502).
  const [view, setView] = useQueryState<View>("view", "projects", VIEWS);
  const [layout, setLayout] = useQueryState<Layout>("layout", "grid", LAYOUTS);
  const [statusFilter, setStatusFilter] = useQueryState<StatusFilter>(
    "status",
    "all",
    STATUS_FILTERS,
  );
  const [taskFilter, setTaskFilter] = useQueryState<TaskFilter>("tasks", "all", TASK_FILTERS);
  const [query, setQuery] = useQueryState<string>("q", "");
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

  // `taskSummary` (from the hook) is the pair under each card's progress bar, which is the SERVER's
  // weighted `completion_pct` — a task in review counts 90%, so the bar can read 90% with nothing
  // signed off. The pair counts signed-off work against everything deliverable (blocked is out of
  // the denominator, being unadvanceable), from the same KPI read as the bar, and the label beside
  // it says "signed off" rather than "done" so the two are visibly answering different questions.

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

  // Publish the board's on-screen figures + active filters to the assistant, so questions about
  // "these projects" resolve against the same counts the user sees.
  useAssistantPageContext({
    facts: [
      { label: "View", value: view === "tasks" ? "Tasks" : "Projects" },
      { label: "Total projects", value: String(stats.total) },
      { label: "Active", value: String(stats.active) },
      { label: "On hold", value: String(statusCounts.on_hold) },
      // Named as the tile and the chip name them (WP-497).
      { label: "Past deadline", value: String(stats.atRisk) },
      { label: "With overdue tasks", value: tasksPending ? "loading" : String(overdueProjectIds.size) },
      { label: "Avg progress", value: `${stats.avgProgress}%` },
      { label: "Total tasks", value: tasksPending ? "loading" : String(visibleTasks.length) },
      ...(statusFilter !== "all" ? [{ label: "Status filter", value: statusFilter }] : []),
      ...(query.trim() ? [{ label: "Search", value: query.trim() }] : []),
    ],
  });

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
    // Deleted employees are excluded: a purged identity must not be assignable as lead/manager.
    () => selectablePeople(userMap),
    [userMap],
  );

  const membersFor = (p: Project): UserMini[] =>
    p.memberIds.map((id) => userMap[id]).filter(Boolean) as UserMini[];

  const openProject = (id: string) => router.push(`/projects/${id}`);

  const handleCreate = async (values: ProjectFormValues) => {
    let created;
    try {
      created = await createProject(values);
    } catch (err) {
      // The project wasn't created: the dialog stays open with everything typed (WP-300). Surface
      // the server's own message — the API returns specific, actionable validation errors ("end
      // date precedes start date"), and a generic line is indistinguishable from a network failure.
      toast.error("Couldn't create the project", {
        description:
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      });
      return;
    }
    // Created — so the dialog closes and the page moves on whatever happened to the team. A team
    // that only partly went on is said so, not hidden under "Project created" (WP-311).
    setNewOpen(false);
    if (created.notAdded === 0) {
      toast.success(`Project “${values.name}” created`);
    } else if (created.denied) {
      const manager = userMap[values.managerId]?.name;
      toast.warning(`Project “${values.name}” created — without its team`, {
        description: `Only its manager${manager ? `, ${manager},` : ""} can add people to it now. Ask them to add the ${created.requested === 1 ? "person" : `${created.requested} people`} you picked.`,
      });
    } else {
      toast.warning(`Project “${values.name}” created`, {
        description: `${created.notAdded} of the ${created.requested} people you picked couldn't be added. Add them from Edit project.`,
      });
    }
    router.push(`/projects/${created.id}`);
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
        actions={<RefreshButton onRefresh={reload} refreshing={loading} />}
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
              {
                value: "tasks",
                label: "Tasks",
                count: tasksPending ? undefined : visibleTasks.length,
              },
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
              {/* Projects with an overdue *task* — read from the boards, so unknown until they load. */}
              <FilterChip
                active={statusFilter === "overdue"}
                onClick={() => setStatusFilter("overdue")}
                label="Overdue"
                count={tasksPending ? undefined : statusCounts.overdue}
                dot="bg-destructive"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                active={taskFilter === "all"}
                onClick={() => setTaskFilter("all")}
                label="All"
                count={tasksPending ? undefined : taskCounts.all}
              />
              {TASK_STATUS_ORDER.map((s) => (
                <FilterChip
                  key={s}
                  active={taskFilter === s}
                  onClick={() => setTaskFilter(s)}
                  label={TASK_STATUS_META[s].label}
                  count={tasksPending ? undefined : taskCounts[s]}
                  dot={toneDot[TASK_STATUS_META[s].tone]}
                />
              ))}
              <FilterChip
                active={taskFilter === "overdue"}
                onClick={() => setTaskFilter("overdue")}
                label="Overdue"
                count={tasksPending ? undefined : taskCounts.overdue}
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
            aria-label="Search projects and tasks"
            className="pl-8"
          />
        </div>
      </div>

      {/* What wasn't loaded, said rather than left out in silence (WP-302). A 404 is a project this
          person may list but not open — the server opens a project only to its members or to
          someone who manages projects — so "retry" would not help there. */}
      {failedProjects > 0 || hiddenProjects > 0 || failedBoards > 0 ? (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm"
        >
          <span className="space-y-0.5">
            {failedProjects > 0 ? (
              <span className="block">
                {failedProjects} {failedProjects === 1 ? "project" : "projects"} couldn&apos;t be
                loaded and {failedProjects === 1 ? "isn't" : "aren't"} shown.
              </span>
            ) : null}
            {hiddenProjects > 0 ? (
              <span className="block">
                {hiddenProjects} {hiddenProjects === 1 ? "project" : "projects"} in your
                organization {hiddenProjects === 1 ? "isn't" : "aren't"} shown — you can open only
                the projects you&apos;re a member of.
              </span>
            ) : null}
            {failedBoards > 0 ? (
              <span className="block">
                Tasks from {failedBoards} {failedBoards === 1 ? "project" : "projects"}{" "}
                couldn&apos;t be loaded — they&apos;re missing from Tasks, the Overdue filter and
                search.
              </span>
            ) : null}
          </span>
          {failedProjects > 0 || failedBoards > 0 ? (
            <Button size="sm" variant="outline" onClick={reload}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Content */}
      {view === "projects" ? (
        projects.length === 0 ? (
          // Nothing to filter. "No projects match — try a different status" with a reset button that
          // did nothing was what a brand-new organization saw (QA audit 2026-10-08, WP-498).
          <EmptyState
            icon={FolderKanban}
            title={failedProjects > 0 ? "No projects to show" : "No projects yet"}
            description={
              failedProjects > 0
                ? "None of your projects could be loaded."
                : canCreate
                  ? "Create a project to start tracking its work."
                  : "When you're added to a project, it appears here."
            }
            action={
              canCreate && failedProjects === 0 ? (
                <Button onClick={() => setNewOpen(true)} className="gap-1.5">
                  <Plus />
                  New project
                </Button>
              ) : undefined
            }
          />
        ) : statusFilter === "overdue" && tasksPending ? (
          // The Overdue filter reads the boards; until they're in, it has nothing to say yet.
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader label="Loading tasks…" />
          </div>
        ) : filteredProjects.length > 0 ? (
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
      ) : tasksPending ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader label="Loading tasks…" />
        </div>
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
          departments={departments}
          peopleNote={
            directoryAvailable
              ? undefined
              : "Only people on projects you can see are listed — you don't have access to the employee directory. An admin can add anyone else."
          }
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
  /** Omitted while the number isn't known yet — a "0" there would be a claim. */
  count?: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // The active filter was told by colour alone (WP-508).
      aria-pressed={active}
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
      {count !== undefined ? (
        <span
          className={cn(
            "tabular-nums",
            active ? "text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
