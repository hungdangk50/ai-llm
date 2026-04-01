/**
 * Tạo JWT HS256 (roles: user) — cùng secret với ai-gate / ai-orchestration.
 * Usage: node scripts/mint-jwt.mjs
 */
import * as jose from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-key-for-hs256-must-be-32bytes"
);

const jwt = await new jose.SignJWT({ roles: ["user"] })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject("user-demo-1")
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(secret);

console.log(jwt);
