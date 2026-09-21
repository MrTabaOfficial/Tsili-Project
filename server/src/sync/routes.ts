import { Router } from "express";
import { z } from "zod";
import { idSchema, syncRequestSchema } from "@tsili/shared";
import { currentUserId, requireAuth } from "../auth/middleware.js";
import type { TokenConfig } from "../auth/tokens.js";
import type { SyncService } from "./service.js";

const params = z.object({ groupId: idSchema });

export function syncRouter(sync: SyncService, tokens: TokenConfig): Router {
  const router = Router();

  router.post("/groups/:groupId/sync", requireAuth(tokens), async (req, res) => {
    const { groupId } = params.parse(req.params);
    const body = syncRequestSchema.parse(req.body);
    res.json(await sync.sync(currentUserId(req), groupId, body));
  });

  return router;
}
