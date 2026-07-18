import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { sendAssistantMessage } from "./assistant.service";

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
});
