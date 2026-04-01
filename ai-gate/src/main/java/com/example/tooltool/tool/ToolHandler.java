package com.example.tooltool.tool;

import com.fasterxml.jackson.databind.JsonNode;
import reactor.core.publisher.Mono;

/** Một tool cụ thể — đăng ký qua Spring bean, resolve bởi {@link ToolFactory}. */
public interface ToolHandler {

  /** Tên tool khớp field {@code tool} trong request (ví dụ {@code get_today_transactions}). */
  String toolName();

  /** Thực thi tool; {@code userId} lấy từ JWT (subject), không tin từ client. */
  Mono<JsonNode> execute(JsonNode arguments, String userId);
}
