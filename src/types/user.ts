export type UserStatus = "active" | "inactive" | "invited" | "suspended";

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  plan: "free" | "starter" | "business" | "enterprise";
  timezone: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** Role id (see Role). */
  roleId: string;
  /**
   * The Cognito `is_owner` claim — the organization's creator.
   *
   * Kept as its own field rather than inferred from `roleId === "role-owner"`: that id is only a
   * *fallback* when the token carries no `custom:roleId`, so an Owner who also holds a custom role
   * would silently stop reading as one. The backend gates on the same claim.
   */
  isOwner?: boolean;
  jobTitle: string;
  department: string;
  team: string;
  status: UserStatus;
  productivityScore: number; // 0-100
  organizationId: string;
  /**
   * The server's `perm` claim — the u128 permission bitset as a decimal string, verbatim from the
   * ID token. Present for sessions minted after 2026-07-23; older persisted sessions lack it (the
   * UI gate then falls back to the local role lookup). This is what lets a member of a
   * server-created custom role get a working UI: their role isn't in the local store, but the
   * bitset is the server's own truth. See `lib/permission-bits.ts`.
   */
  perm?: string;
}

/** Mock auth session persisted to localStorage. */
export interface AuthSession {
  token: string; // mock JWT
  userId: string;
  issuedAt: number;
}
