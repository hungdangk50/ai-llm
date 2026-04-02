import { config, type AiProviderKind } from "../config.js";

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

function wantsLargeModel(prompt: string): boolean {
  const longPrompt = prompt.length > 8000;
  const codeLike = /```|def\s|function\s|class\s|SELECT\s|INSERT\s/i.test(prompt);
  return longPrompt || codeLike;
}

/** Chọn model/deployment id theo provider (Bedrock hoặc CAIP). */
export function selectLlmModelId(
  prompt: string,
  userRoles: string[],
  provider: AiProviderKind
): string {
  if (provider === "caip") {
    const largeModel = process.env.CAIP_MODEL_ID_LARGE?.trim();
    if (largeModel && wantsLargeModel(prompt)) {
      return largeModel;
    }
    return config.caipModelId;
  }
  return selectBedrockModelId(prompt, userRoles);
}
