/**
 * **(2) AIOrchestration** — entry Node.js: Bedrock, loop tool, gọi AIGate.
 * @see AIOrchestration.md
 */
import express from "express";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { chatRouter } from "./routes/chat.js";
import { logger } from "./logger.js";

const log = logger;

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(
  pinoHttp({
    logger: log,
    genReqId: (req) => req.header("x-request-id") ?? randomUUID(),
  })
);

app.use(chatRouter(log));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(config.port, () => {
  log.info(
    {
      service: "AIOrchestration",
      port: config.port,
      mockBedrock: config.mockBedrock,
      aiGateUrl: config.aiGateUrl,
    },
    "AIOrchestration listening"
  );
});
