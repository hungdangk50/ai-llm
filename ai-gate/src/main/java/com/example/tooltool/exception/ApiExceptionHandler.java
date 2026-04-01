package com.example.tooltool.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import reactor.core.publisher.Mono;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(IllegalArgumentException.class)
  public Mono<ResponseEntity<Map<String, String>>> badRequest(IllegalArgumentException ex) {
    return Mono.just(ResponseEntity.badRequest().body(Map.of("message", ex.getMessage())));
  }

  @ExceptionHandler(WebExchangeBindException.class)
  public Mono<ResponseEntity<Map<String, String>>> validation(WebExchangeBindException ex) {
    String msg =
        ex.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .orElse("validation failed");
    return Mono.just(ResponseEntity.badRequest().body(Map.of("message", msg)));
  }
}
