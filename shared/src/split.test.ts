import { describe, expect, it } from "vitest";
import { MoneyError } from "./money.js";
import { split, splitByShares, splitEqually, splitExact } from "./split.js";

const sum = (shares: Record<string, number>) => Object.values(shares).reduce((a, b) => a + b, 0);

describe("splitEqually", () => {
  it("splits 100 tetri three ways with the leftover going to the lowest id", () => {
    expect(splitEqually(100, ["luka", "giorgi", "nino"])).toEqual({ giorgi: 34, luka: 33, nino: 33 });
  });

  it("gives the same result regardless of input order", () => {
    const a = splitEqually(100, ["luka", "giorgi", "nino"]);
    const b = splitEqually(100, ["nino", "luka", "giorgi"]);
    expect(a).toEqual(b);
  });

  it("splits evenly when it divides exactly", () => {
    expect(splitEqually(90, ["a", "b", "c"])).toEqual({ a: 30, b: 30, c: 30 });
  });

  it("handles a single participant and zero amount", () => {
    expect(splitEqually(500, ["a"])).toEqual({ a: 500 });
    expect(splitEqually(0, ["a", "b"])).toEqual({ a: 0, b: 0 });
  });

  it("rejects no participants, duplicates, floats and negatives", () => {
    expect(() => splitEqually(100, [])).toThrow(MoneyError);
    expect(() => splitEqually(100, ["a", "a"])).toThrow(/twice/);
    expect(() => splitEqually(10.5, ["a"])).toThrow(/integer/);
    expect(() => splitEqually(-1, ["a"])).toThrow(/negative/);
  });
});

describe("splitExact", () => {
  it("accepts amounts that add up and returns them in id order", () => {
    expect(splitExact(100, { nino: 20, luka: 50, giorgi: 30 })).toEqual({ giorgi: 30, luka: 50, nino: 20 });
  });

  it("rejects amounts that do not add up", () => {
    expect(() => splitExact(100, { a: 50, b: 49 })).toThrow(/sum to 99, expected 100/);
    expect(() => splitExact(100, { a: 50, b: 51 })).toThrow(MoneyError);
  });

  it("rejects negative or fractional member amounts", () => {
    expect(() => splitExact(100, { a: 110, b: -10 })).toThrow(/negative/);
    expect(() => splitExact(100, { a: 50.5, b: 49.5 })).toThrow(/integer/);
  });

  it("allows a participant with an exact share of zero", () => {
    expect(splitExact(100, { a: 100, b: 0 })).toEqual({ a: 100, b: 0 });
  });
});

describe("splitByShares", () => {
  it("splits 2:1:1 exactly", () => {
    expect(splitByShares(100, { a: 2, b: 1, c: 1 })).toEqual({ a: 50, b: 25, c: 25 });
  });

  it("gives leftover tetri to the largest remainders first", () => {
    // 3:2:2 on 100 -> exact 42.857, 28.571, 28.571; floors 42, 28, 28 leave 2 tetri.
    // a has the largest fraction and gets one; b and c tie, so b wins by id.
    expect(splitByShares(100, { a: 3, b: 2, c: 2 })).toEqual({ a: 43, b: 29, c: 28 });
  });

  it("gives a zero-weight member nothing", () => {
    expect(splitByShares(100, { a: 1, b: 0 })).toEqual({ a: 100, b: 0 });
  });

  it("rejects all-zero weights, negative or fractional weights, and no members", () => {
    expect(() => splitByShares(100, { a: 0, b: 0 })).toThrow(/all be zero/);
    expect(() => splitByShares(100, { a: -1, b: 2 })).toThrow(MoneyError);
    expect(() => splitByShares(100, { a: 1.5, b: 2 })).toThrow(MoneyError);
    expect(() => splitByShares(100, {})).toThrow(MoneyError);
  });

  it("stays exact on large amounts where float products would drift", () => {
    const amount = 9_007_199_254_740_000; // near Number.MAX_SAFE_INTEGER
    const shares = splitByShares(amount, { a: 7, b: 11, c: 13 });
    expect(sum(shares)).toBe(amount);
  });
});

describe("rounding never creates or loses money", () => {
  it("equal splits for every amount up to 1000 and 1..7 members", () => {
    for (let n = 1; n <= 7; n++) {
      const ids = Array.from({ length: n }, (_, i) => `m${i}`);
      for (let amount = 0; amount <= 1000; amount++) {
        const shares = splitEqually(amount, ids);
        expect(sum(shares)).toBe(amount);
        const floor = Math.floor(amount / n);
        for (const s of Object.values(shares)) expect(s === floor || s === floor + 1).toBe(true);
      }
    }
  });

  it("weighted splits with a fixed pseudo-random sweep", () => {
    let seed = 12345;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };
    for (let round = 0; round < 2000; round++) {
      const n = 1 + rand(6);
      const weights: Record<string, number> = {};
      for (let i = 0; i < n; i++) weights[`m${i}`] = rand(5);
      if (Object.values(weights).every((w) => w === 0)) weights.m0 = 1;
      const amount = rand(100_000);
      const shares = splitByShares(amount, weights);
      expect(sum(shares)).toBe(amount);
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      for (const [id, s] of Object.entries(shares)) {
        const exact = (amount * weights[id]!) / totalWeight;
        expect(s).toBeGreaterThanOrEqual(Math.floor(exact));
        expect(s).toBeLessThanOrEqual(Math.floor(exact) + 1);
      }
    }
  });
});

describe("split dispatcher", () => {
  it("routes each rule kind", () => {
    expect(split(100, { kind: "equal", memberIds: ["a", "b"] })).toEqual({ a: 50, b: 50 });
    expect(split(100, { kind: "exact", amounts: { a: 60, b: 40 } })).toEqual({ a: 60, b: 40 });
    expect(split(100, { kind: "shares", weights: { a: 3, b: 1 } })).toEqual({ a: 75, b: 25 });
  });
});
