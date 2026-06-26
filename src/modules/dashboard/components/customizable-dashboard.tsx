"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Vertical gap between masonry items (px) — folded into the row-span. */
const MASONRY_GAP = 24;

function SortableWidget({
  id,
  span,
  masonry,
  children,
}: {
  id: string;
  span: 1 | 2;
  /** When true, set a measured row-span so the grid packs like masonry. */
  masonry: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // Measure content height → row-span (each grid row is 1px, see container).
  const contentRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<number | null>(null);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () =>
      setRows(Math.max(1, Math.round(el.offsetHeight) + MASONRY_GAP));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        gridRowEnd: masonry && rows ? `span ${rows}` : undefined,
      }}
      className={cn(
        "group/widget relative",
        span === 2 && "sm:col-span-2",
        isDragging && "z-10",
      )}
    >
      {!isDragging ? (
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="absolute right-3 top-3 z-10 hidden size-7 cursor-grab items-center justify-center rounded-lg bg-muted text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/widget:flex group-hover/widget:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
      <div ref={contentRef}>
        {isDragging ? (
          // Reserve the slot with a dashed drop-placeholder; the floating
          // preview (DragOverlay) shows the actual widget while dragging.
          <div className="relative">
            <div className="invisible [&>*]:[--card-spacing:--spacing(7)]!">
              {children}
            </div>
            <div className="absolute inset-0 rounded-[1.4rem] border-2 border-dashed border-primary/40 bg-primary/[0.04]" />
          </div>
        ) : (
          // Roomier internal padding than the default card spacing.
          <div className="[&>*]:[--card-spacing:--spacing(7)]!">{children}</div>
        )}
      </div>
    </div>
  );
}

export function CustomizableDashboard({ data }: { data: DashboardData }) {
  const widgets = useDashboardStore((s) => s.widgets);
  const toggleWidget = useDashboardStore((s) => s.toggleWidget);
  const reorder = useDashboardStore((s) => s.reorder);
  const reset = useDashboardStore((s) => s.reset);

  const [activeId, setActiveId] = useState<string | null>(null);
  // Masonry (measured row-spans) only kicks in after mount, so the server/
  // first paint uses a plain grid and never collapses to 1px rows.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
      <SortableWidget key={w.id} id={w.id} span={def.span} masonry={mounted}>
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
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
            {/* Masonry bento grid: each widget spans its own height (1px rows),
                so columns pack tight with no gaps. Charts span 2 columns; drop
                any widget anywhere — placement follows drag order. */}
            <div
              className={cn(
                "grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3",
                !mounted && "items-start gap-y-6",
              )}
              style={mounted ? { gridAutoRows: "1px" } : undefined}
            >
              {visible.map(renderWidget)}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeWidget ? (
              <div className="cursor-grabbing rounded-[1.4rem] opacity-95 shadow-2xl ring-1 ring-primary/30 [&>*]:[--card-spacing:--spacing(7)]!">
                {WIDGET_REGISTRY[activeWidget.type]?.render(data)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
