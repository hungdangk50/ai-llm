function envString(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env: ${name}`);
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** URL **(5) AIGate** — ưu tiên AI_GATE_URL, tương thích JAVA_TOOL_SERVICE_URL cũ. */
function aiGateBaseUrl(): string {
  const fromNew = process.env.AI_GATE_URL;
  if (fromNew !== undefined && fromNew !== "") return fromNew;
  const legacy = process.env.JAVA_TOOL_SERVICE_URL;
  if (legacy !== undefined && legacy !== "") return legacy;
  return "http://localhost:8081";
}

export type AiProviderKind = "bedrock" | "caip";

function aiProviderFromEnv(): AiProviderKind {
  const raw = (process.env.AI_PROVIDER ?? "bedrock").trim().toLowerCase();
  if (raw === "caip") return "caip";
  return "bedrock";
}

export const config = {
  port: envInt("PORT", 3000),
  aiGateUrl: aiGateBaseUrl(),
  jwtSecret: new TextEncoder().encode(
    envString("JWT_SECRET", "dev-secret-key-for-hs256-must-be-32bytes")
  ),
  /** Provider LLM: `bedrock` | `caip` */
  aiProvider: aiProviderFromEnv(),
  mockBedrock: envString("MOCK_BEDROCK", "true") === "true",
  /** Khi AI_PROVIDER=caip: bật mock (không gọi HTTP CAIP). */
  mockCaip: envString("MOCK_CAIP", "true") === "true",
  awsRegion: process.env.AWS_REGION ?? "ap-southeast-1",
  /** Model mặc định — có thể override bởi {@link selectBedrockModelId} */
  bedrockModelId:
    process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0",
  /** Model / deployment id gửi tới CAIP (HTTP). */
  caipModelId: process.env.CAIP_MODEL_ID ?? "default",
  /** Base URL dịch vụ CAIP (REST). Ví dụ gateway nội bộ hoặc Vertex proxy. */
  caipBaseUrl: (process.env.CAIP_BASE_URL ?? "").replace(/\/$/, ""),
  /** Đường dẫn POST (nối sau base), mặc định `/v1/llm/complete`. */
  caipCompletePath: process.env.CAIP_COMPLETE_PATH ?? "/v1/llm/complete",
  /** Bearer tùy chọn cho CAIP */
  caipApiKey: process.env.CAIP_API_KEY?.trim() ?? "",
  maxToolLoops: envInt("MAX_TOOL_LOOPS", 5),
  bedrockTimeoutMs: envInt("BEDROCK_TIMEOUT_MS", 60_000),
  caipTimeoutMs: envInt("CAIP_TIMEOUT_MS", 60_000),
};
