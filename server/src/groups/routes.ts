import { Router } from "express";
import { z } from "zod";
import {
  createGroupRequestSchema,
  createMemberRequestSchema,
  idSchema,
  inviteCodeParamSchema,
  joinGroupRequestSchema,
  updateGroupRequestSchema,
  updateMemberRequestSchema,
} from "@tsili/shared";
import { currentUserId, requireAuth } from "../auth/middleware.js";
import type { TokenConfig } from "../auth/tokens.js";
import type { GroupService } from "./service.js";

const groupParams = z.object({ groupId: idSchema });
const memberParams = groupParams.extend({ memberId: idSchema });

export function groupsRouter(groups: GroupService, tokens: TokenConfig): Router {
  const router = Router();
  // Scoped to these prefixes so unknown paths still reach the 404 handler instead of a 401.
  router.use(["/groups", "/invites"], requireAuth(tokens));

  router.post("/groups", async (req, res) => {
    const body = createGroupRequestSchema.parse(req.body);
    res.status(201).json(await groups.create(currentUserId(req), body));
  });

  router.get("/groups", async (req, res) => {
    res.json({ groups: await groups.listForUser(currentUserId(req)) });
  });

  router.get("/groups/:groupId", async (req, res) => {
    const { groupId } = groupParams.parse(req.params);
    res.json(await groups.get(currentUserId(req), groupId));
  });

  router.patch("/groups/:groupId", async (req, res) => {
    const { groupId } = groupParams.parse(req.params);
    const body = updateGroupRequestSchema.parse(req.body);
    res.json(await groups.update(currentUserId(req), groupId, body));
  });

  router.delete("/groups/:groupId", async (req, res) => {
    const { groupId } = groupParams.parse(req.params);
    await groups.softDelete(currentUserId(req), groupId);
    res.status(204).end();
  });

  router.post("/groups/:groupId/members", async (req, res) => {
    const { groupId } = groupParams.parse(req.params);
    const body = createMemberRequestSchema.parse(req.body);
    res.status(201).json({ member: await groups.addMember(currentUserId(req), groupId, body) });
  });

  router.patch("/groups/:groupId/members/:memberId", async (req, res) => {
    const { groupId, memberId } = memberParams.parse(req.params);
    const body = updateMemberRequestSchema.parse(req.body);
    res.json({ member: await groups.updateMember(currentUserId(req), groupId, memberId, body) });
  });

  router.delete("/groups/:groupId/members/:memberId", async (req, res) => {
    const { groupId, memberId } = memberParams.parse(req.params);
    await groups.removeMember(currentUserId(req), groupId, memberId);
    res.status(204).end();
  });

  router.get("/invites/:code", async (req, res) => {
    const { code } = inviteCodeParamSchema.parse(req.params);
    res.json(await groups.previewInvite(currentUserId(req), code));
  });

  router.post("/invites/:code/join", async (req, res) => {
    const { code } = inviteCodeParamSchema.parse(req.params);
    const body = joinGroupRequestSchema.parse(req.body);
    res.json(await groups.join(currentUserId(req), code, body));
  });

  return router;
}
