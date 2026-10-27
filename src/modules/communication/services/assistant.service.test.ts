import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { ASSISTANT_MESSAGE_MAX, sendAssistantMessage } from "./assistant.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

/**
 * The browser's local date, built exactly as the service builds it.
 *
 * Deliberately not a hardcoded string: that would pass on the day it was written and fail every
 * day after. Deliberately not `toISOString().slice(0, 10)` either — that is UTC, and reproducing
 * the UTC conversion here would let the very off-by-one these tests guard against slip through
 * agreeing with itself.
 */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

describe("assistant.service route contract", () => {
  it("sendAssistantMessage POSTs the message body and unwraps res.reply", async () => {
    mock.mockResolvedValueOnce({ reply: "hi" });
    const answer = await sendAssistantMessage("hello");
    expect(mock).toHaveBeenCalledWith("/v1/assistant/messages", {
      method: "POST",
      // `surface` defaults to "chat" — the floating assistant. The server narrows it to
      // "help" for a caller without `ai:view`, so this is a request, not a grant.
      // `client_date` is the browser's LOCAL date. The server used to compute "today" in UTC,
      // so a UTC+05:30 org asking after midnight got answers about the previous day.
      body: JSON.stringify({
        message: "hello",
        history: [],
        surface: "chat",
        client_date: today(),
      }),
    });
    expect(answer.reply).toBe("hi");
    // A server that sends no `sources` (an older build, or a turn that called no tool) must yield
    // an empty list rather than `undefined` — the panel maps over it directly.
    expect(answer.sources).toEqual([]);
    // …and no `sig` key at all when the server sent none: nothing to hand back.
    expect("sig" in answer).toBe(false);
  });

  it("carries provenance through when the server sends it", async () => {
    mock.mockResolvedValueOnce({
      reply: "8 present",
      sources: [{ label: "Attendance", date: "2026-08-31", scope: "the organization" }],
    });
    const answer = await sendAssistantMessage("what was attendance yesterday");
    expect(answer.sources).toEqual([
      { label: "Attendance", date: "2026-08-31", scope: "the organization" },
    ]);
  });

  it("keeps the reply's sig, untouched, so it can go back with the next turn (contract 1)", async () => {
    mock.mockResolvedValueOnce({ reply: "ok", sig: "v1.AbC_123-xyz=" });
    const answer = await sendAssistantMessage("hello");
    expect(answer.sig).toBe("v1.AbC_123-xyz=");
  });

  it("drops a sig that isn't a non-empty string rather than echoing it back", async () => {
    mock.mockResolvedValueOnce({ reply: "ok", sig: "" });
    expect("sig" in (await sendAssistantMessage("a"))).toBe(false);
    mock.mockResolvedValueOnce({ reply: "ok", sig: 42 });
    expect("sig" in (await sendAssistantMessage("b"))).toBe(false);
  });

  it("sendAssistantMessage replays the conversation so far, signed assistant turns included", async () => {
    // The server stores nothing, so a follow-up only has context the client sends. Without this
    // the assistant read as having forgotten the question it was just asked.
    mock.mockResolvedValueOnce({ reply: "ok" });
    await sendAssistantMessage("from 2/8/26 to 8/8/26", [
      { role: "user", content: "what is the productivity status of employees" },
      {
        role: "assistant",
        content: "I don't have any productivity score data.",
        sig: "s1",
      },
    ]);
    expect(mock).toHaveBeenCalledWith("/v1/assistant/messages", {
      method: "POST",
      body: JSON.stringify({
        message: "from 2/8/26 to 8/8/26",
        history: [
          { role: "user", content: "what is the productivity status of employees" },
          {
            role: "assistant",
            content: "I don't have any productivity score data.",
            sig: "s1",
          },
        ],
        surface: "chat",
        client_date: today(),
      }),
    });
  });

  it("the Help Center asks on the help surface, and sends no page context", async () => {
    // Two things the Help Center assistant must not do: claim the oversight surface, and hand the
    // model the figures on screen. `page` is omitted entirely rather than sent empty.
    mock.mockResolvedValueOnce({ reply: "ok" });
    await sendAssistantMessage("how is the score calculated", [], undefined, "help");
    expect(mock).toHaveBeenCalledWith("/v1/assistant/messages", {
      method: "POST",
      body: JSON.stringify({
        message: "how is the score calculated",
        history: [],
        surface: "help",
        client_date: today(),
      }),
    });
  });

  it("caps messages at the server's 4,000 characters", () => {
    // Mirrors `assistant::…::dto::MAX_MESSAGE_CHARS`; both inputs use it as `maxLength`.
    expect(ASSISTANT_MESSAGE_MAX).toBe(4000);
  });
});
