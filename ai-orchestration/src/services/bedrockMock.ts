import type { AiTurnResult, ToolDefinition } from "../types.js";
import type { ConversationMessage } from "./conversation.js";

/**
 * Mô phỏng Bedrock: lượt đầu trả tool_use, sau khi có tool result trả final text.
 */
export async function mockBedrockTurn(
  messages: ConversationMessage[],
  tools: ToolDefinition[]
): Promise<AiTurnResult> {
  const toolNames = new Set(tools.map((t) => t.name));
  const hasToolResult = messages.some(
    (m) =>
      m.role === "user" &&
      m.parts.some((p) => "toolResult" in p)
  );

  if (!hasToolResult) {
    const primary = tools[0];
    if (!primary || !toolNames.has(primary.name)) {
      return {
        kind: "final",
        text: "Không có tool phù hợp với quyền của bạn.",
      };
    }
    const date = new Date().toISOString().slice(0, 10);
    return {
      kind: "tool_use",
      toolUseId: `mock-tool-use-${Date.now()}`,
      toolCall: {
        name: primary.name,
        arguments: { date },
      },
    };
  }

  const lastToolMsg = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === "user" &&
        m.parts.some((p) => "toolResult" in p)
    ) as ConversationMessage | undefined;

  const trPart = lastToolMsg?.parts.find((p) => "toolResult" in p) as
    | { toolResult: { content: unknown } }
    | undefined;
  const payload = trPart?.toolResult?.content;
  let summary: string;
  if (payload && typeof payload === "object" && "result" in payload) {
    const r = (payload as { result?: { totalAmount?: number; currency?: string } })
      .result;
    if (r?.totalAmount != null && r?.currency) {
      summary = `Tổng giao dịch hôm nay là ${r.totalAmount.toLocaleString("vi-VN")} ${r.currency}.`;
    } else {
      summary = JSON.stringify(payload);
    }
  } else {
    summary = JSON.stringify(payload ?? "");
  }

  return { kind: "final", text: summary };
}
