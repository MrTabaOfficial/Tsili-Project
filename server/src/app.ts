import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { authRouter } from "./auth/routes.js";
import { AuthService } from "./auth/service.js";
import { tokenConfig } from "./auth/tokens.js";
import type { Db } from "./db.js";
import type { Env } from "./env.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { groupsRouter } from "./groups/routes.js";
import { GroupService } from "./groups/service.js";

export interface AppDeps {
  env: Env;
  db: Db;
  logger: Logger;
  now?: () => Date;
}

export function createApp({ env, db, logger, now }: AppDeps): Express {
  const tokens = tokenConfig(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS);
  const auth = new AuthService({ db, tokens, refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS, ...(now ? { now } : {}) });
  const groups = new GroupService(db, now);

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(authRouter(auth, tokens));
  app.use(groupsRouter(groups, tokens));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
