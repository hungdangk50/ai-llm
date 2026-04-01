import type { ToolDefinition } from "../types.js";

/** Nội bộ orchestrator — map sang Bedrock Converse khi không mock. */
export type ConversationMessage =
  | {
      role: "user";
      parts: (
        | { text: string }
        | { toolResult: { toolUseId: string; content: unknown } }
      )[];
    }
  | {
      role: "assistant";
      parts: (
        | { text: string }
        | {
            toolUse: {
              toolUseId: string;
              name: string;
              input: Record<string, unknown>;
            };
          }
      )[];
    };

export function userTextMessage(text: string): ConversationMessage {
  return { role: "user", parts: [{ text }] };
}
