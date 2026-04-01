package com.example.tooltool.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private final SecretKey key;

  public JwtService(@Value("${jwt.secret}") String secret) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  public Claims parseAndValidate(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }

  public String userId(Claims claims) {
    return claims.getSubject();
  }

  @SuppressWarnings("unchecked")
  public List<String> roles(Claims claims) {
    Object raw = claims.get("roles");
    if (raw == null) {
      return List.of();
    }
    if (raw instanceof List<?> list) {
      List<String> out = new ArrayList<>();
      for (Object o : list) {
        out.add(String.valueOf(o));
      }
      return out;
    }
    if (raw instanceof String s) {
      String[] parts = s.split(",");
      List<String> out = new ArrayList<>();
      for (String p : parts) {
        if (!p.isBlank()) {
          out.add(p.trim());
        }
      }
      return out;
    }
    return List.of();
  }
}
