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
import {
  GripVertical,
  SlidersHorizontal,
  RotateCcw,
  X,
} from "lucide-react";
import { useDashboardStore, type DashboardWidget } from "@/stores/dashboard.store";
import { useDashboardLayoutSync } from "@/modules/dashboard/use-layout-sync";
import { widgetPermission } from "@/modules/dashboard/services/dashboard.service";
import { usePermissions } from "@/hooks/use-permissions";
import { WIDGET_REGISTRY, type DashboardData } from "@/modules/dashboard/widget-registry";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Makes a widget card fill its tile and distribute its content top-to-bottom:
 * the card stretches to h-full and its CardContent grows (flex-1, justify-between).
 */
const FILL_CARD =
  "h-full [&>*]:h-full [&>*]:[--card-spacing:--spacing(4)]! " +
  "[&_[data-slot=card-content]]:flex-1 [&_[data-slot=card-content]]:flex " +
  "[&_[data-slot=card-content]]:flex-col [&_[data-slot=card-content]]:justify-between";

/**
 * Tile width: three per row on desktop (two on tablet, one on mobile). `grow`
 * lets the cards on a partial LAST row expand to fill the width — a lone last
 * card spans the whole row, two split it in half — while every complete row
 * stays a clean 3-up. (-0.02px guards against sub-pixel rounding wrapping a full
 * row early; the gap is 1.25rem = gap-5.)
 */
const TILE =
  "grow min-w-0 basis-full " +
  "sm:basis-[calc((100%-1.25rem)/2-0.02px)] " +
  "xl:basis-[calc((100%-2.5rem)/3-0.02px)]";

/**
 * A gentle floor for the first row so the top widgets stay visually balanced
 * without ballooning to fill the viewport. Widgets otherwise size to their
 * content; rows below sit under the fold (scroll to reveal — no view-more toggle).
 */
const HERO_ROW_FILL = "xl:min-h-[22rem]";

function SortableWidget({
  id,
  heroFill,
  onRemove,
  children,
}: {
  id: string;
  /** First-row tile: stretch to fill the viewport down to the sidebar bottom. */
  heroFill?: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/widget relative flex flex-col",
        TILE,
        heroFill && HERO_ROW_FILL,
        isDragging && "z-10",
      )}
    >
      {!isDragging ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/widget:opacity-100">
          <button
            type="button"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
            className="flex size-7 cursor-grab items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Remove widget"
            onClick={onRemove}
            className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {isDragging ? (
        // Dashed drop-placeholder; the floating DragOverlay shows the widget.
        <div className="relative h-full">
          <div className={cn("invisible", FILL_CARD)}>{children}</div>
          <div className="absolute inset-0 rounded-[1.4rem] border-2 border-dashed border-primary/40 bg-primary/[0.04]" />
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

  // Server persistence: hydrate from `GET /v1/me/dashboard-layouts` on mount, debounce-save layout
  // changes to `PUT /v1/me/dashboard-layouts/oversight`. Local store stays the optimistic truth.
  useDashboardLayoutSync();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { can } = usePermissions();

  const ordered = useMemo(
    () => [...widgets].sort((a, b) => a.position - b.position),
    [widgets],
  );
  // Catalog `required_perm` pre-filter (mirrors `wp-contracts::widgets`): a widget whose catalog
  // permission the user lacks is neither rendered nor offered in Customize — matching the server's
  // per-widget gate, and keeping unpermitted placements out of the layout PUT.
  const permitted = ordered.filter((w) => can(widgetPermission(w.type)));
  const blockedIds = ordered
    .filter((w) => !can(widgetPermission(w.type)))
    .map((w) => w.id);
  const visible = permitted.filter((w) => w.visible);
  const visibleIds = visible.map((w) => w.id);
  const hiddenIds = permitted.filter((w) => !w.visible).map((w) => w.id);

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
    // Reorder within the visible set; hidden widgets keep their order behind it, and
    // permission-blocked widgets keep a stable position at the tail (never index -1).
    reorder([...newVisible, ...hiddenIds, ...blockedIds]);
  };

  const renderWidget = (w: DashboardWidget, heroFill: boolean) => {
    const def = WIDGET_REGISTRY[w.type];
    if (!def) return null;
    return (
      <SortableWidget
        key={w.id}
        id={w.id}
        heroFill={heroFill}
        onRemove={() => toggleWidget(w.id)}
      >
        {def.render(data)}
      </SortableWidget>
    );
  };

  return (
    // `data-tour` anchors for the product tour. Deliberately on the header and the Customize
    // trigger, NOT on a widget: widgets are user-removable and permission-filtered, so a step
    // anchored to one would stall for exactly the people who tidied their dashboard.
    <div className="space-y-4" data-tour="dash:widgets">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Your widgets
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                data-tour="dash:customize"
              />
            }
          >
            <SlidersHorizontal className="size-4" /> Customize
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-0">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Show widgets
            </p>
            <div className="max-h-72 overflow-y-auto px-1 pb-1">
              {permitted.map((w) => (
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
            {/* Three-up rows; the partial last row's cards grow to fill the width
                (1 card → full row, 2 cards → half each), so a row never leaves an
                empty cell. The first row stretches to the sidebar's bottom edge
                (HERO_ROW_FILL); rows below sit under the fold (scroll to reveal). */}
            <div className="flex flex-wrap items-stretch gap-5">
              {visible.map((w, i) => renderWidget(w, i < 3))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeWidget ? (
              <div className="cursor-grabbing rounded-[1.4rem] opacity-95 shadow-2xl ring-1 ring-primary/30 [&>*]:[--card-spacing:--spacing(4)]!">
                {WIDGET_REGISTRY[activeWidget.type]?.render(data)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
