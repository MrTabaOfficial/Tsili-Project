import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db.js";
import { loadEnv } from "../env.js";
import { hashRefreshToken } from "./tokens.js";

let db: Db;
let app: ReturnType<typeof createApp>;
// Real time by default because jose checks `exp` against the wall clock; tests shift it only when they must.
let clock = new Date();

const credentials = { email: "luka@example.com", password: "correct horse battery", displayName: "Luka" };

beforeAll(() => {
  const env = loadEnv();
  db = createDb(env.DATABASE_URL);
  app = createApp({ env, db, logger: pino({ level: "silent" }), now: () => clock });
});

beforeEach(async () => {
  clock = new Date();
  await db.$executeRawUnsafe('TRUNCATE TABLE "RefreshToken", "User" CASCADE');
});

afterAll(async () => {
  await db.$disconnect();
});

async function registerLuka() {
  const res = await request(app).post("/auth/register").send(credentials);
  expect(res.status).toBe(201);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string } };
}

describe("GET /health", () => {
  it("responds ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("POST /auth/register", () => {
  it("creates a user and returns tokens without the password hash", async () => {
    const body = await registerLuka();
    expect(body.user).toMatchObject({ email: "luka@example.com", displayName: "Luka" });
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.accessToken.split(".")).toHaveLength(3);
    expect(body.refreshToken.length).toBeGreaterThan(30);
  });

  it("normalises the email and rejects duplicates", async () => {
    await registerLuka();
    const res = await request(app)
      .post("/auth/register")
      .send({ ...credentials, email: "  LUKA@example.com " });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects short passwords and malformed bodies with field paths", async () => {
    const res = await request(app).post("/auth/register").send({ email: "nope", password: "short", displayName: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    const paths = res.body.error.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "password", "displayName"]));
  });

  it("rejects invalid JSON", async () => {
    const res = await request(app).post("/auth/register").set("content-type", "application/json").send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_JSON");
  });
});

describe("POST /auth/login", () => {
  it("signs in with correct credentials", async () => {
    await registerLuka();
    const res = await request(app).post("/auth/login").send({ email: "Luka@Example.com", password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("luka@example.com");
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await registerLuka();
    const wrong = await request(app).post("/auth/login").send({ email: credentials.email, password: "wrong password" });
    const unknown = await request(app).post("/auth/login").send({ email: "nobody@example.com", password: "whatever1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
});

describe("GET /me", () => {
  it("returns the current user with a valid access token", async () => {
    const { accessToken, user } = await registerLuka();
    const res = await request(app).get("/me").set("authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("rejects missing, malformed and expired tokens", async () => {
    const { accessToken } = await registerLuka();
    expect((await request(app).get("/me")).status).toBe(401);
    expect((await request(app).get("/me").set("authorization", "Bearer not.a.jwt")).status).toBe(401);
    expect((await request(app).get("/me").set("authorization", `Token ${accessToken}`)).status).toBe(401);

    const tampered = accessToken.slice(0, -2) + "xx";
    expect((await request(app).get("/me").set("authorization", `Bearer ${tampered}`)).status).toBe(401);

    // Access tokens live 900 seconds in tests; jose checks exp against real time, so wait for the real clock instead.
    const env = loadEnv();
    const shortLived = createApp({
      env: { ...env, ACCESS_TOKEN_TTL_SECONDS: 1 },
      db,
      logger: pino({ level: "silent" }),
      now: () => new Date(Date.now() - 5_000),
    });
    const stale = await request(shortLived).post("/auth/login").send({ email: credentials.email, password: credentials.password });
    const res = await request(app).get("/me").set("authorization", `Bearer ${stale.body.accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/refresh", () => {
  it("rotates the refresh token and the old one stops working", async () => {
    const first = await registerLuka();
    const rotated = await request(app).post("/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);

    const me = await request(app).get("/me").set("authorization", `Bearer ${rotated.body.accessToken}`);
    expect(me.status).toBe(200);

    const replay = await request(app).post("/auth/refresh").send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_TOKEN_REUSED");
  });

  it("revokes the whole family when a used token is replayed", async () => {
    const first = await registerLuka();
    const second = await request(app).post("/auth/refresh").send({ refreshToken: first.refreshToken });
    await request(app).post("/auth/refresh").send({ refreshToken: first.refreshToken }); // replay

    const afterReplay = await request(app).post("/auth/refresh").send({ refreshToken: second.body.refreshToken });
    expect(afterReplay.status).toBe(401);

    const live = await db.refreshToken.count({ where: { revokedAt: null } });
    expect(live).toBe(0);
  });

  it("does not let one session's leak revoke another session", async () => {
    const phoneA = await registerLuka();
    const phoneB = await request(app).post("/auth/login").send({ email: credentials.email, password: credentials.password });
    await request(app).post("/auth/refresh").send({ refreshToken: phoneA.refreshToken });
    await request(app).post("/auth/refresh").send({ refreshToken: phoneA.refreshToken }); // replay kills family A

    const stillFine = await request(app).post("/auth/refresh").send({ refreshToken: phoneB.body.refreshToken });
    expect(stillFine.status).toBe(200);
  });

  it("rejects expired and unknown refresh tokens", async () => {
    const { refreshToken } = await registerLuka();
    clock = new Date(clock.getTime() + 31 * 24 * 60 * 60 * 1000);
    const expired = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("REFRESH_TOKEN_EXPIRED");

    const unknown = await request(app).post("/auth/refresh").send({ refreshToken: "definitely-not-issued" });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("stores only a hash of the refresh token", async () => {
    const { refreshToken } = await registerLuka();
    const rows = await db.refreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashRefreshToken(refreshToken));
    expect(rows[0]!.tokenHash).not.toBe(refreshToken);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the token and is idempotent", async () => {
    const { refreshToken } = await registerLuka();
    expect((await request(app).post("/auth/logout").send({ refreshToken })).status).toBe(204);
    expect((await request(app).post("/auth/logout").send({ refreshToken })).status).toBe(204);
    const res = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

describe("unknown routes", () => {
  it("return a JSON 404", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
