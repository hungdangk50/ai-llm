import { config } from "../config.js";
import type { AiTurnResult } from "../types.js";
import { callAIGateExecute } from "./aiGateClient.js";
import type { ConversationMessage } from "./conversation.js";
import { userTextMessage } from "./conversation.js";
import type { ToolDefinition } from "../types.js";
import { logger } from "../logger.js";
import { selectLlmModelId } from "./modelRouter.js";
import { getLlmProvider } from "./ai/createLlmProvider.js";

async function runTurn(
  messages: ConversationMessage[],
  tools: ToolDefinition[],
  modelId: string
): Promise<AiTurnResult> {
  const provider = getLlmProvider();
  return provider.completeTurn(messages, tools, modelId);
}

export async function runChatOrchestration(
  prompt: string,
  userToken: string,
  tools: ToolDefinition[],
  userRoles: string[]
): Promise<{ answer: string; bedrockModelId: string }> {
  const bedrockModelId = selectLlmModelId(prompt, userRoles, config.aiProvider);
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
