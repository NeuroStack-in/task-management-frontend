import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/communication/services/assistant.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/communication/services/assistant.service")
  >()),
  sendAssistantMessage: vi.fn(),
}));
vi.mock("@/hooks/use-assistant-access", () => ({
  useAssistantAccess: () => ({ help: true, chat: false }),
}));

import { ApiError } from "@/lib/api";
import { sendAssistantMessage } from "@/modules/communication/services/assistant.service";
import { HelpAssistantDialog } from "./help-assistant-dialog";

const send = vi.mocked(sendAssistantMessage);
beforeEach(() => send.mockReset());
beforeAll(() => {
  // jsdom has no layout, so no element scrolling; the transcript scrolls to its newest message.
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

/** AI-34: the Help Center assistant gets what the floating one has. */
describe("HelpAssistantDialog", () => {
  it("has a polite log, the 'AI can be wrong' line, one name, and focus in the capped message box", async () => {
    render(<HelpAssistantDialog open onOpenChange={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("WorkPulse Assistant")).toBeInTheDocument();
    const log = within(dialog).getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(dialog.textContent).toMatch(/AI can be wrong/);
    expect(dialog.textContent).toMatch(/isn.t saved/);
    const box = within(dialog).getByRole("textbox", { name: "Message" });
    expect(box).toHaveAttribute("maxLength", "4000");
    // It used to open with focus on the Clear button (AI-34).
    await waitFor(() => expect(box).toHaveFocus());
  });

  it("renders the reply's sources like the floating assistant, and sends its sig back", async () => {
    send
      .mockResolvedValueOnce({
        reply: "Request leave from **Leave**: [Leave](/leave).",
        sources: [{ label: "Help article", scope: "Requesting leave" }],
        sig: "sig-help-1",
      })
      .mockResolvedValueOnce({ reply: "You're welcome.", sources: [] });
    const user = userEvent.setup();
    render(<HelpAssistantDialog open onOpenChange={() => {}} />);
    const box = await screen.findByRole("textbox", { name: "Message" });

    await user.type(box, "How do I request leave?{Enter}");
    const chips = await screen.findByText("Help article · Requesting leave");
    expect(chips.parentElement?.textContent).toMatch(/^Sources:/);
    expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute("href", "/leave");

    await user.type(box, "thanks{Enter}");
    await screen.findByText("You're welcome.");
    expect(send).toHaveBeenLastCalledWith(
      "thanks",
      [
        { role: "user", content: "How do I request leave?" },
        {
          role: "assistant",
          content: "Request leave from **Leave**: [Leave](/leave).",
          sig: "sig-help-1",
        },
      ],
      undefined,
      "help",
    );
  });

  it("shows the server's sentence for a daily limit, not 'couldn't reach'", async () => {
    send.mockRejectedValueOnce(
      new ApiError(
        "x",
        429,
        "assistant_daily_limit",
        "You've used today's assistant messages.",
      ),
    );
    const user = userEvent.setup();
    render(<HelpAssistantDialog open onOpenChange={() => {}} />);
    await user.type(await screen.findByRole("textbox", { name: "Message" }), "hi{Enter}");
    expect(
      await screen.findByText("You've used today's assistant messages."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t reach/i)).toBeNull();
  });

  it("asks the seed question once, not again on every reopen (FP-15)", async () => {
    send.mockResolvedValue({ reply: "Scores come from four parts.", sources: [] });
    const { rerender } = render(
      <HelpAssistantDialog
        open
        onOpenChange={() => {}}
        seedQuestion="how is the score made"
      />,
    );
    await screen.findByText("Scores come from four parts.");
    expect(send).toHaveBeenCalledTimes(1);

    rerender(
      <HelpAssistantDialog
        open={false}
        onOpenChange={() => {}}
        seedQuestion="how is the score made"
      />,
    );
    rerender(
      <HelpAssistantDialog
        open
        onOpenChange={() => {}}
        seedQuestion="how is the score made"
      />,
    );
    await screen.findByRole("dialog");
    expect(send).toHaveBeenCalledTimes(1);

    // A different question is a new seed.
    rerender(
      <HelpAssistantDialog
        open
        onOpenChange={() => {}}
        seedQuestion="what is idle time"
      />,
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  });
});
