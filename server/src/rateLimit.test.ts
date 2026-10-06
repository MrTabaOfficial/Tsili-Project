import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { HttpError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";

function call(handler: ReturnType<typeof rateLimit>, ip: string) {
  const headers: Record<string, string> = {};
  let passed: unknown = "not called";
  const req = { ip } as Request;
  const res = { setHeader: (k: string, v: string) => void (headers[k] = v) } as unknown as Response;
  handler(req, res, (err?: unknown) => {
    passed = err;
  });
  return { err: passed, headers };
}

describe("rateLimit", () => {
  it("allows up to max attempts in a window, then rejects with 429", () => {
    let clock = 1_000_000;
    const limiter = rateLimit({ max: 3, windowMs: 60_000, now: () => clock });
    for (let i = 0; i < 3; i++) expect(call(limiter, "1.1.1.1").err).toBeUndefined();
    const blocked = call(limiter, "1.1.1.1");
    expect(blocked.err).toBeInstanceOf(HttpError);
    expect((blocked.err as HttpError).status).toBe(429);
    expect(blocked.headers["Retry-After"]).toBe("60");

    clock += 60_000; // window over
    expect(call(limiter, "1.1.1.1").err).toBeUndefined();
  });

  it("keys by address so one client cannot exhaust another's allowance", () => {
    const limiter = rateLimit({ max: 1, windowMs: 60_000, now: () => 0 });
    expect(call(limiter, "a").err).toBeUndefined();
    expect(call(limiter, "a").err).toBeInstanceOf(HttpError);
    expect(call(limiter, "b").err).toBeUndefined();
  });

  it("reports the remaining allowance", () => {
    const limiter = rateLimit({ max: 2, windowMs: 60_000, now: () => 0 });
    expect(call(limiter, "a").headers["RateLimit-Remaining"]).toBe("1");
    expect(call(limiter, "a").headers["RateLimit-Remaining"]).toBe("0");
  });
});
