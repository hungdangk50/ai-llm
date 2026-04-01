import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decodeJwtUser } from "../services/jwtUser.js";
import { getToolsForRoles } from "../services/toolsCache.js";
import { runChatOrchestration } from "../services/orchestrator.js";
import type { Logger } from "pino";

const bodySchema = z.object({
  prompt: z.string().min(1),
});

export function chatRouter(log: Logger): Router {
  const r = Router();

  r.post("/ai/chat", async (req: Request, res) => {
    const requestId = String(req.id ?? randomUUID());
    const started = Date.now();
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid body", details: parse.error.flatten() });
      return;
    }
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Authorization: Bearer <JWT>" });
      return;
    }
    const token = auth.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "Empty bearer token" });
      return;
    }

    let user;
    try {
      user = await decodeJwtUser(token);
    } catch {
      res.status(401).json({ error: "Invalid JWT" });
      return;
    }

    const { prompt } = parse.data;
    const tools = getToolsForRoles(user.roles);

    log.info({
      requestId,
      prompt,
      sub: user.sub,
      roles: user.roles,
      toolNames: tools.map((t) => t.name),
    });

    try {
      const { answer, bedrockModelId } = await runChatOrchestration(
        prompt,
        token,
        tools,
        user.roles
      );
      const latency = Date.now() - started;
      log.info({
        requestId,
        prompt,
        latency,
        bedrockModelId,
        answerPreview: answer.slice(0, 200),
      });
      res.json({ answer });
    } catch (e) {
      const latency = Date.now() - started;
      const err = e instanceof Error ? e.message : String(e);
      log.error({ requestId, prompt, latency, err });
      res.status(502).json({ error: err });
    }
  });

  return r;
}
