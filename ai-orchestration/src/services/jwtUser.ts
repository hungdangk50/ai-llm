import * as jose from "jose";
import { config } from "../config.js";

export type JwtUser = {
  sub: string;
  roles: string[];
};

/**
 * Decode JWT (basic): không enforce — **AIGate** mới validate đầy đủ.
 */
export async function decodeJwtUser(token: string): Promise<JwtUser> {
  const { payload } = await jose.jwtVerify(token, config.jwtSecret, {
    algorithms: ["HS256"],
  });
  const sub = String(payload.sub ?? "");
  const rolesRaw = payload.roles ?? payload["authorities"];
  let roles: string[] = [];
  if (Array.isArray(rolesRaw)) {
    roles = rolesRaw.map(String);
  } else if (typeof rolesRaw === "string") {
    roles = rolesRaw.split(",").map((r) => r.trim()).filter(Boolean);
  }
  return { sub, roles };
}
