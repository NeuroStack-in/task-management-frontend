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
      body: JSON.stringify({ message: "hello" }),
    });
    expect(reply).toBe("hi");
  });

  it("listAssistantThreads GETs the threads route and unwraps res.threads", async () => {
    mock.mockResolvedValueOnce({ threads: ["Quarterly report help"] });
    const threads = await listAssistantThreads();
    expect(mock).toHaveBeenCalledWith("/v1/assistant/threads");
    expect(threads).toEqual(["Quarterly report help"]);
  });
});
