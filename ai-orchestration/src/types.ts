export type ToolDefinition = {
  name: string;
  description: string;
  allowedRoles: string[];
  /** JSON Schema object for Bedrock tool input */
  inputSchema: Record<string, unknown>;
};

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

/** Kết quả một lượt gọi LLM (dùng chung cho mọi provider: Bedrock, CAIP, …). */
export type AiTurnResult =
  | { kind: "final"; text: string }
  | { kind: "tool_use"; toolCall: ToolCall; toolUseId: string };

/** @deprecated Dùng {@link AiTurnResult} — giữ alias cho code cũ. */
export type BedrockTurnResult = AiTurnResult;
