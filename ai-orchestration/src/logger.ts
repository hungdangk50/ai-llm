import pino from "pino";

/** Logger cho service **(2) AIOrchestration** */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "AIOrchestration" },
});
