/**
 * Deterministic mock data for Internal Communication / Inbox (SPEC.md §3,
 * section 18), modelled as chat conversations (DMs + broadcast channels) for a
 * messenger-style UI. Server-safe — participants are pulled from seeded users.
 */
import { users } from "@/lib/data";

export interface ChatMessage {
  id: string;
  /** true = sent by the current user (right-aligned bubble). */
  fromMe: boolean;
  text: string;
  time: string;
}

export interface Conversation {
  id: string;
  kind: "dm" | "channel";
  name: string;
  avatarUrl?: string;
  /** Job title (DM) or channel topic. */
  role?: string;
  online?: boolean;
  unread: number;
  lastTime: string;
  messages: ChatMessage[];
}

const PEOPLE = [...users]
  .sort((a, b) => a.id.localeCompare(b.id))
  .slice(0, 12);

/** Canned quick-replies offered above the composer. */
export const QUICK_REPLIES = [
  "Thanks!",
  "On it 👍",
  "Can you share more?",
  "Let's sync later",
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c-carole",
    kind: "dm",
    name: PEOPLE[0].name,
    avatarUrl: PEOPLE[0].avatarUrl,
    role: PEOPLE[0].jobTitle,
    online: true,
    unread: 2,
    lastTime: "9:12",
    messages: [
      { id: "m1", fromMe: false, text: "Morning! Quick question on my timesheet.", time: "9:05" },
      { id: "m2", fromMe: true, text: "Sure — what's up?", time: "9:06" },
      { id: "m3", fromMe: false, text: "Should the offline workshop on Tuesday be billable for Acme Storefront?", time: "9:11" },
      { id: "m4", fromMe: false, text: "I logged it as a manual entry but wasn't sure on the category.", time: "9:12" },
    ],
  },
  {
    id: "c-announce",
    kind: "channel",
    name: "Company Announcements",
    role: "Org-wide · People Ops",
    unread: 1,
    lastTime: "9:05",
    messages: [
      { id: "m1", fromMe: false, text: "📣 Q3 all-hands is this Friday at 3:00 PM — main hall + Zoom.", time: "9:00" },
      { id: "m2", fromMe: false, text: "We'll cover the roadmap, hiring, and celebrate this quarter's wins. Bring questions for the open Q&A!", time: "9:05" },
    ],
  },
  {
    id: "c-marcus",
    kind: "dm",
    name: PEOPLE[3].name,
    avatarUrl: PEOPLE[3].avatarUrl,
    role: PEOPLE[3].jobTitle,
    online: false,
    unread: 0,
    lastTime: "Yesterday",
    messages: [
      { id: "m1", fromMe: false, text: "Submitted my leave request for Jul 8–10 🌴", time: "Yesterday" },
      { id: "m2", fromMe: true, text: "Got it — approved. Enjoy the break!", time: "Yesterday" },
      { id: "m3", fromMe: false, text: "Thanks! I'll wrap up the handover notes before then.", time: "Yesterday" },
    ],
  },
  {
    id: "c-aisha",
    kind: "dm",
    name: PEOPLE[2].name,
    avatarUrl: PEOPLE[2].avatarUrl,
    role: PEOPLE[2].jobTitle,
    online: true,
    unread: 0,
    lastTime: "8:42",
    messages: [
      { id: "m1", fromMe: false, text: "Pushed the fixes for the edge cases you flagged on the payment step.", time: "8:40" },
      { id: "m2", fromMe: false, text: "Expired-card path now shows the inline error instead of the toast. Mind another look?", time: "8:42" },
      { id: "m3", fromMe: true, text: "Nice — will review after standup 👍", time: "8:43" },
    ],
  },
  {
    id: "c-security",
    kind: "channel",
    name: "IT & Security",
    role: "Org-wide · Security",
    unread: 0,
    lastTime: "Mon",
    messages: [
      { id: "m1", fromMe: false, text: "🔐 Reminder: enable MFA before July 1 (SOC 2 requirement).", time: "Mon" },
      { id: "m2", fromMe: false, text: "Set it up in Settings → Security. Ping #it-help if you hit snags.", time: "Mon" },
    ],
  },
  {
    id: "c-design",
    kind: "dm",
    name: PEOPLE[5].name,
    avatarUrl: PEOPLE[5].avatarUrl,
    role: PEOPLE[5].jobTitle,
    online: false,
    unread: 0,
    lastTime: "Mon",
    messages: [
      { id: "m1", fromMe: false, text: "Graphite & Indigo tokens are ready for a final pass before the dashboard refresh.", time: "Mon" },
      { id: "m2", fromMe: false, text: "Left a few notes on the contrast ratios in the doc.", time: "Mon" },
      { id: "m3", fromMe: true, text: "Perfect, signing off on them today.", time: "Mon" },
    ],
  },
];
