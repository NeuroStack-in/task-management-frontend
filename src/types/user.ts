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
  jobTitle: string;
  department: string;
  team: string;
  status: UserStatus;
  productivityScore: number; // 0-100
  organizationId: string;
}

/** Mock auth session persisted to localStorage. */
export interface AuthSession {
  token: string; // mock JWT
  userId: string;
  issuedAt: number;
}
