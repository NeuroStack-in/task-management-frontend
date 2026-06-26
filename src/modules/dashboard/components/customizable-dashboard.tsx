"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, SlidersHorizontal, RotateCcw } from "lucide-react";
import { useDashboardStore } from "@/stores/dashboard.store";
import {
  WIDGET_REGISTRY,
  type DashboardData,
} from "@/modules/dashboard/widget-registry";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DashboardWidget } from "@/types";

function SortableWidget({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/widget relative", isDragging && "z-10 opacity-70")}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="absolute right-3 top-3 z-10 hidden size-7 cursor-grab items-center justify-center rounded-lg bg-muted text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/widget:flex group-hover/widget:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      {/* Roomier internal padding than the default card spacing. */}
      <div className="[&>*]:[--card-spacing:--spacing(7)]!">{children}</div>
    </div>
  );
}

export function CustomizableDashboard({ data }: { data: DashboardData }) {
  const widgets = useDashboardStore((s) => s.widgets);
  const toggleWidget = useDashboardStore((s) => s.toggleWidget);
  const reorder = useDashboardStore((s) => s.reorder);
  const reset = useDashboardStore((s) => s.reset);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = useMemo(
    () => [...widgets].sort((a, b) => a.position - b.position),
    [widgets],
  );
  const visible = ordered.filter((w) => w.visible);
  const visibleIds = visible.map((w) => w.id);
  const hiddenIds = ordered.filter((w) => !w.visible).map((w) => w.id);

  // Two zones: a wide column for the big chart widgets (span 2) and a narrow
  // column for the rest. Each zone packs vertically with no stretching, so the
  // charts keep their width while short widgets have no empty space or gaps.
  const wide = visible.filter((w) => WIDGET_REGISTRY[w.type]?.span === 2);
  const narrow = visible.filter((w) => WIDGET_REGISTRY[w.type]?.span !== 2);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleIds.indexOf(String(active.id));
    const newIndex = visibleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newVisible = arrayMove(visibleIds, oldIndex, newIndex);
    reorder([...newVisible, ...hiddenIds]);
  };

  const renderWidget = (w: DashboardWidget) => {
    const def = WIDGET_REGISTRY[w.type];
    if (!def) return null;
    return (
      <SortableWidget key={w.id} id={w.id}>
        {def.render(data)}
      </SortableWidget>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Your widgets
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="gap-2" />}
          >
            <SlidersHorizontal className="size-4" /> Customize
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-0">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Show widgets
            </p>
            <div className="max-h-72 overflow-y-auto px-1 pb-1">
              {ordered.map((w) => (
                <label
                  key={w.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={w.visible}
                    onCheckedChange={() => toggleWidget(w.id)}
                  />
                  <span className="truncate">{w.title}</span>
                </label>
              ))}
            </div>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={reset}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-4" /> Reset layout
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[1.4rem] border border-dashed p-10 text-center text-sm text-muted-foreground">
          No widgets shown. Use{" "}
          <span className="font-medium text-foreground">Customize</span> to add
          some.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {wide.length > 0 ? (
                <div className="flex min-w-0 flex-col gap-6 lg:flex-[2]">
                  {wide.map(renderWidget)}
                </div>
              ) : null}
              {narrow.length > 0 ? (
                <div className="flex min-w-0 flex-col gap-6 lg:flex-[1]">
                  {narrow.map(renderWidget)}
                </div>
              ) : null}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
