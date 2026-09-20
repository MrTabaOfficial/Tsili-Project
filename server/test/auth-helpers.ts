import request from "supertest";
import { expect } from "vitest";
import type { createApp } from "../src/app.js";

export interface TestUser {
  id: string;
  accessToken: string;
  refreshToken: string;
  email: string;
}

/** Registers a user and returns what later requests need. */
export async function registerUser(app: ReturnType<typeof createApp>, name: string): Promise<TestUser> {
  const email = `${name.toLowerCase()}@example.com`;
  const res = await request(app).post("/auth/register").send({ email, password: "correct horse battery", displayName: name });
  expect(res.status).toBe(201);
  return { id: res.body.user.id, accessToken: res.body.accessToken, refreshToken: res.body.refreshToken, email };
}

export const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.accessToken}` });
