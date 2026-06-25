/**
 * Deterministic mock data for Internal Communication / Inbox (SPEC.md §3,
 * section 18). Server-safe — senders are pulled from the seeded users. Covers
 * business mail, org-wide announcements, and a sent folder.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";

export type Folder = "inbox" | "announcements" | "sent";

export interface Message {
  id: string;
  folder: Folder;
  from: { name: string; avatarUrl?: string; role?: string };
  subject: string;
  preview: string;
  body: string[];
  time: string;
  read: boolean;
  starred: boolean;
}

const PEOPLE = [...users]
  .sort((a, b) => a.id.localeCompare(b.id))
  .slice(0, 10);

const person = (u: User) => ({
  name: u.name,
  avatarUrl: u.avatarUrl,
  role: u.jobTitle,
});

export const MESSAGES: Message[] = [
  {
    id: "msg-1",
    folder: "announcements",
    from: { name: "WorkPulse HR", role: "People Ops" },
    subject: "Q3 company all-hands — Friday 3 PM",
    preview: "Join us for the quarterly all-hands covering roadmap and results…",
    body: [
      "Hi everyone,",
      "Our Q3 all-hands is this Friday at 3:00 PM in the main hall and on Zoom. We'll cover the product roadmap, hiring plans, and celebrate this quarter's wins.",
      "Come with questions — the last 20 minutes are an open Q&A with the leadership team.",
      "— The People Ops team",
    ],
    time: "9:05 AM",
    read: false,
    starred: true,
  },
  {
    id: "msg-2",
    folder: "inbox",
    from: person(PEOPLE[0]),
    subject: "Re: Checkout flow — payment step",
    preview: "Thanks for the review. I pushed the fixes for the edge cases you…",
    body: [
      "Thanks for the review!",
      "I pushed the fixes for the edge cases you flagged — the expired-card path now shows the inline error instead of the toast. Mind taking another look when you get a chance?",
    ],
    time: "8:42 AM",
    read: false,
    starred: false,
  },
  {
    id: "msg-3",
    folder: "inbox",
    from: person(PEOPLE[1]),
    subject: "Timesheet question",
    preview: "Quick one — should the offline workshop count as billable for…",
    body: [
      "Quick one —",
      "Should the offline workshop on Tuesday count as billable for the Acme Storefront project? I logged it as a manual entry but wasn't sure on the category.",
    ],
    time: "Yesterday",
    read: true,
    starred: false,
  },
  {
    id: "msg-4",
    folder: "announcements",
    from: { name: "IT & Security", role: "Security" },
    subject: "Mandatory: enable MFA by July 1",
    preview: "All accounts must have multi-factor authentication enabled before…",
    body: [
      "Team,",
      "As part of our SOC 2 commitments, all accounts must have multi-factor authentication enabled before July 1. You can set it up in Settings → Security.",
      "Reach out to #it-help if you hit any snags.",
    ],
    time: "Yesterday",
    read: true,
    starred: false,
  },
  {
    id: "msg-5",
    folder: "inbox",
    from: person(PEOPLE[2]),
    subject: "Design tokens sign-off",
    preview: "The Graphite & Indigo tokens are ready for a final pass before we…",
    body: [
      "Hey,",
      "The Graphite & Indigo tokens are ready for a final pass before we lock them in for the dashboard refresh. Left a few notes on the contrast ratios in the doc.",
    ],
    time: "Mon",
    read: true,
    starred: true,
  },
  {
    id: "msg-6",
    folder: "sent",
    from: { name: "You" },
    subject: "Re: Timesheet question",
    preview: "Yes — billable to Acme Storefront. I'll approve the manual entry…",
    body: [
      "Yes — billable to Acme Storefront.",
      "I'll approve the manual entry now. Thanks for checking!",
    ],
    time: "Yesterday",
    read: true,
    starred: false,
  },
];

export const TEMPLATES = [
  { id: "tpl-1", name: "Timesheet reminder", category: "Operations" },
  { id: "tpl-2", name: "Welcome — new hire", category: "People Ops" },
  { id: "tpl-3", name: "Productivity check-in", category: "Management" },
  { id: "tpl-4", name: "Policy update", category: "Company" },
];

export const FOLDER_META: Record<Folder, { label: string }> = {
  inbox: { label: "Inbox" },
  announcements: { label: "Announcements" },
  sent: { label: "Sent" },
};
