package com.example.tooltool.gateway;

import com.example.tooltool.security.ExchangeAuthAttributes;
import com.example.tooltool.security.JwtService;
import com.example.tooltool.service.RbacService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpRequestDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * Verify JWT và RBAC theo tool trước khi request tới handler {@code POST /internal/tool/execute}.
 * Đọc body một lần, tái cấp phát body cho downstream (controller {@code @RequestBody}).
 */
@Component
public class AuthorizationGatewayFilter implements GlobalFilter, Ordered {

  private static final String TOOL_EXECUTE_PATH = "/internal/tool/execute";

  private final JwtService jwtService;
  private final RbacService rbacService;
  private final ObjectMapper objectMapper;

  public AuthorizationGatewayFilter(
      JwtService jwtService, RbacService rbacService, ObjectMapper objectMapper) {
    this.jwtService = jwtService;
    this.rbacService = rbacService;
    this.objectMapper = objectMapper;
  }

  @Override
  public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    ServerHttpRequest request = exchange.getRequest();
    if (!HttpMethod.POST.equals(request.getMethod())
        || !TOOL_EXECUTE_PATH.equals(request.getPath().value())) {
      return chain.filter(exchange);
    }

    return DataBufferUtils.join(request.getBody())
        .flatMap(
            dataBuffer -> {
              byte[] bytes = new byte[dataBuffer.readableByteCount()];
              dataBuffer.read(bytes);
              DataBufferUtils.release(dataBuffer);
              String bodyStr = new String(bytes, StandardCharsets.UTF_8);
              if (bodyStr.isBlank()) {
                return writeError(exchange, HttpStatus.BAD_REQUEST, "Empty body");
              }
              final JsonNode root;
              try {
                root = objectMapper.readTree(bodyStr);
              } catch (Exception e) {
                return writeError(exchange, HttpStatus.BAD_REQUEST, "Invalid JSON");
              }
              String token = text(root, "token");
              String tool = text(root, "tool");
              if (tool == null || tool.isBlank()) {
                return writeError(exchange, HttpStatus.BAD_REQUEST, "tool required");
              }
              if (token == null || token.isBlank()) {
                return writeError(exchange, HttpStatus.BAD_REQUEST, "token required");
              }
              final byte[] bodyBytes = bodyStr.getBytes(StandardCharsets.UTF_8);
              return Mono.fromCallable(() -> jwtService.parseAndValidate(token))
                  .subscribeOn(Schedulers.boundedElastic())
                  .flatMap(
                      (Claims claims) -> {
                        if (!rbacService.isAllowed(jwtService.roles(claims), tool)) {
                          return writeError(exchange, HttpStatus.FORBIDDEN, "tool not allowed for roles");
                        }
                        exchange.getAttributes().put(ExchangeAuthAttributes.CLAIMS, claims);
                        ServerHttpRequestDecorator decorated =
                            new ServerHttpRequestDecorator(request) {
                              @Override
                              public Flux<DataBuffer> getBody() {
                                return Flux.just(
                                    exchange.getResponse().bufferFactory().wrap(bodyBytes));
                              }

                              @Override
                              public HttpHeaders getHeaders() {
                                HttpHeaders h = new HttpHeaders();
                                h.putAll(getDelegate().getHeaders());
                                h.setContentLength(bodyBytes.length);
                                return h;
                              }
                            };
                        return chain.filter(exchange.mutate().request(decorated).build());
                      })
                  .onErrorResume(
                      JwtException.class,
                      e -> writeError(exchange, HttpStatus.UNAUTHORIZED, "invalid or expired token"));
            });
  }

  private static String text(JsonNode node, String field) {
    if (node == null || !node.has(field) || node.get(field).isNull()) {
      return null;
    }
    JsonNode v = node.get(field);
    return v.isTextual() ? v.asText() : v.asText();
  }

  private Mono<Void> writeError(ServerWebExchange exchange, HttpStatus status, String message) {
    exchange.getResponse().setStatusCode(status);
    exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
    try {
      byte[] bytes = objectMapper.writeValueAsBytes(Map.of("message", message));
      DataBuffer buf = exchange.getResponse().bufferFactory().wrap(bytes);
      return exchange.getResponse().writeWith(Mono.just(buf));
    } catch (Exception e) {
      return exchange.getResponse().setComplete();
    }
  }

  @Override
  public int getOrder() {
    return Ordered.HIGHEST_PRECEDENCE + 200;
  }
}
