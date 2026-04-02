import axios from "axios";
import { config } from "../../config.js";
import type { AiTurnResult, ToolCall, ToolDefinition } from "../../types.js";
import type { ConversationMessage } from "../conversation.js";
import { mockBedrockTurn } from "../bedrockMock.js";
import type { LlmProvider } from "./llmProvider.js";

type CaipWireResult =
  | { kind: "final"; text: string }
  | {
      kind: "tool_use";
      toolUseId: string;
      toolCall: { name: string; arguments?: Record<string, unknown> };
    };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseCaipResult(data: unknown): AiTurnResult {
  if (!isRecord(data) || (data.kind !== "final" && data.kind !== "tool_use")) {
    throw new Error("CAIP: response must be { kind: 'final' | 'tool_use', ... }");
  }
  const kind = data.kind;
  if (kind === "final") {
    const text = typeof data.text === "string" ? data.text : "";
    return { kind: "final", text };
  }
  const toolUseId =
    typeof data.toolUseId === "string" && data.toolUseId.length > 0
      ? data.toolUseId
      : "caip-tool-use";
  const tc = data.toolCall;
  if (!isRecord(tc) || typeof tc.name !== "string") {
    throw new Error("CAIP: tool_use requires toolCall.name");
  }
  const args =
    isRecord(tc.arguments) ? tc.arguments : {};
  const toolCall: ToolCall = { name: tc.name, arguments: args };
  return { kind: "tool_use", toolUseId, toolCall };
}

/**
 * CAIP (Cloud AI Platform / gateway nội bộ): một vòng POST JSON, contract giống {@link AiTurnResult}.
 */
export class CaipLlmProvider implements LlmProvider {
  readonly name = "caip" as const;

  async completeTurn(
    messages: ConversationMessage[],
    tools: ToolDefinition[],
    modelId: string
  ): Promise<AiTurnResult> {
    if (config.mockCaip) {
      return mockBedrockTurn(messages, tools);
    }
    const base = config.caipBaseUrl;
    if (!base) {
      throw new Error("CAIP_BASE_URL is required when AI_PROVIDER=caip and MOCK_CAIP=false");
    }
    const path = config.caipCompletePath.startsWith("/")
      ? config.caipCompletePath
      : `/${config.caipCompletePath}`;
    const url = `${base}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.caipApiKey) {
      headers.Authorization = `Bearer ${config.caipApiKey}`;
    }
    const body = {
      modelId,
      messages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
    const { data } = await axios.post<CaipWireResult>(url, body, {
      headers,
      timeout: config.caipTimeoutMs,
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return parseCaipResult(data);
  }
}
