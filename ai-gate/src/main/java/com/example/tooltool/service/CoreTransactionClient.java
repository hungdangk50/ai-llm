package com.example.tooltool.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

/**
 * Gọi Core Services (Transaction API) qua {@link WebClient} (reactive). Nếu {@code core.base-url}
 * trống, trả mock cho dev.
 */
@Service
public class CoreTransactionClient {

  private final WebClient webClient;
  private final ObjectMapper mapper;
  private final String baseUrl;
  private final int timeoutMs;

  public CoreTransactionClient(
      WebClient.Builder webClientBuilder,
      ObjectMapper mapper,
      @Value("${core.base-url:}") String baseUrl,
      @Value("${core.timeout-ms:10000}") int timeoutMs) {
    this.mapper = mapper;
    this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
    this.timeoutMs = timeoutMs;
    this.webClient =
        this.baseUrl.isEmpty()
            ? null
            : webClientBuilder.baseUrl(this.baseUrl).build();
  }

  public Mono<JsonNode> getTodayTransactions(String userId, String date) {
    if (this.baseUrl.isEmpty()) {
      return Mono.just(mockResult(userId, date));
    }
    return webClient
        .get()
        .uri(
            uriBuilder ->
                uriBuilder
                    .path("/internal/transactions/today")
                    .queryParam("userId", userId)
                    .queryParam("date", date)
                    .build())
        .retrieve()
        .bodyToMono(JsonNode.class)
        .timeout(Duration.ofMillis(timeoutMs))
        .onErrorMap(WebClientResponseException.class, ex -> ex);
  }

  private JsonNode mockResult(String userId, String date) {
    ObjectNode result = mapper.createObjectNode();
    result.put("totalAmount", 1_200_000_000L);
    result.put("currency", "VND");
    result.put("userId", userId);
    result.put("date", date);
    return result;
  }
}
