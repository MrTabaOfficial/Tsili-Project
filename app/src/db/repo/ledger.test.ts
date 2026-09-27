import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeBalances, settleUp, splitEqually, type Expense, type Repayment } from "@tsili/shared";
import { openNodeDb } from "../node-sqlite";
import { migrate } from "../schema";
import { deleteExpense, getExpense, listExpenses, upsertExpense } from "./expenses";
import { insertGroup } from "./groups";
import { insertMember, listMembers } from "./members";
import { deleteRepayment, listRepayments, upsertRepayment } from "./repayments";

let db: ReturnType<typeof openNodeDb>;
const T0 = "2026-10-06T10:00:00.000Z";
const T1 = "2026-10-06T11:00:00.000Z";
const G = "11111111-1111-4111-8111-111111111111";
const LUKA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NINO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const E1 = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
const E2 = "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2";
const R1 = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";

function expense(id: string, payer: string, amount: number, date: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    groupId: G,
    payerMemberId: payer,
    amount,
    description: "Dinner",
    date,
    splitRule: { kind: "equal", memberIds: [LUKA, NINO] },
    shares: splitEqually(amount, [LUKA, NINO]),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

const repayment: Repayment = {
  id: R1,
  groupId: G,
  fromMemberId: NINO,
  toMemberId: LUKA,
  amount: 1500,
  date: "2026-10-07",
  note: null,
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
};

beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
  await insertGroup(db, { id: G, name: "Kazbegi", currency: "GEL", now: T0 });
  await insertMember(db, { id: LUKA, groupId: G, name: "Luka", now: T0 });
  await insertMember(db, { id: NINO, groupId: G, name: "Nino", now: T0 });
});

afterEach(() => db.close());

describe("expenses", () => {
  it("round-trips through JSON columns and lists newest date first", async () => {
    const dinner = expense(E1, LUKA, 9000, "2026-10-05");
    const taxi = expense(E2, NINO, 3000, "2026-10-06", { description: "Taxi" });
    await upsertExpense(db, dinner, true);
    await upsertExpense(db, taxi, true);
    const listed = await listExpenses(db, G);
    expect(listed.map((e) => e.description)).toEqual(["Taxi", "Dinner"]);
    expect(listed[1]).toEqual({ ...dinner, dirty: true });
  });

  it("upsert replaces an existing row and can mark it clean", async () => {
    await upsertExpense(db, expense(E1, LUKA, 9000, "2026-10-05"), true);
    await upsertExpense(db, expense(E1, LUKA, 9000, "2026-10-05", { description: "Supper", updatedAt: T1 }), false);
    const e = await getExpense(db, E1);
    expect(e).toMatchObject({ description: "Supper", updatedAt: T1, dirty: false });
    expect(await db.all("SELECT id FROM expenses")).toHaveLength(1);
  });

  it("soft delete hides the row and marks it dirty", async () => {
    await upsertExpense(db, expense(E1, LUKA, 9000, "2026-10-05"), false);
    await deleteExpense(db, E1, T1);
    expect(await listExpenses(db, G)).toEqual([]);
    expect(await getExpense(db, E1)).toMatchObject({ deletedAt: T1, updatedAt: T1, dirty: true });
  });

  it("refuses to read a row whose shares no longer match its rule", async () => {
    await upsertExpense(db, expense(E1, LUKA, 9000, "2026-10-05"), true);
    await db.run("UPDATE expenses SET shares = ? WHERE id = ?", [JSON.stringify({ [LUKA]: 9000 }), E1]);
    await expect(listExpenses(db, G)).rejects.toThrow(/shares/);
  });
});

describe("repayments", () => {
  it("stores, lists and soft deletes", async () => {
    await upsertRepayment(db, repayment, true);
    expect(await listRepayments(db, G)).toEqual([{ ...repayment, dirty: true }]);
    await deleteRepayment(db, R1, T1);
    expect(await listRepayments(db, G)).toEqual([]);
  });
});

describe("ledger from local data", () => {
  it("balances and settle-up computed from stored rows match the shared logic", async () => {
    await upsertExpense(db, expense(E1, LUKA, 9000, "2026-10-05"), true);
    await upsertExpense(db, expense(E2, NINO, 3000, "2026-10-06"), true);
    await upsertRepayment(db, repayment, true);

    const members = (await listMembers(db, G)).map((m) => m.id);
    const balances = computeBalances(members, await listExpenses(db, G), await listRepayments(db, G));
    expect(balances).toEqual({ [LUKA]: 1500, [NINO]: -1500 });
    expect(settleUp(balances)).toEqual([{ fromId: NINO, toId: LUKA, amount: 1500 }]);
  });
});
