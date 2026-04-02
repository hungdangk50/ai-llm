import { config } from "../../config.js";
import type { AiTurnResult, ToolDefinition } from "../../types.js";
import type { ConversationMessage } from "../conversation.js";
import { mockBedrockTurn } from "../bedrockMock.js";
import { realBedrockTurn } from "../bedrockConverse.js";
import type { LlmProvider } from "./llmProvider.js";

export class BedrockLlmProvider implements LlmProvider {
  readonly name = "bedrock" as const;

  async completeTurn(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    modelId: string
  ): Promise<AiTurnResult> {
    if (config.mockBedrock) {
      return mockBedrockTurn(messages, tools);
    }
    return realBedrockTurn(messages, tools, modelId);
  }
}
