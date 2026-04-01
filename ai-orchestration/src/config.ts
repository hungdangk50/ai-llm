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

export const config = {
  port: envInt("PORT", 3000),
  aiGateUrl: aiGateBaseUrl(),
  jwtSecret: new TextEncoder().encode(
    envString("JWT_SECRET", "dev-secret-key-for-hs256-must-be-32bytes")
  ),
  mockBedrock: envString("MOCK_BEDROCK", "true") === "true",
  awsRegion: process.env.AWS_REGION ?? "ap-southeast-1",
  /** Model mặc định — có thể override bởi {@link selectBedrockModelId} */
  bedrockModelId:
    process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0",
  maxToolLoops: envInt("MAX_TOOL_LOOPS", 5),
  bedrockTimeoutMs: envInt("BEDROCK_TIMEOUT_MS", 60_000),
};
