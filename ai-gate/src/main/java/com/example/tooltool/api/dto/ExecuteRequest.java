package com.example.tooltool.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ExecuteRequest(
    @NotBlank String tool,
    @NotNull JsonNode arguments,
    @NotBlank String token) {}
