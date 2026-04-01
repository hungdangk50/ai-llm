import { config } from "../config.js";

/**
 * Chọn Bedrock modelId theo policy đơn giản (mở rộng theo `LLM-model-routing.md`).
 * - Prompt dài hoặc giống code → BEDROCK_MODEL_ID_LARGE nếu có.
 * - Ngược lại → BEDROCK_MODEL_ID (default trong config).
 */
export function selectBedrockModelId(prompt: string, _userRoles: string[]): string {
  const largeModel = process.env.BEDROCK_MODEL_ID_LARGE?.trim();
  if (!largeModel) {
    return config.bedrockModelId;
  }
  const longPrompt = prompt.length > 8000;
  const codeLike = /```|def\s|function\s|class\s|SELECT\s|INSERT\s/i.test(prompt);
  if (longPrompt || codeLike) {
    return largeModel;
  }
  return config.bedrockModelId;
}
