import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  ASSISTANT_UNREACHABLE,
  COUNTER_FROM,
  HISTORY_MAX_CHARS,
  HISTORY_MAX_TURNS,
  assistantErrorMessage,
  counterText,
  focusLoopTarget,
  formatWait,
  historyFrom,
  retryAfterOf,
  type ChatMessage,
} from "./assistant-chat";

const greeting: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Hi, ask me anything.",
  local: true,
};

describe("historyFrom — what goes back to the server (contract 1, AI-23)", () => {
  it("sends each assistant reply with the sig it came with, and user turns without one", () => {
    const history = historyFrom([
      greeting,
      { id: 1, role: "user", text: "who worked yesterday?" },
      { id: 2, role: "assistant", text: "Agent Tester, 10:00–11:00.", sig: "s1g-abc" },
    ]);
    expect(history).toEqual([
      { role: "user", content: "who worked yesterday?" },
      { role: "assistant", content: "Agent Tester, 10:00–11:00.", sig: "s1g-abc" },
    ]);
  });

  it("never sends the greeting, an error sentence, or a question whose request failed", () => {
    const history = historyFrom([
      greeting,
      { id: 1, role: "user", text: "first question", local: true },
      { id: 2, role: "assistant", text: "You've reached today's limit.", local: true },
      { id: 3, role: "user", text: "second question" },
      { id: 4, role: "assistant", text: "an answer", sig: "x" },
    ]);
    expect(history.map((t) => t.content)).toEqual(["second question", "an answer"]);
    // No turn the app wrote ever travels as `assistant`.
    expect(history.filter((t) => t.role === "assistant")).toHaveLength(1);
  });

  it("sends an unsigned reply (an older server) without a sig — never an invented one", () => {
    const [turn] = historyFrom([{ id: 1, role: "assistant", text: "an old reply" }]);
    expect(turn).toEqual({ role: "assistant", content: "an old reply" });
    expect("sig" in turn).toBe(false);
  });

  it("never puts a sig on a user turn", () => {
    const [turn] = historyFrom([{ id: 1, role: "user", text: "hello", sig: "forged" }]);
    expect(turn).toEqual({ role: "user", content: "hello" });
  });

  it("keeps the reply text byte for byte — the signature covers exactly it", () => {
    const text = "  **Hours**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n  ";
    const [turn] = historyFrom([{ id: 1, role: "assistant", text, sig: "s" }]);
    expect(turn.content).toBe(text);
  });

  it("stops at the server's own replay budget, keeping the newest turns in order", () => {
    const many: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      role: i % 2 ? "assistant" : "user",
      text: `turn ${i}`,
    }));
    const history = historyFrom(many);
    expect(history).toHaveLength(HISTORY_MAX_TURNS);
    expect(history[0].content).toBe("turn 10");
    expect(history.at(-1)?.content).toBe("turn 29");

    const big = "x".repeat(HISTORY_MAX_CHARS - 10);
    const capped = historyFrom([
      { id: 1, role: "user", text: "an older question that no longer fits" },
      { id: 2, role: "assistant", text: big, sig: "s" },
    ]);
    expect(capped).toEqual([{ role: "assistant", content: big, sig: "s" }]);
  });
});

describe("assistantErrorMessage — the server's sentence for its own codes (contract 2, AI-25)", () => {
  it("shows the server's message for assistant_daily_limit, not 'couldn't reach'", () => {
    const e = new ApiError(
      "You're doing that a bit too quickly. Wait a moment and try again.",
      429,
      "assistant_daily_limit",
      "You've used today's 300 assistant messages. You can ask again tomorrow.",
    );
    const text = assistantErrorMessage(e);
    expect(text).toBe(
      "You've used today's 300 assistant messages. You can ask again tomorrow.",
    );
    expect(text).not.toMatch(/couldn.t reach/i);
  });

  it.each([
    ["assistant_rate_limited", 429, /last minute/],
    ["assistant_daily_limit", 429, /today's limit/],
    ["assistant_budget_exhausted", 429, /organization has used today's AI allowance/],
    ["message_too_long", 400, /under 4,000 characters/],
  ])(
    "%s falls back to its own sentence when the server's isn't fit to show",
    (code, status, re) => {
      // What the current server actually puts in `message` for a rate limit.
      const e = new ApiError("generic", status, code, `rate limited: ${code}`);
      const text = assistantErrorMessage(e);
      expect(text).toMatch(re);
      expect(text).not.toMatch(/couldn.t reach/i);
      expect(text).not.toContain(code);
    },
  );

  it("adds 'Try again in 40 s' when the server says how long", () => {
    const e = Object.assign(
      new ApiError(
        "x",
        429,
        "assistant_rate_limited",
        "You're sending messages too quickly.",
      ),
      { retryAfterSecs: 40 },
    );
    expect(assistantErrorMessage(e)).toBe(
      "You're sending messages too quickly. Try again in 40 s.",
    );
  });

  it("doesn't repeat a countdown the server's sentence already gives", () => {
    const e = Object.assign(
      new ApiError(
        "x",
        429,
        "assistant_rate_limited",
        "Too many messages — try again in 40 seconds.",
      ),
      { retryAfterSecs: 40 },
    );
    expect(assistantErrorMessage(e)).toBe("Too many messages — try again in 40 seconds.");
  });

  // The sentences the hardened server sends (`assistant::…::rate::message_for`, `turn.rs`) — shown
  // verbatim, without a second countdown bolted on.
  it.each([
    [
      "assistant_rate_limited",
      429,
      40,
      "You're sending messages faster than the assistant allows. Please wait about 40 seconds and try again.",
    ],
    [
      "assistant_daily_limit",
      429,
      25_200,
      "You've reached today's limit of 300 assistant messages. It resets at 00:00 UTC (in about 7 hours).",
    ],
    [
      "assistant_budget_exhausted",
      429,
      3000,
      "Your organization has used today's assistant allowance. It resets at 00:00 UTC (in under an hour). If this keeps happening, an admin can raise it from Help → Submit a ticket.",
    ],
    [
      "message_too_long",
      400,
      undefined,
      "Your message is too long. Please keep it under 4,000 characters.",
    ],
  ])("shows the server's %s sentence as it is", (code, status, wait, message) => {
    const e = Object.assign(new ApiError("generic", status, code, message), {
      retryAfterSecs: wait,
    });
    expect(assistantErrorMessage(e)).toBe(message);
  });

  it("treats an older server's 'too long' validation refusal as message_too_long", () => {
    const e = new ApiError(
      "Message is too long (max 4000 characters).",
      400,
      "validation",
      "message is too long (max 4000 characters)",
    );
    expect(assistantErrorMessage(e)).toMatch(/too long/i);
    expect(assistantErrorMessage(e)).not.toMatch(/couldn.t reach/i);
  });

  it("says 'couldn't reach' only when no answer came back at all", () => {
    expect(assistantErrorMessage(new ApiError("offline", 0, "network"))).toBe(
      ASSISTANT_UNREACHABLE,
    );
    expect(assistantErrorMessage(new TypeError("Failed to fetch"))).toBe(
      ASSISTANT_UNREACHABLE,
    );
    expect(assistantErrorMessage(new ApiError("t", 0, "timeout"))).toMatch(
      /took too long/,
    );
    // A server error is not a network failure: say what `lib/errors` already says for it.
    const e500 = new ApiError(
      "Something went wrong on our side. Try again in a moment.",
      500,
      "internal",
    );
    expect(assistantErrorMessage(e500)).toBe(
      "Something went wrong on our side. Try again in a moment.",
    );
  });

  it("keeps the access refusals, and names a turned-off assistant", () => {
    expect(assistantErrorMessage(new ApiError("x", 403, "forbidden"))).toBe(
      "You don't have access to the assistant.",
    );
    expect(assistantErrorMessage(new ApiError("x", 403, "feature_disabled"))).toBe(
      "The assistant is turned off for your organization.",
    );
  });
});

describe("retryAfterOf / formatWait", () => {
  it("reads retry_after_secs in either spelling, and ignores junk", () => {
    expect(retryAfterOf({ retryAfterSecs: 12 })).toBe(12);
    expect(retryAfterOf({ retry_after_secs: 7 })).toBe(7);
    expect(retryAfterOf({ retryAfterSecs: "40" })).toBeUndefined();
    expect(retryAfterOf({ retryAfterSecs: -1 })).toBeUndefined();
    expect(retryAfterOf(null)).toBeUndefined();
  });

  it("rounds up, never early", () => {
    expect(formatWait(40)).toBe("40 s");
    expect(formatWait(0.2)).toBe("1 s");
    expect(formatWait(61)).toBe("2 min");
    expect(formatWait(3600)).toBe("1 h");
    expect(formatWait(3600 * 7 + 60 * 12)).toBe("7 h 12 min");
    expect(formatWait(3600 * 2 - 1)).toBe("2 h");
  });
});

describe("counterText — the 4,000-character cap (contract 4)", () => {
  it("is hidden while the message is comfortably short", () => {
    expect(counterText(0)).toBeNull();
    expect(counterText(COUNTER_FROM - 1)).toBeNull();
  });
  it("counts near the limit and says when it's reached", () => {
    expect(counterText(3612)).toBe("3,612 / 4,000");
    expect(counterText(4000)).toBe("4,000 / 4,000 — that's the limit");
  });
});

describe("focusLoopTarget — Tab stays in the open panel (AI-61)", () => {
  const items = ["clear", "input", "send"];
  it("wraps forward from the last item and backward from the first", () => {
    expect(focusLoopTarget(items, "send", false)).toBe("clear");
    expect(focusLoopTarget(items, "clear", true)).toBe("send");
  });
  it("lets the browser move normally in between", () => {
    expect(focusLoopTarget(items, "clear", false)).toBeNull();
    expect(focusLoopTarget(items, "input", true)).toBeNull();
  });
  it("pulls focus back in from outside the list, and does nothing with no items", () => {
    expect(focusLoopTarget(items, null, false)).toBe("clear");
    expect(focusLoopTarget(items, null, true)).toBe("send");
    expect(focusLoopTarget([], null, false)).toBeNull();
  });
});
