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

export type BedrockTurnResult =
  | { kind: "final"; text: string }
  | { kind: "tool_use"; toolCall: ToolCall; toolUseId: string };
