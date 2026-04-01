import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";
import type { BedrockTurnResult, ToolDefinition } from "../types.js";
import type { ConversationMessage } from "./conversation.js";

const client = new BedrockRuntimeClient({ region: config.awsRegion });

function toBedrockMessages(messages: ConversationMessage[]): Message[] {
  const out: Message[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const content: ContentBlock[] = [];
      for (const p of m.parts) {
        if ("text" in p) {
          content.push({ text: p.text });
        } else if ("toolResult" in p) {
          const c = p.toolResult.content;
          const jsonDoc =
            typeof c === "object" && c !== null
              ? (c as Record<string, unknown>)
              : { value: String(c) };
          content.push({
            toolResult: {
              toolUseId: p.toolResult.toolUseId,
              content: [{ json: jsonDoc as never }],
            },
          });
        }
      }
      out.push({ role: "user", content });
    } else {
      const content: ContentBlock[] = [];
      for (const p of m.parts) {
        if ("text" in p) {
          content.push({ text: p.text });
        } else if ("toolUse" in p) {
          content.push({
            toolUse: {
              toolUseId: p.toolUse.toolUseId,
              name: p.toolUse.name,
              input: p.toolUse.input as never,
            },
          });
        }
      }
      out.push({ role: "assistant", content });
    }
  }
  return out;
}

function parseTurn(outputMessage: Message | undefined): BedrockTurnResult {
  if (!outputMessage?.content?.length) {
    return { kind: "final", text: "" };
  }
  for (const block of outputMessage.content) {
    if (block.toolUse?.name) {
      const input = block.toolUse.input;
      const args =
        typeof input === "object" && input !== null
          ? (input as Record<string, unknown>)
          : {};
      return {
        kind: "tool_use",
        toolUseId: block.toolUse.toolUseId ?? "tool-use",
        toolCall: {
          name: block.toolUse.name,
          arguments: args,
        },
      };
    }
  }
  for (const block of outputMessage.content) {
    if (block.text) {
      return { kind: "final", text: block.text };
    }
  }
  return { kind: "final", text: "" };
}

export async function realBedrockTurn(
  messages: ConversationMessage[],
  tools: ToolDefinition[],
  modelId: string
): Promise<BedrockTurnResult> {
  const bedrockMessages = toBedrockMessages(messages);
  const cmd = new ConverseCommand({
    modelId,
    messages: bedrockMessages,
    toolConfig: {
      tools: tools.map((t) => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          inputSchema: {
            json: t.inputSchema as never,
          },
        },
      })) as never,
    },
    inferenceConfig: {
      maxTokens: 1024,
    },
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), config.bedrockTimeoutMs);
  try {
    const resp = await client.send(cmd, { abortSignal: ac.signal });
    return parseTurn(resp.output?.message);
  } finally {
    clearTimeout(timer);
  }
}
