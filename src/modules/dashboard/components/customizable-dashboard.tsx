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
  Check,
  GripVertical,
  Move,
  SlidersHorizontal,
  RotateCcw,
  X,
} from "lucide-react";
import { useDashboardStore, type DashboardWidget } from "@/stores/dashboard.store";
import { useAuthStore } from "@/stores/auth.store";
import { useDashboardLayoutSync } from "@/modules/dashboard/use-layout-sync";
import {
  holdsWidgetPermission,
  widgetDataPermission,
  widgetFeature,
} from "@/modules/dashboard/services/dashboard.service";
import { usePermissions } from "@/hooks/use-permissions";
import { isOwnerOf, useIsSurfaceOn } from "@/hooks/use-features";
import { WIDGET_REGISTRY, type DashboardData } from "@/modules/dashboard/widget-registry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  title,
  heroFill,
  editing,
  onRemove,
  children,
}: {
  id: string;
  /** The card's own title — named in its controls' labels. */
  title: string;
  /** First-row tile: stretch to fill the viewport down to the sidebar bottom. */
  heroFill?: boolean;
  /** "Edit layout" is on — the touch-screen way to show the controls (see the parent). */
  editing: boolean;
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
        // The shell owns a widget's top-right corner: ~72px of it, floated over whatever the card
        // renders and revealed on hover. A widget that right-aligns something in its own
        // `CardHeader` will therefore collide with these — and collide exactly when the person is
        // hovering, which is when both are wanted. Widget headers are title-only for that reason;
        // put a widget's own actions in its footer (see the AI summary card).
        //
        // Revealed on hover and on keyboard focus within the tile (QA audit 2026-10-08, WP-439).
        // On a touch screen — no hover — they used to show on every tile, all the time, over every
        // card's corner (UX audit 2026-10-16, SHELL-15); there they appear only in "Edit layout".
        <div
          className={cn(
            "absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/widget:opacity-100 group-focus-within/widget:opacity-100",
            editing ? "opacity-100" : "pointer-coarse:hidden",
          )}
        >
          {/* Named per widget: a dozen buttons all called "Drag to reorder" / "Remove widget" were
              indistinguishable in a screen reader's list of controls (SHELL-15). */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move “${title}”`}
            // `touch-none`: on a touch screen a drag on the handle moves the card, not the page.
            className="flex size-7 cursor-grab touch-none items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground active:cursor-grabbing pointer-coarse:size-9"
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Remove “${title}”`}
            onClick={onRemove}
            className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive pointer-coarse:size-9"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* The SAME element whether dragging or not — only its class changes. Swapping it for a
          placeholder wrapper unmounted the widget when a drag started and remounted it on drop, so a
          self-fetching widget lost its state and fetched again each time (QA audit 2026-10-08,
          WP-201). */}
      <div className={cn(FILL_CARD, isDragging && "invisible")}>{children}</div>
      {isDragging ? (
        // Dashed drop-placeholder over the hidden widget; the floating DragOverlay shows it moving.
        <div className="pointer-events-none absolute inset-0 rounded-[1.4rem] border-2 border-dashed border-primary/40 bg-primary/[0.04]" />
      ) : null}
    </div>
  );
}

export function CustomizableDashboard({ data }: { data: DashboardData }) {
  const widgets = useDashboardStore((s) => s.widgets);
  const toggleWidget = useDashboardStore((s) => s.toggleWidget);
  /**
   * Removing a widget and resetting the layout are reversible, so they act at once and offer Undo
   * in the toast instead of asking first (UX audit 2026-10-16, XC-07).
   */
  const removeWithUndo = (w: DashboardWidget) => {
    toggleWidget(w.id);
    toast(`Removed “${w.title}”`, {
      action: { label: "Undo", onClick: () => toggleWidget(w.id) },
    });
  };
  const resetWithUndo = () => {
    const before = useDashboardStore.getState().widgets;
    reset();
    toast("Dashboard layout reset", {
      action: {
        label: "Undo",
        onClick: () => useDashboardStore.setState({ widgets: before, unsynced: true }),
      },
    });
  };
  const reorder = useDashboardStore((s) => s.reorder);
  const reset = useDashboardStore((s) => s.reset);

  // Server persistence: hydrate from `GET /v1/me/dashboard-layouts` on mount, debounce-save layout
  // changes to `PUT /v1/me/dashboard-layouts/oversight`. Local store stays the optimistic truth.
  useDashboardLayoutSync();

  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * Touch screens only: show the move/remove controls on every tile while on. Desktop reveals them
   * on hover/focus and never needs it, so the toggle is shown to coarse pointers alone.
   */
  const [editing, setEditing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { can } = usePermissions();
  const isSurfaceOn = useIsSurfaceOn();
  const isOwner = useAuthStore(isOwnerOf);
  const perm = useAuthStore((s) => s.user?.perm);

  const ordered = useMemo(
    () => [...widgets].sort((a, b) => a.position - b.position),
    [widgets],
  );
  // A widget is *available* when the user holds its catalog permission — the server's exact bit,
  // not the coarser frontend id (`holdsWidgetPermission`) — AND whatever its data needs beyond that
  // (`widgetDataPermission`), AND the org has its feature on (and its tracking mode doesn't hide it
  // — MANAGED-AGENT.md §8). Unavailable widgets join `blockedIds`, NOT dropped: filtering them out
  // of the persisted layout would lose the owner's arrangement forever the moment the feature came
  // back.
  const available = (w: (typeof ordered)[number]) => {
    if (!holdsWidgetPermission(w.type, { isOwner, perm }, can)) return false;
    if (!can(widgetDataPermission(w.type))) return false;
    const feature = widgetFeature(w.type);
    return feature ? isSurfaceOn(feature) : true;
  };
  const permitted = ordered.filter(available);
  const blockedIds = ordered.filter((w) => !available(w)).map((w) => w.id);
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
        title={w.title}
        heroFill={heroFill}
        editing={editing}
        onRemove={() => removeWithUndo(w)}
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
        <div className="flex items-center gap-2">
          {/* Touch screens only (`pointer-coarse`) — see `editing`. */}
          {visible.length > 0 ? (
            <Button
              variant={editing ? "default" : "outline"}
              size="sm"
              className="hidden gap-2 pointer-coarse:inline-flex"
              aria-pressed={editing}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? <Check className="size-4" /> : <Move className="size-4" />}
              {editing ? "Done" : "Edit layout"}
            </Button>
          ) : null}
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
            {/* A real menu now (UX audit 2026-10-16, SHELL-16): it was `role="menu"` around plain
                labels, checkboxes and a raw button, so arrow keys reached none of them and a screen
                reader heard an empty menu. Each widget is a `menuitemcheckbox` that stays open on
                toggle; Reset is a menu item (its toast offers Undo). */}
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show widgets</DropdownMenuLabel>
                <div className="max-h-72 overflow-y-auto">
                  {permitted.map((w) => (
                    <DropdownMenuCheckboxItem
                      key={w.id}
                      checked={w.visible}
                      onCheckedChange={() => toggleWidget(w.id)}
                      closeOnClick={false}
                      className="py-1.5"
                    >
                      <span className="truncate">{w.title}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetWithUndo} className="py-1.5">
                <RotateCcw className="size-4" /> Reset layout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
              <div className="h-full cursor-grabbing rounded-[1.4rem] opacity-95 shadow-2xl ring-1 ring-primary/30 [&>*]:h-full [&>*]:[--card-spacing:--spacing(4)]!">
                {WIDGET_REGISTRY[activeWidget.type]?.selfFetching ? (
                  // A stand-in, not a second live copy: a widget that fetches its own data fetched
                  // it again for the overlay — and the AI summary's read can start a model run
                  // (QA audit 2026-10-08, WP-201).
                  <Card>
                    <CardHeader>
                      <CardTitle>{activeWidget.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-xs">Drop it where it should go.</p>
                    </CardContent>
                  </Card>
                ) : (
                  WIDGET_REGISTRY[activeWidget.type]?.render(data)
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
