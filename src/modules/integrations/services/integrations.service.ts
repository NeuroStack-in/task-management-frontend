/**
 * Integrations — the real backend (`integrations` context, `docs/INTEGRATIONS.md`).
 *
 * The provider catalog is **server-owned**: `GET /v1/integrations` returns every provider the
 * backend knows how to connect, each annotated with this org's state. The frontend does not keep its
 * own list — a card the server can't actually connect is a button that lies.
 *
 * OAuth never leaves the authenticated path. `authorize` returns a URL the browser navigates to; the
 * provider redirects back to `/settings/integrations/callback`, which posts the code to `connect`
 * with the user's Cognito token. There is no unauthenticated callback endpoint.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `integrations::list_integrations::dto::IntegrationView`. */
export interface ApiIntegration {
  /** Wire id — `slack` | `google_calendar`. What the connect/disconnect routes take. */
  provider: string;
  label: string;
  /** True when one connection serves the whole org (Slack); false when it's personal (Calendar). */
  org_wide: boolean;
  /** `connected` | `error` | `not_connected`. */
  status: string;
  /** Workspace name / account email. Display only — never used for authorization. */
  external_account?: string;
  connected_at?: number;
  /** Why the last delivery failed, when `status` is `error`. Makes "reconnect" actionable. */
  last_error?: string;
}

/** `GET /v1/integrations` — perm: `integrations:view`. */
export async function listIntegrations(): Promise<ApiIntegration[]> {
  const res = await apiFetch<{ integrations: ApiIntegration[] }>("/v1/integrations");
  return res.integrations ?? [];
}

/** `POST /v1/integrations/{provider}/authorize` — returns where to send the browser next. */
export async function getAuthorizeUrl(provider: string): Promise<string> {
  const res = await apiFetch<{ url: string }>(
    `/v1/integrations/${encodeURIComponent(provider)}/authorize`,
    { method: "POST" },
  );
  return res.url;
}

/** `POST /v1/integrations/{provider}/connect` — completes the flow from the callback page. */
export async function completeConnect(
  provider: string,
  code: string,
  state: string,
): Promise<ApiIntegration> {
  return apiFetch<ApiIntegration>(
    `/v1/integrations/${encodeURIComponent(provider)}/connect`,
    { method: "POST", body: JSON.stringify({ code, state }) },
  );
}

/** `DELETE /v1/integrations/{provider}` — revokes at the provider, then forgets locally. */
export async function disconnect(provider: string): Promise<void> {
  await apiFetch(`/v1/integrations/${encodeURIComponent(provider)}`, {
    method: "DELETE",
  });
}

/** Slack channel routing. `detail_type` → channel, plus a fallback. */
export interface SlackConfig {
  default_channel: string;
  channels: Record<string, string>;
}

/** `GET /v1/integrations/slack/config`. A 404 means Slack isn't connected yet. */
export async function getSlackConfig(): Promise<SlackConfig> {
  return apiFetch<SlackConfig>("/v1/integrations/slack/config");
}

/** `PUT /v1/integrations/slack/config` — perm: `integrations:manage`. */
export async function setSlackConfig(config: SlackConfig): Promise<SlackConfig> {
  return apiFetch<SlackConfig>("/v1/integrations/slack/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/**
 * `POST /v1/integrations/slack/test` — send a probe.
 *
 * Worth surfacing prominently in the UI: without it, the first sign that routing is wrong is a leave
 * request that silently never appeared, noticed days later if at all.
 */
export async function sendSlackTest(channel?: string): Promise<string> {
  const res = await apiFetch<{ sent: boolean; channel: string }>(
    "/v1/integrations/slack/test",
    { method: "POST", body: JSON.stringify({ channel: channel || null }) },
  );
  return res.channel;
}

/** `GET /v1/integrations/slack/channels` — public channels for the routing dropdown. */
export async function listSlackChannels(): Promise<string[]> {
  const res = await apiFetch<{ channels: { name: string }[] }>(
    "/v1/integrations/slack/channels",
  );
  return (res.channels ?? []).map((c) => c.name);
}

/** One day's meeting time. Mirrors `calendar_summary::dto::DayMeetings`. */
export interface DayMeetings {
  date: string;
  meeting_sec: number;
}

export interface CalendarSummary {
  from: string;
  to: string;
  /** Whether the caller has their own calendar connected — drives connect-nudge vs zero-state. */
  connected: boolean;
  days: DayMeetings[];
  total_sec: number;
}

/** `GET /v1/me/integrations/calendar/summary?from=&to=` — the caller's meeting hours per day. */
export async function getCalendarSummary(
  from: string,
  to: string,
): Promise<CalendarSummary> {
  const qs = new URLSearchParams({ from, to }).toString();
  return apiFetch<CalendarSummary>(`/v1/me/integrations/calendar/summary?${qs}`);
}

/** The events Slack can announce, for the routing editor. Mirrors the ContextSpec's `consumes`. */
export const SLACK_EVENTS: { key: string; label: string; description: string }[] = [
  {
    key: "leave.requested",
    label: "Leave requested",
    description: "Someone asks for time off",
  },
  {
    key: "leave.approved",
    label: "Leave approved",
    description: "A request is granted",
  },
  {
    key: "leave.cancelled",
    label: "Leave cancelled",
    description: "A request is withdrawn",
  },
  {
    key: "workforce.employee_joined",
    label: "Employee joined",
    description: "A new joiner accepts their invite",
  },
  {
    key: "payroll.finalized",
    label: "Payroll finalized",
    description: "A pay period is closed",
  },
  {
    key: "projects.task_assigned",
    label: "Task assigned",
    description: "Someone is assigned a new task",
  },
];
