# AIGate (Java)

> Tham chiếu sơ đồ: `heightLevel.drawio` — block **(5) AIGate**.
> Code: thư mục project **`ai-gate`**.

## 1. Overview

**AIGate** là service nội bộ (Java) gồm:

- **Spring Cloud Gateway (Reactive)** — Netty, `spring-cloud-starter-gateway` (theo sơ đồ)
- **Handler nội bộ** `POST /internal/tool/execute` — WebFlux (`Mono`), không Servlet MVC
- **Gọi Core** — `WebClient` (reactive), không `RestTemplate`
- Xác thực JWT đầy đủ, RBAC, thực thi tool
- **Transform** request/response giữa **message LLM** và **message API Core** trước khi route vào Core
- Gọi **(6) API Core Services** qua **HTTPS REST hai chiều** (request ↔ response)
- **Redis** cache (tại Java): tool/registry, Core read-through (theo policy)
- Tiếp nhận **(7) MCP Server** — forward MCP tool invocation (HTTPS), không qua **(2) AIOrchestration**

### Stack kỹ thuật (triển khai)

| Thành phần | Ghi chú |
|------------|---------|
| `spring-cloud-starter-gateway` | Gateway reactive (Netty), có thể thêm route proxy sau |
| `spring-boot-starter-validation` | `@Valid` cho `ExecuteRequest` |
| `WebClient` | Gọi Core (HTTPS) — không dùng `RestTemplate` |
| `GlobalFilter` | `GatewayRequestLoggingFilter` (log); `AuthorizationGatewayFilter` (JWT + RBAC trước `/internal/tool/execute`) |

---

## 2. Responsibilities

### ✅ Core Responsibilities

- Validate JWT (signature / introspection)
- RBAC (tool-level permission)
- Data-level permission
- Execute tool (tool executor)
- **Transform** request/response (LLM ↔ Core) trước khi gọi Core
- Call **internal Core APIs** (HTTPS REST)
- **Redis**: cache read/write (tool registry, read-through Core, …)
- Logging & audit

### ❌ Không làm

- Không gọi Bedrock
- Không xử lý AI logic / orchestration loop
- Không thay **AIOrchestration** làm “AI Brain”

---

## 3. Kiến trúc liên quan (heightLevel.drawio)

| Block | Thành phần | Ghi chú |
|-------|------------|---------|
| (5) | **AIGate** (project `ai-gate`) | Spring Cloud Gateway reactive + JWT + RBAC + transform + executor + Redis |
| (6) | API Core Services | HTTPS REST **hai chiều** với AIGate |
| Tool Registry DB | Cylinder | **Load Tools** từ AIGate |
| Redis | Cache tại Java | **Read/Write cache** (nét đứt từ AIGate) |
| (7) | MCP Server | **Forward MCP tool invocation (HTTPS)** ↔ AIGate |

Luồng với **AIOrchestration** (Node):

- **4. Execute Tool** — từ Node → AIGate  
- **7. Tool Result** — AIGate → Node  

Luồng với Core:

- **HTTPS REST (2 chiều):** request ↔ response — AIGate ↔ API Core Services  

---

## 4. API Design

### Execute Tool

```http
POST /internal/tool/execute
```

**Request**

```json
{
  "tool": "get_today_transactions",
  "arguments": {
    "date": "2026-03-25"
  },
  "token": "JWT"
}
```

**Response**

```json
{
  "result": {
    "totalAmount": 1200000000,
    "currency": "VND"
  }
}
```

---

## 5. Flow xử lý

1. Nhận request từ **AIOrchestration** **hoặc** MCP (forward HTTPS)
2. **`AuthorizationGatewayFilter`** (GlobalFilter): đọc body `POST /internal/tool/execute`, parse JSON lấy `token` + `tool`, verify JWT, RBAC theo tool; body được tái cấp phát cho downstream; gắn `Claims` vào `ServerWebExchange` (`ExchangeAuthAttributes.CLAIMS`). Lỗi: 400 (JSON/tool/token), 401 (JWT), 403 (RBAC).
3. Handler `ToolController`: đọc `Claims` từ exchange, **không** parse JWT lại; `userId` = subject JWT
4. Validate input (`InputValidationService`)
5. **`ToolFactory`**: resolve bean `ToolHandler` theo tên tool → `ToolExecutorService` gọi handler
6. Transform payload sang định dạng Core API (nếu cần) — trong từng handler / client
7. Call Core API (HTTPS REST)
8. Transform response về dạng phù hợp tool/LLM
9. Trả kết quả

---

## 6. RBAC (Tool-level)

Thực hiện trong **`AuthorizationGatewayFilter`** (cùng bước verify JWT), trước khi vào controller:

```java
if (!rbacService.isAllowed(roles, tool)) {
    // 403 — response JSON { "message": "..." }
}
```

`RbacService` giữ mapping role → tool được phép (ví dụ `get_today_transactions` cho `user` / `admin`).

---

## 7. Data-level Security

**Đúng**

```sql
SELECT * FROM transactions
WHERE user_id = :userId
```

**Sai**

```sql
SELECT * FROM transactions
WHERE user_id = request.userId
```

---

## 8. Tool Executor & ToolFactory

- **`ToolHandler`**: interface mỗi tool một implementation, đăng ký là **Spring `@Component`** (ví dụ `GetTodayTransactionsToolHandler`).
- **`ToolFactory`**: inject `List<ToolHandler>`, build map `toolName → handler`; `ToolExecutorService` gọi `toolFactory.resolve(toolName).execute(arguments, userId)`.
- Thêm tool mới: tạo class `implements ToolHandler`, bổ sung rule trong `RbacService` + `InputValidationService` nếu cần.

---

## 9. Input Validation

- Validate schema JSON
- Sanitize input
- Reject invalid format

---

## 10. Security Rules

**Rule 1: Không trust Node (AIOrchestration)**

- Luôn validate lại

**Rule 2: Không trust AI**

- Không dùng input trực tiếp

**Rule 3: Override userId**

- Lấy từ token

---

## 11. Logging & Audit

Log:

- userId
- tool name
- input
- output
- timestamp

---

## 12. Performance

- **Redis (cache tại AIGate)**: tool registry snapshot, Core read-through (theo policy), session/idempotency nếu cần.
- Retry khi gọi Core API
- Timeout control

---

## 13. Summary

**AIGate** là:

- **Security Layer** (source of truth)
- **Data Access Layer** (qua Core API)
- **Tool Execution Engine**
- **Gateway + adapter** (LLM message ↔ Core message)

→ Đảm bảo hệ thống: an toàn, chính xác, tuân thủ permission.
