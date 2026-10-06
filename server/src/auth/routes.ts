import { Router } from "express";
import { loginRequestSchema, refreshRequestSchema, registerRequestSchema } from "@tsili/shared";
import type { AuthService } from "./service.js";
import { rateLimit } from "../rateLimit.js";
import { currentUserId, requireAuth } from "./middleware.js";
import type { TokenConfig } from "./tokens.js";

export interface AuthRouterOptions {
  /** Attempts per address per window for register and login; refresh gets three times as many. */
  rateLimitMax: number;
}

export function authRouter(auth: AuthService, tokens: TokenConfig, opts: AuthRouterOptions): Router {
  const router = Router();
  const WINDOW_MS = 15 * 60 * 1000;
  const credentialLimit = rateLimit({ max: opts.rateLimitMax, windowMs: WINDOW_MS });
  const refreshLimit = rateLimit({ max: opts.rateLimitMax * 3, windowMs: WINDOW_MS });

  router.post("/auth/register", credentialLimit, async (req, res) => {
    const body = registerRequestSchema.parse(req.body);
    res.status(201).json(await auth.register(body));
  });

  router.post("/auth/login", credentialLimit, async (req, res) => {
    const body = loginRequestSchema.parse(req.body);
    res.json(await auth.login(body));
  });

  router.post("/auth/refresh", refreshLimit, async (req, res) => {
    const body = refreshRequestSchema.parse(req.body);
    res.json(await auth.refresh(body.refreshToken));
  });

  router.post("/auth/logout", async (req, res) => {
    const body = refreshRequestSchema.parse(req.body);
    await auth.logout(body.refreshToken);
    res.status(204).end();
  });

  router.get("/me", requireAuth(tokens), async (req, res) => {
    res.json({ user: await auth.getUser(currentUserId(req)) });
  });

  return router;
}
