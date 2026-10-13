import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Bits 20 (ProjectsRead) + 110 (TimeTrackSelf), as the pre-token trigger stamps them. */
const PERM = vi.hoisted(() => ((BigInt(1) << BigInt(20)) | (BigInt(1) << BigInt(110))).toString());

vi.mock("@/stores/auth.store", async () => {
  const { create } = await import("zustand");
  return {
    useAuthStore: create(() => ({
      user: { id: "u1", roleId: "role-contractor", isOwner: false, perm: PERM },
    })),
  };
});

const listRoles = vi.hoisted(() =>
  vi.fn(async () => [
    {
      id: "role-contractor",
      name: "Contractor",
      description: "Contract staff",
      system: false,
      is_owner: false,
      scope: "self",
      permissions: ["projects:read", "time:track:self"],
    },
  ]),
);
vi.mock("@/modules/roles/services/roles.service", () => ({ listRoles }));

import { useCurrentRole } from "./use-permissions";

/**
 * A server-created custom role's identity lives only on its role record — the token carries bits.
 * The UI used to invent "Custom role" with scope `org`, which sent a `self` role down every org
 * branch (QA audit 2026-10-08, WP-318).
 */
describe("useCurrentRole for a custom role", () => {
  it("takes the name and scope from the server's role record", async () => {
    const { result } = renderHook(() => useCurrentRole());
    await waitFor(() => expect(result.current?.name).toBe("Contractor"));
    expect(result.current?.scope).toBe("self");
    // Permissions still come from the token, not from the record.
    expect(result.current?.permissions).toContain("projects:view");
    expect(result.current?.permissions).toContain("time-tracking:self");
  });

  it("asks the server once per page load, not once per mounted component", async () => {
    renderHook(() => useCurrentRole());
    renderHook(() => useCurrentRole());
    await waitFor(() => expect(listRoles).toHaveBeenCalledTimes(1));
  });
});
