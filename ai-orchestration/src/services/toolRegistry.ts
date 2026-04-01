import type { ToolDefinition } from "../types.js";

/** Danh sách tool gửi Bedrock (pre-filter theo role ở layer khác). */
export const allTools: ToolDefinition[] = [
  {
    name: "get_today_transactions",
    description:
      "Lấy tổng giao dịch theo ngày cho user hiện tại. Ngày định dạng YYYY-MM-DD.",
    allowedRoles: ["user", "admin"],
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Ngày YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
];
