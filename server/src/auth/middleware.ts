import type { RequestHandler } from "express";
import { HttpError } from "../errors.js";
import { verifyAccessToken, type TokenConfig } from "./tokens.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(tokens: TokenConfig): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new HttpError(401, "UNAUTHENTICATED", "missing bearer token");
    }
    const userId = await verifyAccessToken(tokens, token);
    if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "access token is invalid or expired");
    req.userId = userId;
    next();
  };
}

/** For handlers behind requireAuth; keeps the non-null assertion in one place. */
export function currentUserId(req: { userId?: string }): string {
  if (!req.userId) throw new HttpError(401, "UNAUTHENTICATED", "not authenticated");
  return req.userId;
}
