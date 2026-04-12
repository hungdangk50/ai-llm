# Chuẩn message: Amazon Bedrock → AI Orchestrator → AI Gate → MCP Server / Core API

Tài liệu mô tả **payload** từng chặng khi LLM là **AWS Bedrock** (API **Converse** — `ConverseCommand` / `bedrock-runtime`). Triển khai tham chiếu: `ai-orchestration` (`bedrockConverse.ts`), `ai-gate`.

---

## 1. Amazon Bedrock Converse ↔ AI Orchestrator

Orchestrator gọi **một lượt** `Converse` với `messages` + `toolConfig`, rồi đọc `response.output.message` (danh sách `ContentBlock`).

### 1.1 Đăng ký tool gửi Bedrock (`toolConfig`)

Mỗi tool map sang `toolSpec` (tên, mô tả, JSON Schema đầu vào):

```json
{
  "toolConfig": {
    "tools": [
      {
        "toolSpec": {
          "name": "get_today_transactions",
          "description": "Lấy tổng giao dịch theo ngày.",
          "inputSchema": {
            "json": {
              "type": "object",
              "properties": {
                "date": { "type": "string", "format": "date" }
              },
              "required": ["date"]
            }
          }
        }
      }
    ]
  }
}
```

- Trong SDK: `inputSchema: { json: <schema object> }` — schema là **JSON Schema** object (Bedrock yêu cầu bọc dưới `json`).

### 1.2 Phản hồi model — `ContentBlock` (assistant)

**Text (kết thúc lượt, không gọi tool):**

```json
{
  "role": "assistant",
  "content": [
    {
      "text": "Câu trả lời text cho người dùng."
    }
  ]
}
```

**Tool use (model yêu cầu gọi tool):**

```json
{
  "role": "assistant",
  "content": [
    {
      "toolUse": {
        "toolUseId": "tooluse_01JABC...",
        "name": "get_today_transactions",
        "input": {
          "date": "2026-03-25"
        }
      }
    }
  ]
}
```

- Bedrock dùng **`input`**, không dùng tên `arguments` trong API Converse.
- **`toolUseId`**: bắt buộc giữ nguyên khi gửi **`toolResult`** ở user message tiếp theo.

### 1.3 Chuẩn nội bộ sau khi parse (`AiTurnResult` — orchestrator)

Code map `ContentBlock.toolUse` → cấu trúc nội bộ để gọi AIGate (`toolCall.arguments` = `toolUse.input`):

```json
{
  "kind": "final",
  "text": "Câu trả lời text cho người dùng."
}
```

```json
{
  "kind": "tool_use",
  "toolUseId": "tooluse_01JABC...",
  "toolCall": {
    "name": "get_today_transactions",
    "arguments": {
      "date": "2026-03-25"
    }
  }
}
```

| Bedrock Converse (`output.message.content[]`) | Sau parse (orchestrator) |
|-----------------------------------------------|---------------------------|
| `toolUse.toolUseId` | `toolUseId` |
| `toolUse.name` | `toolCall.name` |
| `toolUse.input` | `toolCall.arguments` |
| `text` | `kind: "final"`, `text` |

---

## 2. AI Orchestrator — message vòng lặp (map sang Bedrock `Message`)

Trong code, `ConversationMessage` được chuyển thành `Message` + `ContentBlock` cho `ConverseCommand` (`toBedrockMessages`).

### 2.1 Assistant (đối chiếu Bedrock)

```json
{
  "role": "assistant",
  "parts": [
    {
      "toolUse": {
        "toolUseId": "tooluse_01JABC...",
        "name": "get_today_transactions",
        "input": {
          "date": "2026-03-25"
        }
      }
    }
  ]
}
```

→ Gửi Bedrock: `content: [{ toolUse: { toolUseId, name, input } }]`.

### 2.2 User — `toolResult` (sau khi AIGate trả về)

Nội bộ orchestrator có thể để `content` là object; khi build request Bedrock, kết quả được đưa vào **`toolResult.content` dạng JSON block**:

```json
{
  "role": "user",
  "content": [
    {
      "toolResult": {
        "toolUseId": "tooluse_01JABC...",
        "content": [
          {
            "json": {
              "totalAmount": 1200000000,
              "currency": "VND"
            }
          }
        ]
      }
    }
  ]
}
```

- Đây là hình thức **Wire Bedrock** (SDK): `toolResult.content` là mảng các block; với kết quả structured, dùng **`{ "json": { ... } }`**.
- Payload nghiệp vụ thường lấy từ field **`result`** trong response AIGate (mục 3.2).

---

## 3. AI Orchestrator → AI Gate

**HTTP:** `POST /internal/tool/execute`  
**Header:** `Content-Type: application/json`

### 3.1 Request (khớp `ExecuteRequest` Java)

```json
{
  "tool": "get_today_transactions",
  "arguments": {
    "date": "2026-03-25"
  },
  "token": "<JWT của user — AIGate verify + RBAC>"
}
```

| Trường | Bắt buộc | Ghi chú |
|--------|----------|---------|
| `tool` | Có | = `toolUse.name` (Bedrock) |
| `arguments` | Có | = `toolUse.input` — **không** tin `userId` từ model; `userId` từ JWT tại Gate |
| `token` | Có | JWT |

### 3.2 Response thành công (HTTP 200)

```json
{
  "result": {
    "totalAmount": 1200000000,
    "currency": "VND"
  }
}
```

- Orchestrator đưa `result` vào **`toolResult.content` → `{ json: result }`** cho lượt `Converse` kế tiếp.

### 3.3 Lỗi (rút gọn)

| HTTP | Tình huống |
|------|------------|
| 400 | JSON/tool/token không hợp lệ, validate input |
| 401 | JWT không hợp lệ / thiếu |
| 403 | RBAC |

---

## 4. AI Gate → API Core Services (HTTPS REST)

AIGate transform LLM/Core. Ví dụ:

```http
POST /api/v1/.../transactions/summary
Authorization: Bearer <service-token hoặc policy nội bộ>
Content-Type: application/json
```

```json
{
  "userId": "sub-from-jwt",
  "date": "2026-03-25"
}
```

```json
{
  "totalAmount": 1200000000,
  "currency": "VND"
}
```

- **`userId`**: chỉ từ JWT đã verify tại Gate.

---

## 5. MCP Server ↔ AI Gate

MCP: **JSON-RPC 2.0**. Kiến trúc: MCP Client ↔ MCP Server ↔ (HTTPS) ↔ AIGate (không qua Node orchestration).

### 5.1 `tools/call` (client → MCP server)

```json
{
  "jsonrpc": "2.0",
  "id": "mcp-req-001",
  "method": "tools/call",
  "params": {
    "name": "get_today_transactions",
    "arguments": {
      "date": "2026-03-25"
    }
  }
}
```

### 5.2 Kết quả thành công (server → client)

```json
{
  "jsonrpc": "2.0",
  "id": "mcp-req-001",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"totalAmount\":1200000000,\"currency\":\"VND\"}"
      }
    ],
    "isError": false
  }
}
```

### 5.3 MCP Server → AIGate

- `POST {AIGATE_BASE}/internal/tool/execute` với body giống **mục 3**; `token` từ ngữ cảnh MCP (không do model tự chế).

### 5.4 Lỗi JSON-RPC

```json
{
  "jsonrpc": "2.0",
  "id": "mcp-req-001",
  "error": {
    "code": -32603,
    "message": "AIGate 403: forbidden"
  }
}
```

---

## 6. Correlation ID

| Chặng | ID |
|-------|-----|
| Bedrock tool loop | `toolUseId` (Converse) |
| HTTP AIGate | `X-Request-Id` / trace (tùy triển khai) |
| MCP | `id` (JSON-RPC) |

---

## 7. Ghi chú Bedrock & triển khai

- **API:** `Converse` (Bedrock Runtime), không mô tả chi tiết InvokeModel raw body ở đây.
- **Model ID:** biến môi trường kiểu `BEDROCK_MODEL_ID` (region + `modelId` trong `ConverseCommand`).
- **Timeout / retry:** `bedrockTimeoutMs` (orchestrator); retry policy theo AWS SDK.
- **Wire AIGate** không đổi: `tool` + `arguments` + `token` / `result` — khớp `ExecuteRequest` / `ExecuteResponse`.
- Luồng **chỉ Bedrock**: không dùng nhánh provider khác trong tài liệu này; nếu sau này thêm provider, giữ **lớp parse** map về cùng `toolCall` + `toolUseId` rồi mới gọi Gate.
