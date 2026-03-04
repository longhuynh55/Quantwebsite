import { render, screen } from "@testing-library/react";
import type { Message } from "@/types/assistant";
import { ChatMessage } from "./ChatMessage";

function buildAssistantMessage(partial?: Partial<Message>): Message {
  return {
    id: "m1",
    role: "assistant",
    content: "Test response",
    timestamp: new Date("2026-02-28T10:00:00.000Z"),
    ...partial,
  };
}

describe("ChatMessage execution trace behavior", () => {
  it("auto-opens trace panel when any tool has error/skipped status", () => {
    const message = buildAssistantMessage({
      meta: {
        providerUsed: "openrouter",
        fallbackUsed: false,
        latencyMs: 1200,
        requestId: "req-1",
      },
      usedTools: [
        { name: "stockSnapshot", status: "error", evidenceCount: 0, warningCount: 0, error: "boom" },
      ],
      policyStatus: "ok",
    });

    const { container } = render(<ChatMessage message={message} />);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(true);
  });

  it("surfaces semantic fail count and prioritizes failed checks", () => {
    const message = buildAssistantMessage({
      meta: {
        providerUsed: "openrouter",
        fallbackUsed: false,
        latencyMs: 900,
        requestId: "req-2",
        semantic: {
          phase: "phase2",
          version: "v1",
          checklist: [
            { id: "pass-1", label: "Pass 1", status: "pass" },
            { id: "fail-1", label: "Fail 1", status: "fail" },
            { id: "warn-1", label: "Warn 1", status: "warn", guard: true },
            { id: "pass-2", label: "Pass 2", status: "pass" },
            { id: "fail-2", label: "Fail 2", status: "fail" },
          ],
        },
      },
      usedTools: [{ name: "stockSnapshot", status: "success", evidenceCount: 1, warningCount: 0 }],
    });

    render(<ChatMessage message={message} />);
    expect(screen.getByText("Fails: 2")).toBeInTheDocument();

    const failNode = screen.getByText("Fail 1");
    const passNode = screen.getByText("Pass 1");
    const position = failNode.compareDocumentPosition(passNode);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
