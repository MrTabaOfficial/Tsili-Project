import { pino } from "pino";
import { createApp } from "./app.js";
import { createDb } from "./db.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const logger = pino({ level: env.LOG_LEVEL });
const db = createDb(env.DATABASE_URL);
const app = createApp({ env, db, logger });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "tsili server listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
