package com.example.tooltool.tool;

import com.example.tooltool.service.CoreTransactionClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
public class GetTodayTransactionsToolHandler implements ToolHandler {

  private final CoreTransactionClient core;

  public GetTodayTransactionsToolHandler(CoreTransactionClient core) {
    this.core = core;
  }

  @Override
  public String toolName() {
    return "get_today_transactions";
  }

  @Override
  public Mono<JsonNode> execute(JsonNode arguments, String userId) {
    String date = arguments.path("date").asText(null);
    if (date == null || date.isBlank()) {
      return Mono.error(new IllegalArgumentException("Missing or invalid date"));
    }
    return core.getTodayTransactions(userId, date);
  }
}
