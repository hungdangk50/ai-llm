import type { AiTurnResult, ToolDefinition } from "../../types.js";
import type { ConversationMessage } from "../conversation.js";

/**
 * Lớp trừ kết nối tới backend AI (một lượt hội thoại + tool).
 * Implement: {@link BedrockLlmProvider}, {@link CaipLlmProvider}.
 */
export interface LlmProvider {
  readonly name: "bedrock" | "caip";

  completeTurn(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    modelId: string
  ): Promise<AiTurnResult>;
}
