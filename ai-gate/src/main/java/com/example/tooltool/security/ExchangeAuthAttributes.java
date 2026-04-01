package com.example.tooltool.security;

import io.jsonwebtoken.Claims;
import org.springframework.web.server.ServerWebExchange;

/** Attribute keys trên {@link ServerWebExchange} sau khi JWT + RBAC pass. */
public final class ExchangeAuthAttributes {

  public static final String CLAIMS = "com.example.tooltool.auth.claims";

  private ExchangeAuthAttributes() {}

  public static Claims claims(ServerWebExchange exchange) {
    Object o = exchange.getAttribute(CLAIMS);
    return o instanceof Claims c ? c : null;
  }
}
