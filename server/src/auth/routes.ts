import { Router } from "express";
import { loginRequestSchema, refreshRequestSchema, registerRequestSchema } from "@tsili/shared";
import type { AuthService } from "./service.js";
import { currentUserId, requireAuth } from "./middleware.js";
import type { TokenConfig } from "./tokens.js";

export function authRouter(auth: AuthService, tokens: TokenConfig): Router {
  const router = Router();

  router.post("/auth/register", async (req, res) => {
    const body = registerRequestSchema.parse(req.body);
    res.status(201).json(await auth.register(body));
  });

  router.post("/auth/login", async (req, res) => {
    const body = loginRequestSchema.parse(req.body);
    res.json(await auth.login(body));
  });

  router.post("/auth/refresh", async (req, res) => {
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
