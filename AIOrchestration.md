# AIOrchestration (Node.js)

> Tham chiếu sơ đồ: `heightLevel.drawio` — block **(2) AIOrchestration** (Node.js).
> Code: thư mục project **`ai-orchestration`**.

## 1. Overview

**AIOrchestration** là **entry point** và **lớp điều phối AI** (orchestration), chạy trên Node.js, chịu trách nhiệm:

- Nhận request từ **(1) Client** (Web/Mobile)
- Decode JWT (basic), filter tool theo role
- **Chọn / routing model LLM** (policy — xem `LLM-model-routing.md`)
- Vòng lặp **AI loop** (prompt ↔ LLM ↔ tool)
- Gọi **(3) Bedrock LLM** (Bedrock Client)
- Gọi **(5) AIGate** khi LLM yêu cầu thực thi tool — **không** gọi **(6) API Core Services** trực tiếp

---

## 2. Responsibilities

### ✅ Core Responsibilities

- Parse & validate JWT (basic)
- Filter tool theo role (pre-filter)
- Build prompt cho AI
- **Choose Model LLM** (routing theo policy)
- Quản lý loop tool calling
- Gọi Bedrock API
- Gọi **AIGate** (`POST /internal/tool/execute`) khi cần tool

### ❌ Không làm

- Không truy cập DB
- Không gọi Core API trực tiếp
- Không enforce security cuối cùng (JWT đầy đủ + RBAC + data-level ở **AIGate**)
- **Không dùng Redis** cho cache nghiệp vụ — Redis/cache tập trung tại **(5) AIGate**

---

## 3. Kiến trúc liên quan (heightLevel.drawio)

| Block | Thành phần | Ghi chú |
|-------|------------|---------|
| (2) | **AIOrchestration** (Node.js — project `ai-orchestration`) | Orchestration + Bedrock + gọi AIGate execute tool |
| (3) | Bedrock LLM | Inference / tool call |
| (5) | **AIGate** | Java Reactive Gateway (Spring Cloud Gateway), JWT, RBAC, transform, Redis, gọi Core |
| (6) | API Core Services | HTTPS REST hai chiều với AIGate — **không** nối trực tiếp từ Node |
| (7) | MCP Server | Forward MCP tool invocation (HTTPS) ↔ AIGate — **không** đi qua Node |

Luồng chính (đánh số trên sơ đồ):

1. Prompt + JWT: Client → AIOrchestration  
2. Prompt + Tools: AIOrchestration → Bedrock  
3. Tool Call / Answer: Bedrock ↔ AIOrchestration  
4. Execute Tool: AIOrchestration → **AIGate** (màu đỏ trên sơ đồ)  
7. Tool Result: **AIGate** → AIOrchestration  
8. Final Answer: AIOrchestration → Client  

---

## 4. Cấu hình & biến môi trường

- **`AI_GATE_URL`**: base URL của **(5) AIGate** (mặc định `http://localhost:8081`). Vẫn đọc **`JAVA_TOOL_SERVICE_URL`** nếu chưa đổi tên (tương thích).
- **`BEDROCK_MODEL_ID`**: model mặc định khi gọi Bedrock (khi `MOCK_BEDROCK=false`).
- **`BEDROCK_MODEL_ID_LARGE`** *(tùy chọn)*: nếu set, code dùng cho prompt dài / gợi ý code (xem `src/services/modelRouter.ts`; mở rộng theo `LLM-model-routing.md`).

---

## 5. API Design

### Endpoint chính

```http
POST /ai/chat
```

**Request**

```json
{
  "prompt": "Tổng giao dịch hôm nay là bao nhiêu?"
}
```

**Response**

```json
{
  "answer": "Tổng giao dịch hôm nay là 1.2 tỷ VNĐ"
}
```

---

## 6. Flow xử lý

1. Nhận request từ client (+ JWT)
2. Decode JWT → lấy user info
3. Filter tool theo role
4. Chọn model LLM (policy) → gửi prompt + tool definitions → Bedrock
5. Nếu Bedrock trả tool call → gọi **AIGate**
6. Nhận tool result → đưa lại vào context → Bedrock
7. Lặp cho đến khi có final answer (giới hạn vòng lặp)
8. Trả kết quả cho client

---

## 7. Tool Filtering (Pre-filter)

```javascript
function filterToolsByRole(userRoles, tools) {
  return tools.filter((tool) =>
    tool.allowedRoles.some((role) => userRoles.includes(role))
  );
}
```

---

## 8. AI Loop Engine

```javascript
while (true) {
  const res = await bedrock.call(messages, tools);

  if (!res.tool_call) {
    return res.content;
  }

  const toolResult = await callAIGateExecute(res.tool_call);

  messages.push({
    role: "tool",
    name: res.tool_call.name,
    content: toolResult,
  });
}
```

---

## 9. Gọi AIGate

```javascript
async function callAIGateExecute(toolCall) {
  return await axios.post(`${AI_GATE_URL}/internal/tool/execute`, {
    tool: toolCall.name,
    arguments: toolCall.arguments,
    token: userToken,
  });
}
```

---

## 10. Security

- Chỉ decode JWT (không enforce đầy đủ — **AIGate** mới validate signature)
- Không trust dữ liệu từ AI
- Không truyền userId từ AI — luôn dùng từ token

---

## 11. Performance

- **Không dùng Redis ở AIOrchestration** — cache tool/registry/response tập trung ở **AIGate** (Redis).
- Có thể giữ **in-memory theo process** (tùy chọn) cho filter tool nhẹ.
- Giới hạn loop (max 5 lần)
- Timeout Bedrock

---

## 12. Logging

Log:

- requestId
- prompt
- toolCall
- toolResult
- latency

---

## 13. Summary

**AIOrchestration** là:

- **AI Brain** — orchestration, chọn model, loop, Bedrock
- Không phải security layer cuối cùng
- Không truy cập data trực tiếp
