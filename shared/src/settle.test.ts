import { describe, expect, it } from "vitest";
import type { Balances } from "./balances";
import { MoneyError } from "./money";
import { settleUp, type Payment } from "./settle";

/** Applies payments to balances and returns what is left. Zero everywhere means the plan works. */
function apply(balances: Balances, payments: Payment[]): Balances {
  const out = { ...balances };
  for (const p of payments) {
    out[p.fromId]! += p.amount;
    out[p.toId]! -= p.amount;
  }
  return out;
}

const allZero = (b: Balances) => Object.values(b).every((x) => x === 0);

describe("settleUp", () => {
  it("returns no payments when everyone is already settled", () => {
    expect(settleUp({ a: 0, b: 0, c: 0 })).toEqual([]);
    expect(settleUp({})).toEqual([]);
  });

  it("settles a single debt with a single payment", () => {
    expect(settleUp({ luka: -40, giorgi: 40 })).toEqual([{ fromId: "luka", toId: "giorgi", amount: 40 }]);
  });

  it("settles one payer and two debtors with two payments", () => {
    const balances = { giorgi: 66, luka: -33, nino: -33 };
    const plan = settleUp(balances);
    expect(plan).toHaveLength(2);
    expect(allZero(apply(balances, plan))).toBe(true);
  });

  it("skips members with a zero balance", () => {
    const plan = settleUp({ a: 10, b: 0, c: -10 });
    expect(plan).toEqual([{ fromId: "c", toId: "a", amount: 10 }]);
  });

  it("uses exact matches before greedy matching", () => {
    // Pure largest-first would do c->a 60, d->a 10, d->b 20, e->b 10 (4 payments).
    // Matching d with b exactly first brings it down to 3.
    const balances = { a: 70, b: 30, c: -60, d: -30, e: -10 };
    const plan = settleUp(balances);
    expect(plan).toEqual([
      { fromId: "d", toId: "b", amount: 30 },
      { fromId: "c", toId: "a", amount: 60 },
      { fromId: "e", toId: "a", amount: 10 },
    ]);
    expect(allZero(apply(balances, plan))).toBe(true);
  });

  it("never needs more payments than non-zero balances minus one", () => {
    const balances = { a: 50, b: 30, c: -45, d: -20, e: -15 };
    const plan = settleUp(balances);
    expect(plan.length).toBeLessThanOrEqual(4);
    expect(allZero(apply(balances, plan))).toBe(true);
  });

  it("is deterministic regardless of key order", () => {
    const a = settleUp({ x: -5, y: 10, z: -5 });
    const b = settleUp({ z: -5, y: 10, x: -5 });
    expect(a).toEqual(b);
  });

  it("only ever moves money from debtors to creditors in positive amounts", () => {
    const balances = { a: 120, b: -70, c: -50, d: 35, e: -35 };
    for (const p of settleUp(balances)) {
      expect(p.amount).toBeGreaterThan(0);
      expect(balances[p.fromId as keyof typeof balances]).toBeLessThan(0);
      expect(balances[p.toId as keyof typeof balances]).toBeGreaterThan(0);
    }
  });

  it("rejects balances that do not sum to zero", () => {
    expect(() => settleUp({ a: 10, b: -5 })).toThrow(MoneyError);
    expect(() => settleUp({ a: 10, b: -5 })).toThrow(/sum to 5/);
  });

  it("rejects non-integer balances", () => {
    expect(() => settleUp({ a: 0.5, b: -0.5 })).toThrow(/integer/);
  });

  it("clears every balance across a pseudo-random sweep", () => {
    let seed = 777;
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };
    for (let round = 0; round < 500; round++) {
      const n = 2 + rand(7);
      const balances: Balances = {};
      let total = 0;
      for (let i = 0; i < n - 1; i++) {
        const v = rand(2001) - 1000;
        balances[`m${i}`] = v;
        total += v;
      }
      balances[`m${n - 1}`] = -total;
      const plan = settleUp(balances);
      expect(allZero(apply(balances, plan))).toBe(true);
      const nonZero = Object.values(balances).filter((x) => x !== 0).length;
      expect(plan.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
    }
  });
});
