package com.example.tooltool.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

/** Validate input theo tool — schema tối thiểu (date YYYY-MM-DD). */
@Service
public class InputValidationService {

  private static final String DATE_PATTERN = "\\d{4}-\\d{2}-\\d{2}";

  public void validateToolArguments(String tool, JsonNode arguments) {
    if (arguments == null || arguments.isNull()) {
      throw new IllegalArgumentException("arguments required");
    }
    switch (tool) {
      case "get_today_transactions" -> {
        String date = arguments.path("date").asText("");
        if (!date.matches(DATE_PATTERN)) {
          throw new IllegalArgumentException("date must be YYYY-MM-DD");
        }
      }
      default -> throw new IllegalArgumentException("Unknown tool for validation: " + tool);
    }
  }
}
