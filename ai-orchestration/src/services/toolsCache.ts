import { allTools } from "./toolRegistry.js";
import { filterToolsByRole } from "./toolFilter.js";
import type { ToolDefinition } from "../types.js";

/** Cache in-memory theo process — không Redis. Redis/tool registry dùng ở **(5) AIGate**. */
const cache = new Map<string, ToolDefinition[]>();

export function getToolsForRoles(roles: string[]): ToolDefinition[] {
  const key = [...roles].sort().join(",");
  const hit = cache.get(key);
  if (hit) return hit;
  const filtered = filterToolsByRole(roles, allTools);
  cache.set(key, filtered);
  return filtered;
}
