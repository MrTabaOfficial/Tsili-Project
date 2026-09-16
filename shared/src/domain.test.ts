import { describe, expect, it } from "vitest";
import {
  expenseSchema,
  groupSchema,
  inviteCodeSchema,
  memberSchema,
  repaymentSchema,
  splitRuleSchema,
  tetriSchema,
} from "./domain.js";
import { splitEqually } from "./split.js";

const ids = {
  group: "6f1c2a3e-0000-4000-8000-000000000001",
  luka: "6f1c2a3e-0000-4000-8000-00000000000a",
  giorgi: "6f1c2a3e-0000-4000-8000-00000000000b",
  nino: "6f1c2a3e-0000-4000-8000-00000000000c",
  expense: "6f1c2a3e-0000-4000-8000-0000000000e1",
  repayment: "6f1c2a3e-0000-4000-8000-0000000000f1",
};
const now = "2026-10-06T18:00:00.000Z";
const synced = { createdAt: now, updatedAt: now, deletedAt: null };
const members = [ids.luka, ids.giorgi, ids.nino];

const validExpense = () => ({
  ...synced,
  id: ids.expense,
  groupId: ids.group,
  payerMemberId: ids.luka,
  amount: 100,
  description: "Khinkali",
  date: "2026-10-06",
  splitRule: { kind: "equal" as const, memberIds: members },
  shares: splitEqually(100, members),
});

describe("primitive schemas", () => {
  it("tetri must be a non-negative safe integer", () => {
    expect(tetriSchema.safeParse(0).success).toBe(true);
    expect(tetriSchema.safeParse(12.5).success).toBe(false);
    expect(tetriSchema.safeParse(-1).success).toBe(false);
    expect(tetriSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
    expect(tetriSchema.safeParse("100").success).toBe(false);
  });

  it("invite codes are 8 chars from the unambiguous alphabet", () => {
    expect(inviteCodeSchema.safeParse("ABCD2345").success).toBe(true);
    expect(inviteCodeSchema.safeParse("ABCD234").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABCD0123").success).toBe(false);
    expect(inviteCodeSchema.safeParse("abcd2345").success).toBe(false);
  });
});

describe("groupSchema and memberSchema", () => {
  it("accepts a valid group and trims the name", () => {
    const g = groupSchema.parse({ ...synced, id: ids.group, name: "  Kazbegi trip ", currency: "GEL", inviteCode: "KAZB2326" });
    expect(g.name).toBe("Kazbegi trip");
  });

  it("rejects unknown currencies and empty names", () => {
    expect(groupSchema.safeParse({ ...synced, id: ids.group, name: "x", currency: "USD", inviteCode: "KAZB2326" }).success).toBe(false);
    expect(groupSchema.safeParse({ ...synced, id: ids.group, name: "   ", currency: "GEL", inviteCode: "KAZB2326" }).success).toBe(false);
  });

  it("members may be unclaimed", () => {
    expect(memberSchema.safeParse({ ...synced, id: ids.luka, groupId: ids.group, name: "Luka", userId: null }).success).toBe(true);
  });
});

describe("expenseSchema", () => {
  it("accepts an expense whose shares match its rule", () => {
    expect(expenseSchema.safeParse(validExpense()).success).toBe(true);
  });

  it("rejects shares that disagree with the rule", () => {
    const e = validExpense();
    e.shares = { [ids.luka]: 50, [ids.giorgi]: 50, [ids.nino]: 0 };
    const result = expenseSchema.safeParse(e);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["shares"]);
  });

  it("rejects shares with the right total but wrong leftover assignment", () => {
    // Deterministic rule says the lowest id gets the extra tetri; this gives it to the highest.
    const e = validExpense();
    e.shares = { [ids.luka]: 33, [ids.giorgi]: 33, [ids.nino]: 34 };
    expect(expenseSchema.safeParse(e).success).toBe(false);
  });

  it("rejects an exact rule that does not add up, with the error on splitRule", () => {
    const e = validExpense();
    e.splitRule = { kind: "exact", amounts: { [ids.luka]: 60, [ids.giorgi]: 50 } } as never;
    const result = expenseSchema.safeParse(e);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["splitRule"]);
  });

  it("rejects zero amounts, float amounts, timestamps as dates, and blank descriptions", () => {
    expect(expenseSchema.safeParse({ ...validExpense(), amount: 0, shares: splitEqually(0, members) }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...validExpense(), amount: 10.5 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...validExpense(), date: now }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...validExpense(), description: "  " }).success).toBe(false);
  });

  it("accepts a shares rule with resolved shares", () => {
    const e = validExpense();
    e.splitRule = { kind: "shares", weights: { [ids.luka]: 2, [ids.giorgi]: 1, [ids.nino]: 1 } } as never;
    e.shares = { [ids.giorgi]: 25, [ids.luka]: 50, [ids.nino]: 25 };
    expect(expenseSchema.safeParse(e).success).toBe(true);
  });
});

describe("splitRuleSchema", () => {
  it("rejects unknown kinds and non-uuid member ids", () => {
    expect(splitRuleSchema.safeParse({ kind: "random", memberIds: members }).success).toBe(false);
    expect(splitRuleSchema.safeParse({ kind: "equal", memberIds: ["luka"] }).success).toBe(false);
    expect(splitRuleSchema.safeParse({ kind: "equal", memberIds: [] }).success).toBe(false);
  });
});

describe("repaymentSchema", () => {
  const valid = {
    ...synced,
    id: ids.repayment,
    groupId: ids.group,
    fromMemberId: ids.luka,
    toMemberId: ids.giorgi,
    amount: 4000,
    date: "2026-10-06",
    note: null,
  };

  it("accepts a valid repayment", () => {
    expect(repaymentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects self-repayment and zero amounts", () => {
    expect(repaymentSchema.safeParse({ ...valid, toMemberId: ids.luka }).success).toBe(false);
    expect(repaymentSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });
});
