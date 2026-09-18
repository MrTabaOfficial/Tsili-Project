import { randomUUID } from "node:crypto";
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest, TokenPair } from "@tsili/shared";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateRefreshToken, hashRefreshToken, signAccessToken, type TokenConfig } from "./tokens.js";

export interface AuthServiceOptions {
  db: Db;
  tokens: TokenConfig;
  refreshTtlDays: number;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  private readonly db: Db;
  private readonly tokens: TokenConfig;
  private readonly refreshTtlDays: number;
  private readonly now: () => Date;
  /** Verified against when the email is unknown, so a login attempt takes the same time either way. */
  private readonly dummyHash: Promise<string>;

  constructor(opts: AuthServiceOptions) {
    this.db = opts.db;
    this.tokens = opts.tokens;
    this.refreshTtlDays = opts.refreshTtlDays;
    this.now = opts.now ?? (() => new Date());
    this.dummyHash = hashPassword(randomUUID());
  }

  async register(input: RegisterRequest): Promise<AuthResponse> {
    const existing = await this.db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new HttpError(409, "EMAIL_TAKEN", "an account with this email already exists");
    const user = await this.db.user.create({
      data: { email: input.email, displayName: input.displayName, passwordHash: await hashPassword(input.password) },
    });
    const pair = await this.issueTokens(user.id, randomUUID());
    return { ...pair, user: toPublicUser(user) };
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !ok) throw new HttpError(401, "INVALID_CREDENTIALS", "email or password is incorrect");
    const pair = await this.issueTokens(user.id, randomUUID());
    return { ...pair, user: toPublicUser(user) };
  }

  /**
   * Rotation: the presented token is revoked and a fresh one issued in the same family.
   * Presenting an already-revoked token means it leaked, so the whole family is revoked.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashRefreshToken(refreshToken);
    const now = this.now();
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) throw new HttpError(401, "INVALID_REFRESH_TOKEN", "refresh token is not valid");
    if (stored.revokedAt) {
      await this.db.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new HttpError(401, "REFRESH_TOKEN_REUSED", "refresh token was already used; please sign in again");
    }
    if (stored.expiresAt <= now) throw new HttpError(401, "REFRESH_TOKEN_EXPIRED", "refresh token has expired");

    // Only the first concurrent caller wins the revoke; the loser sees count 0 and is treated as reuse.
    const { count } = await this.db.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) throw new HttpError(401, "REFRESH_TOKEN_REUSED", "refresh token was already used; please sign in again");
    return this.issueTokens(stored.userId, stored.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }

  async getUser(userId: string): Promise<PublicUser> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(401, "UNKNOWN_USER", "this account no longer exists");
    return toPublicUser(user);
  }

  private async issueTokens(userId: string, familyId: string): Promise<TokenPair> {
    const now = this.now();
    const refreshToken = generateRefreshToken();
    await this.db.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(refreshToken),
        userId,
        familyId,
        expiresAt: new Date(now.getTime() + this.refreshTtlDays * DAY_MS),
      },
    });
    const accessToken = await signAccessToken(this.tokens, userId, now);
    return { accessToken, refreshToken };
  }
}

function toPublicUser(user: { id: string; email: string; displayName: string; createdAt: Date }): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt.toISOString() };
}
