import { describe, expect, it } from "vitest";
import { computeBalances, type BalanceExpense, type BalanceRepayment } from "./balances.js";
import { MoneyError } from "./money.js";
import { splitEqually } from "./split.js";

const members = ["giorgi", "luka", "nino"];

const expense = (id: string, payerId: string, amount: number, shares: Record<string, number>): BalanceExpense => ({
  id,
  payerMemberId: payerId,
  amount,
  shares,
});

const sum = (b: Record<string, number>) => Object.values(b).reduce((a, x) => a + x, 0);

describe("computeBalances", () => {
  it("returns zero for every member with no activity", () => {
    expect(computeBalances(members, [], [])).toEqual({ giorgi: 0, luka: 0, nino: 0 });
  });

  it("credits the payer and debits participants", () => {
    const e = expense("e1", "luka", 90, splitEqually(90, members));
    expect(computeBalances(members, [e], [])).toEqual({ giorgi: -30, luka: 60, nino: -30 });
  });

  it("a member who paid and owes nothing has a zero balance", () => {
    // Giorgi paid only for Luka and Nino, and never took part in anything else.
    const e = expense("e1", "giorgi", 40, { luka: 20, nino: 20 });
    const r: BalanceRepayment[] = [
      { id: "r1", fromMemberId: "luka", toMemberId: "giorgi", amount: 20 },
      { id: "r2", fromMemberId: "nino", toMemberId: "giorgi", amount: 20 },
    ];
    expect(computeBalances(members, [e], r)).toEqual({ giorgi: 0, luka: 0, nino: 0 });
  });

  it("applies repayments in the payer's favour", () => {
    const e = expense("e1", "giorgi", 100, splitEqually(100, members));
    const r: BalanceRepayment = { id: "r1", fromMemberId: "luka", toMemberId: "giorgi", amount: 33 };
    expect(computeBalances(members, [e], [r])).toEqual({ giorgi: 100 - 34 - 33, luka: 0, nino: -33 });
  });

  it("always sums to zero across a mixed history", () => {
    const expenses = [
      expense("e1", "giorgi", 100, splitEqually(100, members)),
      expense("e2", "luka", 55, { luka: 25, nino: 30 }),
      expense("e3", "nino", 777, { giorgi: 300, luka: 200, nino: 277 }),
    ];
    const repayments: BalanceRepayment[] = [
      { id: "r1", fromMemberId: "giorgi", toMemberId: "nino", amount: 150 },
      { id: "r2", fromMemberId: "luka", toMemberId: "nino", amount: 1 },
    ];
    expect(sum(computeBalances(members, expenses, repayments))).toBe(0);
  });

  it("ignores member list order", () => {
    const e = expense("e1", "luka", 90, splitEqually(90, members));
    expect(computeBalances(["nino", "giorgi", "luka"], [e], [])).toEqual(computeBalances(members, [e], []));
  });

  it("rejects an expense whose shares do not match its amount", () => {
    const e = expense("e1", "luka", 100, { giorgi: 50, nino: 49 });
    expect(() => computeBalances(members, [e], [])).toThrow(/shares sum to 99/);
  });

  it("rejects unknown members and self-repayments", () => {
    const e = expense("e1", "stranger", 10, { luka: 10 });
    expect(() => computeBalances(members, [e], [])).toThrow(/unknown member stranger/);
    const r: BalanceRepayment = { id: "r1", fromMemberId: "luka", toMemberId: "luka", amount: 5 };
    expect(() => computeBalances(members, [], [r])).toThrow(MoneyError);
  });

  it("rejects float amounts anywhere", () => {
    const e = expense("e1", "luka", 10.5, { luka: 10.5 });
    expect(() => computeBalances(members, [e], [])).toThrow(/integer/);
    const r: BalanceRepayment = { id: "r1", fromMemberId: "luka", toMemberId: "nino", amount: 0.1 };
    expect(() => computeBalances(members, [], [r])).toThrow(/integer/);
  });
});
