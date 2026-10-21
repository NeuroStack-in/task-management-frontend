import { describe, expect, it } from "vitest";
import type { NotificationType } from "@/types";
import { countByType, emptyCopy, typeFilters } from "./filters";

const ORDER: NotificationType[] = ["task", "approval", "security", "productivity", "billing", "system"];
const feed = (...types: NotificationType[]) => types.map((type) => ({ type }));

describe("notification filters (UX audit SHELL-20)", () => {
  it("counts the feed by type", () => {
    const c = countByType(feed("task", "approval", "task"));
    expect(c.get("task")).toBe(2);
    expect(c.get("approval")).toBe(1);
    expect(c.has("productivity")).toBe(false);
  });

  it("offers only the types the feed holds, in the given order", () => {
    const counts = countByType(feed("system", "approval", "approval"));
    expect(typeFilters(ORDER, counts, "all")).toEqual(["approval", "system"]);
  });

  it("never offers a type with nothing in it — Productivity is never produced", () => {
    const counts = countByType(feed("task", "billing"));
    expect(typeFilters(ORDER, counts, "unread")).not.toContain("productivity");
  });

  it("keeps the active type filter after its last item is gone", () => {
    const counts = countByType(feed("task"));
    expect(typeFilters(ORDER, counts, "billing")).toEqual(["task", "billing"]);
  });

  it("offers no type filters for an empty feed", () => {
    expect(typeFilters(ORDER, countByType([]), "all")).toEqual([]);
  });

  it("names the filter in the empty copy instead of claiming you're caught up", () => {
    expect(emptyCopy("billing", 3).title).toBe("No billing notifications");
    expect(emptyCopy("task", 3).title).toBe("No task notifications");
    expect(emptyCopy("all", 0).title).toBe("No notifications");
    expect(emptyCopy("unread", 4)).toEqual({
      title: "You're all caught up",
      description: "No unread notifications.",
    });
  });
});
