import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

export const TOKEN_ISSUER = "tsili";

export interface TokenConfig {
  secret: Uint8Array;
  accessTtlSeconds: number;
}

export function tokenConfig(jwtSecret: string, accessTtlSeconds: number): TokenConfig {
  return { secret: new TextEncoder().encode(jwtSecret), accessTtlSeconds };
}

export async function signAccessToken(cfg: TokenConfig, userId: string, now = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(TOKEN_ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + cfg.accessTtlSeconds)
    .sign(cfg.secret);
}

/** Returns the user id, or null for any invalid, expired or foreign token. */
export async function verifyAccessToken(cfg: TokenConfig, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, cfg.secret, { issuer: TOKEN_ISSUER, algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) return null;
    throw err;
  }
}

/** Opaque, high-entropy, never decoded. Only its hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
