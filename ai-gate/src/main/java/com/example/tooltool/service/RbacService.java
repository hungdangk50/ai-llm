package com.example.tooltool.service;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RbacService {

  public boolean isAllowed(List<String> roles, String tool) {
    return switch (tool) {
      case "get_today_transactions" ->
          roles.contains("user") || roles.contains("admin");
      default -> false;
    };
  }
}
