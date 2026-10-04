import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openNodeDb } from "../node-sqlite";
import { migrate, MIGRATIONS, SCHEMA_VERSION } from "../schema";
import { deleteGroup, getGroup, insertGroup, listGroups, renameGroup } from "./groups";
import { deleteMember, insertMember, listMembers, renameMember } from "./members";

let db: ReturnType<typeof openNodeDb>;
const T0 = "2026-10-06T10:00:00.000Z";
const T1 = "2026-10-06T11:00:00.000Z";
const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const M1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const M2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
});

afterEach(() => db.close());

describe("migrate", () => {
  it("creates the schema once and records the version", async () => {
    const rows = await db.all<{ user_version: number }>("PRAGMA user_version");
    expect(rows[0]?.user_version).toBe(SCHEMA_VERSION);
    await migrate(db); // second run is a no-op rather than a "table exists" error
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(["expenses", "groups", "members", "repayments", "settings", "sync_state"]);
  });
});

describe("upgrade", () => {
  it("brings a database left at an older version up to date", async () => {
    const old = openNodeDb();
    for (const sql of MIGRATIONS[0]!) await old.run(sql); // a phone that installed the first release
    await old.run("PRAGMA user_version = 1");
    await migrate(old);
    const [{ user_version }] = (await old.all<{ user_version: number }>("PRAGMA user_version")) as [{ user_version: number }];
    expect(user_version).toBe(SCHEMA_VERSION);
    const cols = await old.all<{ name: string }>("PRAGMA table_info(groups)");
    expect(cols.map((c) => c.name)).toContain("my_member_id");
    expect(await old.all("SELECT * FROM settings")).toEqual([]);
    old.close();
  });
});

describe("verifySchema", () => {
  it("fails loudly when the stored version claims tables that do not exist", async () => {
    const broken = openNodeDb();
    await broken.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    await expect(migrate(broken)).rejects.toThrow(/missing: groups, members, expenses, repayments, sync_state, settings/);
    broken.close();
  });
});

describe("groups", () => {
  it("inserts a dirty group with no invite code and lists newest first", async () => {
    const g = await insertGroup(db, { id: G1, name: "Kazbegi", currency: "GEL", now: T0 });
    expect(g).toEqual({
      id: G1,
      name: "Kazbegi",
      currency: "GEL",
      inviteCode: null,
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
      dirty: true,
      myMemberId: null,
    });
    await insertGroup(db, { id: G2, name: "Flat", currency: "GEL", now: T1 });
    expect((await listGroups(db)).map((x) => x.name)).toEqual(["Flat", "Kazbegi"]);
  });

  it("rename and soft delete touch updatedAt and keep the row", async () => {
    await insertGroup(db, { id: G1, name: "Kazbegi", currency: "GEL", now: T0 });
    await renameGroup(db, G1, "Svaneti", T1);
    expect(await getGroup(db, G1)).toMatchObject({ name: "Svaneti", updatedAt: T1 });
    await deleteGroup(db, G1, T1);
    expect(await listGroups(db)).toEqual([]);
    expect((await getGroup(db, G1))?.deletedAt).toBe(T1);
  });

  it("rejects a duplicate id", async () => {
    await insertGroup(db, { id: G1, name: "A", currency: "GEL", now: T0 });
    await expect(insertGroup(db, { id: G1, name: "B", currency: "GEL", now: T0 })).rejects.toThrow();
  });
});

describe("members", () => {
  beforeEach(() => insertGroup(db, { id: G1, name: "Kazbegi", currency: "GEL", now: T0 }));

  it("inserts members in order and hides deleted ones", async () => {
    await insertMember(db, { id: M1, groupId: G1, name: "Luka", now: T0 });
    await insertMember(db, { id: M2, groupId: G1, name: "Nino", now: T1 });
    expect((await listMembers(db, G1)).map((m) => m.name)).toEqual(["Luka", "Nino"]);
    await deleteMember(db, M1, T1);
    expect((await listMembers(db, G1)).map((m) => m.name)).toEqual(["Nino"]);
  });

  it("produces records that satisfy the shared member schema", async () => {
    const { memberSchema } = await import("@tsili/shared");
    const m = await insertMember(db, { id: M1, groupId: G1, name: "Luka", now: T0 });
    const { dirty, ...wire } = m;
    expect(dirty).toBe(true);
    expect(memberSchema.safeParse(wire).success).toBe(true);
  });

  it("rename marks the row dirty again after it was clean", async () => {
    await insertMember(db, { id: M1, groupId: G1, name: "Luka", now: T0 });
    await db.run("UPDATE members SET dirty = 0 WHERE id = ?", [M1]);
    await renameMember(db, M1, "Luka B.", T1);
    expect((await listMembers(db, G1))[0]).toMatchObject({ name: "Luka B.", dirty: true, updatedAt: T1 });
  });

  it("refuses a member for a group that does not exist", async () => {
    await expect(insertMember(db, { id: M1, groupId: G2, name: "Ghost", now: T0 })).rejects.toThrow();
  });

  it("transaction rolls back on failure", async () => {
    await expect(
      db.transaction(async () => {
        await insertMember(db, { id: M1, groupId: G1, name: "Luka", now: T0 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await listMembers(db, G1)).toEqual([]);
  });
});
