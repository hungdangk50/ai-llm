package com.example.tooltool.service;

import com.example.tooltool.tool.ToolFactory;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class ToolExecutorService {

  private final ToolFactory toolFactory;

  public ToolExecutorService(ToolFactory toolFactory) {
    this.toolFactory = toolFactory;
  }

  /** Trả về payload cho field {@code result} trong response API. */
  public Mono<JsonNode> execute(String toolName, JsonNode arguments, String userId) {
    return Mono.fromCallable(() -> toolFactory.resolve(toolName))
        .flatMap(h -> h.execute(arguments, userId));
  }
}
