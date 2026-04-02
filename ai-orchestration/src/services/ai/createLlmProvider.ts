import { config } from "../../config.js";
import type { LlmProvider } from "./llmProvider.js";
import { BedrockLlmProvider } from "./bedrockLlmProvider.js";
import { CaipLlmProvider } from "./caipLlmProvider.js";

let cached: LlmProvider | undefined;

/** Factory singleton theo {@link config.aiProvider}. */
export function getLlmProvider(): LlmProvider {
  if (cached) return cached;
  cached =
    config.aiProvider === "caip" ? new CaipLlmProvider() : new BedrockLlmProvider();
  return cached;
}

/** Dùng trong test — reset singleton. */
export function resetLlmProviderForTests(): void {
  cached = undefined;
}
