package com.example.tooltool.tool;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Registry các {@link ToolHandler} (mỗi handler là một bean). Resolve theo tên tool cho
 * {@link com.example.tooltool.service.ToolExecutorService}.
 */
@Component
public class ToolFactory {

  private final Map<String, ToolHandler> byName;

  public ToolFactory(List<ToolHandler> handlers) {
    this.byName =
        handlers.stream()
            .collect(
                Collectors.toUnmodifiableMap(
                    ToolHandler::toolName, Function.identity(), (a, b) -> a));
  }

  public ToolHandler resolve(String toolName) {
    ToolHandler h = byName.get(toolName);
    if (h == null) {
      throw new IllegalArgumentException("Unknown tool: " + toolName);
    }
    return h;
  }
}
