import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { listAssistantThreads, sendAssistantMessage } from "./assistant.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("assistant.service route contract", () => {
  it("sendAssistantMessage POSTs the message body and unwraps res.reply", async () => {
    mock.mockResolvedValueOnce({ reply: "hi" });
    const reply = await sendAssistantMessage("hello");
    expect(mock).toHaveBeenCalledWith("/v1/assistant/messages", {
      method: "POST",
      body: JSON.stringify({ message: "hello", history: [] }),
    });
    expect(reply).toBe("hi");
  });

  it("sendAssistantMessage replays the conversation so far", async () => {
    // The server stores nothing, so a follow-up only has context the client sends. Without this
    // the assistant read as having forgotten the question it was just asked.
    mock.mockResolvedValueOnce({ reply: "ok" });
    await sendAssistantMessage("from 2/8/26 to 8/8/26", [
      { role: "user", content: "what is the productivity status of employees" },
      { role: "assistant", content: "I don't have any productivity score data." },
    ]);
    expect(mock).toHaveBeenCalledWith("/v1/assistant/messages", {
      method: "POST",
      body: JSON.stringify({
        message: "from 2/8/26 to 8/8/26",
        history: [
          { role: "user", content: "what is the productivity status of employees" },
          { role: "assistant", content: "I don't have any productivity score data." },
        ],
      }),
    });
  });

  it("listAssistantThreads GETs the threads route and unwraps res.threads", async () => {
    mock.mockResolvedValueOnce({ threads: ["Quarterly report help"] });
    const threads = await listAssistantThreads();
    expect(mock).toHaveBeenCalledWith("/v1/assistant/threads");
    expect(threads).toEqual(["Quarterly report help"]);
  });
});
