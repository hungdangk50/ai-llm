import type { ToolDefinition } from "../types.js";

export function filterToolsByRole(
  userRoles: string[],
  tools: ToolDefinition[]
): ToolDefinition[] {
  return tools.filter((tool) =>
    tool.allowedRoles.some((role) => userRoles.includes(role))
  );
}
