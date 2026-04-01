package com.example.tooltool.api;

import com.example.tooltool.api.dto.ExecuteRequest;
import com.example.tooltool.api.dto.ExecuteResponse;
import com.example.tooltool.security.ExchangeAuthAttributes;
import com.example.tooltool.security.JwtService;
import com.example.tooltool.service.InputValidationService;
import com.example.tooltool.service.ToolExecutorService;
import com.fasterxml.jackson.databind.JsonNode;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/internal/tool")
public class ToolController {

  private static final Logger log = LoggerFactory.getLogger(ToolController.class);

  private final JwtService jwtService;
  private final InputValidationService inputValidationService;
  private final ToolExecutorService toolExecutorService;

  public ToolController(
      JwtService jwtService,
      InputValidationService inputValidationService,
      ToolExecutorService toolExecutorService) {
    this.jwtService = jwtService;
    this.inputValidationService = inputValidationService;
    this.toolExecutorService = toolExecutorService;
  }

  /**
   * JWT + RBAC đã xử lý tại {@link com.example.tooltool.gateway.AuthorizationGatewayFilter}; controller
   * chỉ đọc {@link Claims} từ exchange và validate input.
   */
  @PostMapping("/execute")
  public Mono<ResponseEntity<?>> execute(
      ServerWebExchange exchange, @Valid @RequestBody ExecuteRequest request) {
    Claims claims = ExchangeAuthAttributes.claims(exchange);
    if (claims == null) {
      return Mono.<ResponseEntity<?>>just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    String userId = jwtService.userId(claims);
    try {
      inputValidationService.validateToolArguments(request.tool(), request.arguments());
    } catch (IllegalArgumentException e) {
      return Mono.<ResponseEntity<?>>just(ResponseEntity.badRequest().build());
    }
    return toolExecutorService
        .execute(request.tool(), request.arguments(), userId)
        .flatMap(
            result -> {
              auditLog(request.tool(), userId, request.arguments(), result);
              return Mono.<ResponseEntity<?>>just(
                  ResponseEntity.ok(new ExecuteResponse(result)));
            })
        .onErrorResume(
            IllegalArgumentException.class,
            e -> Mono.<ResponseEntity<?>>just(ResponseEntity.badRequest().build()));
  }

  private void auditLog(String tool, String userId, JsonNode input, JsonNode output) {
    log.info(
        "audit tool={} userId={} input={} output={} ts={}",
        tool,
        userId,
        input,
        output,
        Instant.now());
  }
}
