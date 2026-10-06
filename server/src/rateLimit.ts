import type { RequestHandler } from "express";
import { HttpError } from "./errors.js";

export interface RateLimitOptions {
  /** Attempts allowed per key inside one window. */
  max: number;
  windowMs: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter keyed by client address. State lives in this process, which is right for a
 * single instance; with several instances the counters would need to move to Postgres or Redis.
 */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const now = opts.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const t = now();
    const key = req.ip ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      bucket = { count: 0, resetAt: t + opts.windowMs };
      buckets.set(key, bucket);
      // Drop expired buckets so the map cannot grow without bound under many distinct addresses.
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
      }
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(opts.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
    if (bucket.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - t) / 1000)));
      next(new HttpError(429, "RATE_LIMITED", "too many attempts, try again later"));
      return;
    }
    next();
  };
}
