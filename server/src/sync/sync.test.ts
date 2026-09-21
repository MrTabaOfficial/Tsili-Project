import { randomUUID } from "node:crypto";
import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  computeBalances,
  settleUp,
  splitEqually,
  syncResponseSchema,
  type Expense,
  type Member,
  type Repayment,
  type SyncResponse,
} from "@tsili/shared";
import { bearer, registerUser, type TestUser } from "../../test/auth-helpers.js";
import { resetDb } from "../../test/reset-db.js";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db.js";
import { loadEnv } from "../env.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let luka: TestUser;
let nino: TestUser;
let groupId: string;
let inviteCode: string;
let lukaMember: Member;
let ninoMember: Member;

const T0 = "2026-10-06T10:00:00.000Z";
const T1 = "2026-10-06T11:00:00.000Z";
const T2 = "2026-10-06T12:00:00.000Z";

beforeAll(() => {
  const env = loadEnv();
  db = createDb(env.DATABASE_URL);
  app = createApp({ env, db, logger: pino({ level: "silent" }) });
});

beforeEach(async () => {
  await resetDb(db);
  luka = await registerUser(app, "Luka");
  nino = await registerUser(app, "Nino");
  const created = await request(app).post("/groups").set(bearer(luka)).send({ name: "Kazbegi" });
  groupId = created.body.group.id;
  inviteCode = created.body.group.inviteCode;
  lukaMember = created.body.members[0];
  const joined = await request(app).post(`/invites/${inviteCode}/join`).set(bearer(nino)).send({ name: "Nino" });
  ninoMember = joined.body.members.find((m: Member) => m.userId === nino.id);
});

afterAll(async () => {
  await db.$disconnect();
});

async function sync(user: TestUser, cursor: string, changes: Partial<{ members: unknown[]; expenses: unknown[]; repayments: unknown[] }> = {}) {
  const res = await request(app).post(`/groups/${groupId}/sync`).set(bearer(user)).send({ cursor, changes });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return syncResponseSchema.parse(res.body) as SyncResponse;
}

function expense(overrides: Partial<Expense> = {}): Expense {
  const amount = overrides.amount ?? 100;
  const memberIds = [lukaMember.id, ninoMember.id];
  return {
    id: randomUUID(),
    groupId,
    payerMemberId: lukaMember.id,
    amount,
    description: "Khinkali",
    date: "2026-10-06",
    splitRule: { kind: "equal", memberIds },
    shares: splitEqually(amount, memberIds),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

function repayment(overrides: Partial<Repayment> = {}): Repayment {
  return {
    id: randomUUID(),
    groupId,
    fromMemberId: ninoMember.id,
    toMemberId: lukaMember.id,
    amount: 50,
    date: "2026-10-06",
    note: null,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

describe("push and pull", () => {
  it("returns the two members on a fresh pull and advances the cursor", async () => {
    const res = await sync(luka, "0");
    expect(res.changes.members.map((m) => m.name).sort()).toEqual(["Luka", "Nino"]);
    expect(res.changes.expenses).toEqual([]);
    expect(BigInt(res.cursor)).toBeGreaterThan(0n);

    const again = await sync(luka, res.cursor);
    expect(again.changes.members).toEqual([]);
    expect(again.cursor).toBe(res.cursor);
  });

  it("delivers an expense pushed by one phone to another", async () => {
    const e = expense();
    const pushed = await sync(luka, "0", { expenses: [e] });
    expect(pushed.rejected).toEqual([]);
    expect(pushed.changes.expenses).toEqual([e]);

    const pulled = await sync(nino, "0");
    expect(pulled.changes.expenses).toEqual([e]);
  });

  it("stores large amounts exactly", async () => {
    const amount = 9_007_199_254_740_000;
    const e = expense({ amount, splitRule: { kind: "exact", amounts: { [lukaMember.id]: amount } }, shares: { [lukaMember.id]: amount } });
    const res = await sync(luka, "0", { expenses: [e] });
    expect(res.rejected).toEqual([]);
    expect(res.changes.expenses[0]?.amount).toBe(amount);
  });

  it("re-pushing an identical record is a no-op", async () => {
    const e = expense();
    const first = await sync(luka, "0", { expenses: [e] });
    const second = await sync(luka, first.cursor, { expenses: [e] });
    expect(second.changes.expenses).toEqual([e]); // echoed back as the server version
    expect(second.cursor).toBe(first.cursor);
    expect(await db.expense.count()).toBe(1);
  });
});

describe("validation", () => {
  it("rejects a bad record and still applies the good ones", async () => {
    const good = expense();
    const badShares = expense({ shares: { [lukaMember.id]: 60, [ninoMember.id]: 40 } });
    const floatAmount = { ...expense(), amount: 10.5 };
    const res = await sync(luka, "0", { expenses: [badShares, good, floatAmount] });
    expect(res.changes.expenses).toEqual([good]);
    expect(res.rejected).toHaveLength(2);
    expect(res.rejected.map((r) => r.code)).toEqual(["VALIDATION", "VALIDATION"]);
    expect(res.rejected[0]?.id).toBe(badShares.id);
    expect(res.rejected[0]?.message).toMatch(/shares/);
  });

  it("rejects expenses that reference members outside the group", async () => {
    const stranger = randomUUID();
    const e = expense({ payerMemberId: stranger, splitRule: { kind: "exact", amounts: { [stranger]: 100 } }, shares: { [stranger]: 100 } });
    const res = await sync(luka, "0", { expenses: [e] });
    expect(res.rejected[0]).toMatchObject({ kind: "expense", id: e.id, code: "MEMBER_NOT_IN_GROUP" });
  });

  it("rejects records whose groupId does not match the route", async () => {
    const res = await sync(luka, "0", { expenses: [expense({ groupId: randomUUID() })] });
    expect(res.rejected[0]?.code).toBe("WRONG_GROUP");
  });

  it("rejects timestamps far in the future and self-repayments", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await sync(luka, "0", {
      expenses: [expense({ updatedAt: future })],
      repayments: [repayment({ toMemberId: ninoMember.id })],
    });
    expect(res.rejected.map((r) => r.code).sort()).toEqual(["FUTURE_TIMESTAMP", "VALIDATION"]);
  });

  it("rejects a malformed cursor and oversized batches with 400", async () => {
    const bad = await request(app).post(`/groups/${groupId}/sync`).set(bearer(luka)).send({ cursor: "abc" });
    expect(bad.status).toBe(400);
    const huge = await request(app)
      .post(`/groups/${groupId}/sync`)
      .set(bearer(luka))
      .send({ cursor: "0", changes: { expenses: Array.from({ length: 1001 }, () => ({})) } });
    expect(huge.status).toBe(400);
  });

  it("non-members get 404", async () => {
    const outsider = await registerUser(app, "Outsider");
    const res = await request(app).post(`/groups/${groupId}/sync`).set(bearer(outsider)).send({ cursor: "0" });
    expect(res.status).toBe(404);
  });
});

describe("conflicts: newer updatedAt wins", () => {
  it("a newer edit replaces the server copy and reaches other phones", async () => {
    const e = expense();
    const first = await sync(luka, "0", { expenses: [e] });
    const ninoCursor = (await sync(nino, "0")).cursor;

    const edited = { ...e, description: "Khinkali and beer", updatedAt: T1 };
    await sync(luka, first.cursor, { expenses: [edited] });

    const pulled = await sync(nino, ninoCursor);
    expect(pulled.changes.expenses).toEqual([edited]);
  });

  it("an older edit is ignored and the server version is returned", async () => {
    const e = expense({ updatedAt: T2 });
    const first = await sync(luka, "0", { expenses: [e] });

    const stale = { ...e, description: "stale", updatedAt: T1 };
    const res = await sync(nino, first.cursor, { expenses: [stale] });
    expect(res.changes.expenses).toEqual([e]);
    expect(res.rejected).toEqual([]);
    expect((await db.expense.findUnique({ where: { id: e.id } }))?.description).toBe("Khinkali");
  });

  it("a soft delete propagates", async () => {
    const e = expense();
    const first = await sync(luka, "0", { expenses: [e] });
    const ninoCursor = (await sync(nino, "0")).cursor;
    await sync(luka, first.cursor, { expenses: [{ ...e, deletedAt: T1, updatedAt: T1 }] });
    const pulled = await sync(nino, ninoCursor);
    expect(pulled.changes.expenses[0]?.deletedAt).toBe(T1);
  });
});

describe("members through sync", () => {
  it("a member created offline can be referenced by an expense in the same batch", async () => {
    const giorgi: Member = { id: randomUUID(), groupId, name: "Giorgi", userId: null, createdAt: T0, updatedAt: T0, deletedAt: null };
    const ids = [lukaMember.id, giorgi.id];
    const e = expense({ splitRule: { kind: "equal", memberIds: ids }, shares: splitEqually(100, ids) });
    const res = await sync(luka, "0", { members: [giorgi], expenses: [e] });
    expect(res.rejected).toEqual([]);
    expect(res.changes.members.map((m) => m.name).sort()).toEqual(["Giorgi", "Luka", "Nino"]);
  });

  it("ignores userId from the client and refuses to delete another account's member", async () => {
    // Member rows were written by REST at real time, so the edit must be newer than that to count.
    const later = new Date(Date.now() + 60_000).toISOString();
    const res = await sync(luka, "0", {
      members: [
        { ...lukaMember, userId: nino.id, name: "Luka renamed", updatedAt: later },
        { ...ninoMember, deletedAt: later, updatedAt: later },
      ],
    });
    expect(res.rejected).toEqual([expect.objectContaining({ kind: "member", id: ninoMember.id, code: "MEMBER_CLAIMED" })]);
    const lukaRow = res.changes.members.find((m) => m.id === lukaMember.id);
    expect(lukaRow).toMatchObject({ name: "Luka renamed", userId: luka.id });
    const ninoRow = res.changes.members.find((m) => m.id === ninoMember.id);
    expect(ninoRow?.deletedAt).toBeNull();
  });

  it("a claim made through the invite endpoint shows up in the next pull", async () => {
    const cursor = (await sync(luka, "0")).cursor;
    const slot = (await request(app).post(`/groups/${groupId}/members`).set(bearer(luka)).send({ name: "Giorgi" })).body.member;
    const giorgi = await registerUser(app, "Giorgi");
    await request(app).post(`/invites/${inviteCode}/join`).set(bearer(giorgi)).send({ memberId: slot.id });

    const pulled = await sync(luka, cursor);
    expect(pulled.changes.members).toHaveLength(1);
    expect(pulled.changes.members[0]).toMatchObject({ id: slot.id, userId: giorgi.id });
  });
});

describe("end to end", () => {
  it("balances computed from synced data settle to zero", async () => {
    const dinner = expense({ amount: 9000 }); // Luka paid 90.00, split equally
    const taxi = expense({ amount: 3000, payerMemberId: ninoMember.id }); // Nino paid 30.00
    const payback = repayment({ amount: 1500 }); // Nino paid Luka 15.00
    await sync(luka, "0", { expenses: [dinner, taxi], repayments: [payback] });

    const pulled = await sync(nino, "0");
    const members = pulled.changes.members.filter((m) => !m.deletedAt).map((m) => m.id);
    const balances = computeBalances(
      members,
      pulled.changes.expenses.filter((e) => !e.deletedAt),
      pulled.changes.repayments.filter((r) => !r.deletedAt),
    );
    // Luka: +9000 paid, -4500 own share of dinner, -1500 own share of taxi, -1500 received from Nino = 1500
    expect(balances[lukaMember.id]).toBe(1500);
    expect(balances[ninoMember.id]).toBe(-1500);
    expect(settleUp(balances)).toEqual([{ fromId: ninoMember.id, toId: lukaMember.id, amount: 1500 }]);
  });
});
