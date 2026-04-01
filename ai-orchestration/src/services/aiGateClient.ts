import axios from "axios";
import { config } from "../config.js";
import type { ToolCall } from "../types.js";

const client = axios.create({
  baseURL: config.aiGateUrl,
  timeout: 30_000,
  validateStatus: () => true,
});

/** Gọi **(5) AIGate** — `POST /internal/tool/execute`. */
export async function callAIGateExecute(
  toolCall: ToolCall,
  userToken: string
): Promise<unknown> {
  const url = "/internal/tool/execute";
  const res = await client.post(url, {
    tool: toolCall.name,
    arguments: toolCall.arguments,
    token: userToken,
  });
  if (res.status >= 400) {
    const msg =
      typeof res.data === "object" && res.data && "message" in res.data
        ? String((res.data as { message?: string }).message)
        : res.statusText;
    throw new Error(`AIGate ${res.status}: ${msg}`);
  }
  return res.data;
}
