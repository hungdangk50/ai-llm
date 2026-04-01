# Chọn LLM model theo prompt (user)

Tài liệu ghi lại các hướng **routing model** từ prompt người dùng, từ đơn giản đến nâng cao.

**Triển khai trong kiến trúc:** block **(2) AIOrchestration** (`heightLevel.drawio`, `AIOrchestration.md`, project `ai-orchestration`) — mục **Choose Model LLM** / Bedrock Client.

---

## 1. Routing theo quy tắc (rule-based)

**Ý tưởng:** map prompt → nhãn (intent / ngôn ngữ / độ phức tạp) → bảng chọn model cố định.

- **Ngôn ngữ:** detect `vi` / `en` (ví dụ fastText, `franc`, hoặc bước detect nhẹ) → chọn model phù hợp từng ngôn ngữ nếu có.
- **Intent (keyword / regex):** ví dụ chứa “SQL”, “debug”, “tóm tắt”, “dịch”, “code” → route sang model mạnh hơn hoặc model chuyên code.
- **Độ dài prompt:** `len(prompt)` và ước lượng token → prompt ngắn dùng model nhỏ/rẻ; prompt dài hoặc multi-step dùng model lớn hơn.
- **User/tenant tier:** enterprise → model tốt hơn; free → model rẻ.

| Ưu điểm | Nhược điểm |
|--------|------------|
| Rẻ, nhanh, giải thích được, dễ audit | Phải bảo trì rule, nhiều edge case |

---

## 2. Điểm số heuristic (scoring)

Gán điểm cho từng tín hiệu rồi cộng:

- +2 nếu có khối code (regex backtick / fence)
- +2 nếu có từ khóa reasoning (“tại sao”, “chứng minh”, “phân tích sâu”)
- +1 mỗi N ký tự (ví dụ mỗi 500)
- +2 nếu user chọn “chế độ chất lượng cao”

Ví dụ ngưỡng:

- `score < 5` → model nhỏ
- `5–10` → model trung
- `> 10` → model mạnh

| Ưu điểm | Nhược điểm |
|--------|------------|
| Linh hoạt hơn rule cứng | Vẫn cần tune thủ công, nên đo trên log thật |

---

## 3. Phân loại bằng model nhỏ (classifier)

Dùng **model rẻ** hoặc **embedding + classifier** để gán nhãn, ví dụ:

`CODE`, `SUMMARY`, `CHAT`, `MATH`, `DATA`, `TRANSLATION`, `RAG_HEAVY`

Mỗi nhãn map sang một model (hoặc cặp model + giới hạn token).

| Ưu điểm | Nhược điểm |
|--------|------------|
| Học được từ dữ liệu, ít rule tay | Cần dữ liệu gán nhãn, pipeline đánh giá, thêm một bước latency |

---

## 4. Embedding + nearest neighbor

- Embed prompt (có thể kèm vài turn hội thoại gần nhất).
- So khớp với **tập ví dụ đã gán sẵn model** (k-NN) → chọn model theo đa số láng giềng.

| Ưu điểm | Nhược điểm |
|--------|------------|
| Cập nhật bằng cách thêm ví dụ | Cần bộ ví dụ chất lượng; outlier dễ sai |

---

## 5. Ràng buộc chi phí & SLA (policy layer)

Dù thuật toán chính là gì, nên có lớp policy:

- **Budget / quota:** hết quota → ép model rẻ hoặc từ chối.
- **Latency SLO:** cần p95 thấp → ưu tiên model nhanh / region gần.
- **Fallback:** model chính lỗi hoặc timeout → model dự phòng.

---

## 6. An toàn (safety routing)

- Prompt có pattern nhạy cảm (PII, nội dung rủi ro, jailbreak) → model an toàn hơn **hoặc** chặn trước khi gọi LLM chính (policy engine, không chỉ đổi model).

---

## Lộ trình triển khai gợi ý

1. **Giai đoạn 1:** rule + scoring đơn giản + policy cost/latency.
2. **Giai đoạn 2:** log `prompt → model đã chọn → quality signal` (vote, thumbs, task success, lỗi tool).
3. **Giai đoạn 3:** thêm classifier nhẹ hoặc embedding router khi có đủ dữ liệu.

---

## Quality signal để cải thiện

- Feedback người dùng
- Độ dài / chất lượng câu trả lời (metric nội bộ)
- Số vòng tool, retry, lỗi parse tool

---

*Tài liệu tham khảo nội bộ — có thể mở rộng thêm bảng routing cụ thể (điều kiện → model ID) theo từng môi trường (Bedrock, OpenAI, …).*
