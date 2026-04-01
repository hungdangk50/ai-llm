import { config } from "../config.js";
import type { BedrockTurnResult } from "../types.js";
import { mockBedrockTurn } from "./bedrockMock.js";
import { realBedrockTurn } from "./bedrockConverse.js";
import { callAIGateExecute } from "./aiGateClient.js";
import type { ConversationMessage } from "./conversation.js";
import { userTextMessage } from "./conversation.js";
import type { ToolDefinition } from "../types.js";
import { logger } from "../logger.js";
import { selectBedrockModelId } from "./modelRouter.js";

async function runTurn(
  messages: ConversationMessage[],
  tools: ToolDefinition[],
  bedrockModelId: string
): Promise<BedrockTurnResult> {
  if (config.mockBedrock) {
    return mockBedrockTurn(messages, tools);
  }
  return realBedrockTurn(messages, tools, bedrockModelId);
}

export async function runChatOrchestration(
  prompt: string,
  userToken: string,
  tools: ToolDefinition[],
  userRoles: string[]
): Promise<{ answer: string; bedrockModelId: string }> {
  const bedrockModelId = selectBedrockModelId(prompt, userRoles);
  const messages: ConversationMessage[] = [userTextMessage(prompt)];
  let loops = 0;

  while (loops < config.maxToolLoops) {
    loops += 1;
    const turn = await runTurn(messages, tools, bedrockModelId);

    if (turn.kind === "final") {
      return { answer: turn.text, bedrockModelId };
    }

    messages.push({
      role: "assistant",
      parts: [
        {
          toolUse: {
            toolUseId: turn.toolUseId,
            name: turn.toolCall.name,
            input: turn.toolCall.arguments,
          },
        },
      ],
    });

    logger.info({
      toolCall: turn.toolCall,
    });
    const toolPayload = await callAIGateExecute(turn.toolCall, userToken);
    logger.info({ toolResult: toolPayload });

    messages.push({
      role: "user",
      parts: [
        {
          toolResult: {
            toolUseId: turn.toolUseId,
            content: toolPayload,
          },
        },
      ],
    });
  }

  return {
    answer: `Đã đạt giới hạn vòng tool (${config.maxToolLoops}).`,
    bedrockModelId,
  };
}
