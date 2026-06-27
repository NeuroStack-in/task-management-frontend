"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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

/**
 * Makes a widget card fill its (equal-height) grid cell. The card stretches to
 * h-full and its CardContent grows (flex-1) as a column so chart/heatmap
 * containers can fill the remaining space below the header. We deliberately do
 * NOT add `justify-between` here — that pushed content to the top and bottom
 * edges and left a dead band in the middle of every chart. Children fill from
 * the top; charts opt into `flex-1` themselves to consume the slack.
 */
const FILL_CARD =
  "h-full [&>*]:h-full [&>*]:[--card-spacing:--spacing(4)]! " +
  "[&_[data-slot=card-content]]:flex-1 [&_[data-slot=card-content]]:flex " +
  "[&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:flex-col";

function SortableWidget({
  id,
  span,
  children,
}: {
  id: string;
  span: 1 | 2;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/widget relative h-full",
        span === 2 && "sm:col-span-2",
        isDragging && "z-10",
      )}
    >
      {!isDragging ? (
        <button
          type="button"
          aria-label="Drag to reorder widget"
          {...attributes}
          {...listeners}
          className="absolute right-3 top-3 z-10 hidden size-7 cursor-grab items-center justify-center rounded-lg bg-muted text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:flex focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 group-hover/widget:flex group-hover/widget:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}

      {isDragging ? (
        // Dashed drop-placeholder; the floating DragOverlay shows the widget.
        <div className="relative h-full">
          <div className={cn("invisible", FILL_CARD)}>{children}</div>
          <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary/40 bg-primary/[0.04]" />
        </div>
      ) : (
        <div className={FILL_CARD}>{children}</div>
      )}
    </div>
  );
}

export function CustomizableDashboard({ data }: { data: DashboardData }) {
  const widgets = useDashboardStore((s) => s.widgets);
  const toggleWidget = useDashboardStore((s) => s.toggleWidget);
  const reorder = useDashboardStore((s) => s.reorder);
  const reset = useDashboardStore((s) => s.reset);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Skip any widget whose type no longer has a registry def (e.g. the removed
  // static ai-summary/alerts/deadlines/upcoming-tasks still present in older
  // persisted layouts) so they never show in the grid or the Customize list.
  const ordered = useMemo(
    () =>
      [...widgets]
        .filter((w) => WIDGET_REGISTRY[w.type])
        .sort((a, b) => a.position - b.position),
    [widgets],
  );
  const visible = ordered.filter((w) => w.visible);
  const visibleIds = visible.map((w) => w.id);
  const hiddenIds = ordered.filter((w) => !w.visible).map((w) => w.id);

  const activeWidget = activeId
    ? ordered.find((w) => w.id === activeId)
    : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
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
      <SortableWidget key={w.id} id={w.id} span={def.span}>
        {def.render(data)}
      </SortableWidget>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" />}
          >
            <SlidersHorizontal className="size-4" /> Customize
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-0">
            <div className="max-h-72 overflow-y-auto px-1 py-1">
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
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No widgets visible — use{" "}
          <span className="font-medium text-foreground">Customize</span> above to enable some.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
            {/* Bento grid: every row is a fixed ~19rem so chart widgets fill a
                readable, equal height instead of stretching into whitespace;
                each card fills its cell (see FILL_CARD). Charts span 2 columns;
                drop any widget anywhere — order = placement. */}
            <div className="grid auto-rows-[19rem] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map(renderWidget)}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeWidget ? (
              <div className="cursor-grabbing rounded-lg opacity-95 shadow-lg ring-1 ring-primary/30 [&>*]:[--card-spacing:--spacing(4)]!">
                {WIDGET_REGISTRY[activeWidget.type]?.render(data)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
