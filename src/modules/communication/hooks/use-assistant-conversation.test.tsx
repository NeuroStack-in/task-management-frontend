import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/communication/services/assistant.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/communication/services/assistant.service")
  >()),
  sendAssistantMessage: vi.fn(),
}));

import { ApiError } from "@/lib/api";
import { sendAssistantMessage } from "@/modules/communication/services/assistant.service";
import { useAssistantConversation } from "./use-assistant-conversation";

const send = vi.mocked(sendAssistantMessage);
beforeEach(() => send.mockReset());

const setup = (enabled = true) =>
  renderHook(() =>
    useAssistantConversation({ greeting: "Hello there.", surface: "help", enabled }),
  );

describe("useAssistantConversation", () => {
  it("hands each reply's sig back with the next turn, and never the greeting (contract 1)", async () => {
    send
      .mockResolvedValueOnce({ reply: "First answer.", sources: [], sig: "sig-1" })
      .mockResolvedValueOnce({ reply: "Second answer.", sources: [] });
    const { result } = setup();

    await act(() => result.current.send("first question"));
    expect(send).toHaveBeenLastCalledWith("first question", [], undefined, "help");

    await act(() => result.current.send("follow-up"));
    expect(send).toHaveBeenLastCalledWith(
      "follow-up",
      [
        { role: "user", content: "first question" },
        { role: "assistant", content: "First answer.", sig: "sig-1" },
      ],
      undefined,
      "help",
    );
    expect(result.current.messages.at(-1)).toMatchObject({ text: "Second answer." });
  });

  it("shows the server's limit sentence, and keeps the failed turn out of the history", async () => {
    send
      .mockRejectedValueOnce(
        new ApiError(
          "You're doing that a bit too quickly. Wait a moment and try again.",
          429,
          "assistant_daily_limit",
          "You've reached today's limit for assistant messages.",
        ),
      )
      .mockResolvedValueOnce({ reply: "ok", sources: [] });
    const { result } = setup();

    await act(() => result.current.send("blocked question"));
    const last = result.current.messages.at(-1);
    expect(last).toMatchObject({
      role: "assistant",
      local: true,
      text: "You've reached today's limit for assistant messages.",
    });

    await act(() => result.current.send("next day"));
    // Neither the refused question nor the app's own sentence went back as a turn.
    expect(send).toHaveBeenLastCalledWith("next day", [], undefined, "help");
  });

  it("sends nothing while a reply is pending, or when the gate is closed", async () => {
    let resolve!: (v: { reply: string; sources: [] }) => void;
    send.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = setup();
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.send("one");
    });
    let second = true;
    await act(async () => {
      second = await result.current.send("two");
    });
    expect(second).toBe(false);
    await act(async () => {
      resolve({ reply: "done", sources: [] });
      await first;
    });
    expect(send).toHaveBeenCalledTimes(1);

    const closed = setup(false);
    await act(async () => {
      expect(await closed.result.current.send("anything")).toBe(false);
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("clear() forgets the conversation, signatures included", async () => {
    send
      .mockResolvedValueOnce({ reply: "a", sources: [], sig: "s" })
      .mockResolvedValueOnce({ reply: "b", sources: [] });
    const { result } = setup();
    await act(() => result.current.send("q1"));
    act(() => result.current.clear());
    expect(result.current.messages).toHaveLength(1);
    await act(() => result.current.send("q2"));
    expect(send).toHaveBeenLastCalledWith("q2", [], undefined, "help");
  });
});
