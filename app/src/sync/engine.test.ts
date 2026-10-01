import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  splitEqually,
  type CreateGroupRequest,
  type Expense,
  type Group,
  type GroupWithMembers,
  type Member,
  type SyncRequest,
  type SyncResponse,
  type UpdateGroupRequest,
} from "@tsili/shared";
import { openNodeDb } from "../db/node-sqlite";
import { getExpense, listExpenses, upsertExpense } from "../db/repo/expenses";
import { deleteGroup, getGroup, insertGroup, listGroups, renameGroup } from "../db/repo/groups";
import { getMember, insertMember, listMembers, renameMember } from "../db/repo/members";
import { migrate } from "../db/schema";
import { getCursor } from "../db/repo/syncState";
import { importGroup, syncAll, syncGroup, type SyncApi } from "./engine";

const T0 = "2026-10-06T10:00:00.000Z";
const T1 = "2026-10-06T11:00:00.000Z";
const T2 = "2026-10-06T12:00:00.000Z";
const G = "11111111-1111-4111-8111-111111111111";
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NINO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const E1 = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1";
const E2 = "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2";
const USER = "99999999-9999-4999-8999-999999999999";

let db: ReturnType<typeof openNodeDb>;

/** In-memory stand-in for the server: records what was sent and replies with what the test queued. */
class FakeApi implements SyncApi {
  createGroupCalls: CreateGroupRequest[] = [];
  syncCalls: { groupId: string; req: SyncRequest }[] = [];
  getGroupCalls = 0;
  renameCalls: { groupId: string; req: UpdateGroupRequest }[] = [];
  deleteCalls: string[] = [];
  createGroupError: unknown = null;
  syncError: unknown = null;
  nextSync: SyncResponse = { cursor: "1", group: serverGroupRow(), changes: { members: [], expenses: [], repayments: [] }, rejected: [] };

  async createGroup(req: CreateGroupRequest): Promise<GroupWithMembers> {
    this.createGroupCalls.push(req);
    if (this.createGroupError) throw this.createGroupError;
    return serverGroup(req.creatorMember?.id ?? ME, req.creatorMember?.name ?? "Me");
  }
  async getGroup(): Promise<GroupWithMembers> {
    this.getGroupCalls += 1;
    return serverGroup(ME, "Me");
  }
  async renameGroup(groupId: string, req: UpdateGroupRequest): Promise<GroupWithMembers> {
    this.renameCalls.push({ groupId, req });
    const data = serverGroup(ME, "Me");
    return { ...data, group: { ...data.group, name: req.name, updatedAt: req.updatedAt ?? data.group.updatedAt } };
  }
  async deleteGroup(groupId: string): Promise<void> {
    this.deleteCalls.push(groupId);
  }
  async sync(groupId: string, req: SyncRequest): Promise<SyncResponse> {
    this.syncCalls.push({ groupId, req });
    if (this.syncError) throw this.syncError;
    return this.nextSync;
  }
}

function serverGroupRow(overrides: Partial<Group> = {}): Group {
  return { id: G, name: "Kazbegi", currency: "GEL", inviteCode: "KAZB2326", createdAt: T0, updatedAt: T0, deletedAt: null, ...overrides };
}

function serverGroup(memberId: string, memberName: string): GroupWithMembers {
  return {
    group: serverGroupRow(),
    members: [{ id: memberId, groupId: G, name: memberName, userId: USER, createdAt: T0, updatedAt: T0, deletedAt: null }],
  };
}

function expense(id: string, updatedAt: string, description = "Dinner"): Expense {
  return {
    id,
    groupId: G,
    payerMemberId: ME,
    amount: 100,
    description,
    date: "2026-10-06",
    splitRule: { kind: "equal", memberIds: [ME] },
    shares: splitEqually(100, [ME]),
    createdAt: T0,
    updatedAt,
    deletedAt: null,
  };
}

beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
});
afterEach(() => db.close());

async function offlineGroup() {
  await insertGroup(db, { id: G, name: "Kazbegi", currency: "GEL", now: T0, myMemberId: ME });
  await insertMember(db, { id: ME, groupId: G, name: "Me", now: T0 });
}

describe("registering an offline-created group", () => {
  it("sends the client id and my member, then stores the invite code and claim", async () => {
    await offlineGroup();
    const api = new FakeApi();
    await syncGroup({ db, api, now: () => T1 }, G);
    expect(api.createGroupCalls).toEqual([{ id: G, name: "Kazbegi", currency: "GEL", creatorMember: { id: ME, name: "Me" } }]);
    const group = await getGroup(db, G);
    expect(group).toMatchObject({ inviteCode: "KAZB2326", dirty: false, myMemberId: ME });
    expect(await getMember(db, ME)).toMatchObject({ userId: USER, dirty: false });
  });

  it("recovers from a lost reply by fetching the already-registered group", async () => {
    await offlineGroup();
    const api = new FakeApi();
    api.createGroupError = Object.assign(new Error("exists"), { code: "GROUP_EXISTS" });
    await syncGroup({ db, api }, G);
    expect(api.getGroupCalls).toBe(1);
    expect((await getGroup(db, G))?.inviteCode).toBe("KAZB2326");
  });

  it("does not register a group that already has an invite code", async () => {
    await offlineGroup();
    const api = new FakeApi();
    await syncGroup({ db, api }, G);
    await syncGroup({ db, api }, G);
    expect(api.createGroupCalls).toHaveLength(1);
    expect(api.syncCalls).toHaveLength(2);
  });
});

describe("push", () => {
  it("pushes dirty rows without the dirty flag and marks them clean", async () => {
    await offlineGroup();
    await upsertExpense(db, expense(E1, T0), true);
    const api = new FakeApi();
    const result = await syncGroup({ db, api }, G);
    const sent = api.syncCalls[1]?.req ?? api.syncCalls[0]!.req; // registration pulls members; expenses go in the sync call
    expect(sent.changes.expenses).toEqual([expense(E1, T0)]);
    expect(sent.changes.expenses[0]).not.toHaveProperty("dirty");
    expect(result.pushed).toBe(1);
    expect((await getExpense(db, E1))?.dirty).toBe(false);
    expect(await getCursor(db, G)).toBe("1");
  });

  it("keeps a row dirty when it changed during the request", async () => {
    await offlineGroup();
    await insertMember(db, { id: NINO, groupId: G, name: "Nino", now: T0 });
    const api = new FakeApi();
    api.sync = async (groupId, req) => {
      api.syncCalls.push({ groupId, req });
      await renameMember(db, NINO, "Nino edited mid-flight", T2); // the user edits while the request is in flight
      return api.nextSync;
    };
    await syncGroup({ db, api }, G);
    expect(await getMember(db, NINO)).toMatchObject({ name: "Nino edited mid-flight", dirty: true });
  });

  it("keeps rejected rows dirty and reports them", async () => {
    await offlineGroup();
    await upsertExpense(db, expense(E1, T0), true);
    const api = new FakeApi();
    api.nextSync = { ...api.nextSync, cursor: "5", rejected: [{ kind: "expense", id: E1, code: "VALIDATION", message: "bad" }] };
    const result = await syncGroup({ db, api }, G);
    expect(result.rejected).toHaveLength(1);
    expect(result.pushed).toBe(0);
    expect((await getExpense(db, E1))?.dirty).toBe(true);
    expect(await getCursor(db, G)).toBe("5");
  });
});

describe("pull", () => {
  it("applies server rows as clean and newer-wins against local copies", async () => {
    await offlineGroup();
    // E1 is pushed in this same call and marked clean; an older server copy must still not overwrite it.
    await upsertExpense(db, expense(E1, T1, "local newer"), true);
    await upsertExpense(db, expense(E2, T0, "local older"), false);
    const api = new FakeApi();
    api.nextSync = {
      ...api.nextSync,
      cursor: "9",
      changes: { members: [], expenses: [expense(E1, T0, "server older"), expense(E2, T2, "server newer")], repayments: [] },
    };
    const result = await syncGroup({ db, api }, G);
    expect((await getExpense(db, E1))).toMatchObject({ description: "local newer", dirty: false });
    expect((await getExpense(db, E2))).toMatchObject({ description: "server newer", dirty: false });
    expect(result.pulled).toBe(1);
  });

  it("takes the server's userId claim even when the local member row is newer", async () => {
    await offlineGroup();
    await insertMember(db, { id: NINO, groupId: G, name: "Nino renamed locally", now: T2 });
    const api = new FakeApi();
    const claimed: Member = { id: NINO, groupId: G, name: "Nino", userId: USER, createdAt: T0, updatedAt: T1, deletedAt: null };
    api.nextSync = { ...api.nextSync, cursor: "3", changes: { members: [claimed], expenses: [], repayments: [] } };
    await syncGroup({ db, api }, G);
    // The local row was pushed in this same call, so it is clean, but its newer name survives and the claim is taken.
    expect(await getMember(db, NINO)).toMatchObject({ name: "Nino renamed locally", userId: USER, dirty: false });
  });

  it("applies soft deletes from the server", async () => {
    await offlineGroup();
    await upsertExpense(db, expense(E1, T0), false);
    const api = new FakeApi();
    api.nextSync = { ...api.nextSync, cursor: "4", changes: { members: [], expenses: [{ ...expense(E1, T1), deletedAt: T1 }], repayments: [] } };
    await syncGroup({ db, api }, G);
    expect(await listExpenses(db, G)).toEqual([]);
  });
});

describe("group rename and delete", () => {
  async function registered() {
    await offlineGroup();
    const api = new FakeApi();
    await syncGroup({ db, api }, G);
    return api;
  }

  it("pushes an offline rename with its timestamp and marks the group clean", async () => {
    const api = await registered();
    await renameGroup(db, G, "Svaneti", T2);
    await syncGroup({ db, api }, G);
    expect(api.renameCalls).toEqual([{ groupId: G, req: { name: "Svaneti", updatedAt: T2 } }]);
    expect(await getGroup(db, G)).toMatchObject({ name: "Svaneti", dirty: false });
  });

  it("applies a rename coming from the server unless the local rename is newer", async () => {
    const api = await registered();
    api.nextSync = { ...api.nextSync, group: serverGroupRow({ name: "Renamed elsewhere", updatedAt: T1 }) };
    await syncGroup({ db, api }, G);
    expect((await getGroup(db, G))?.name).toBe("Renamed elsewhere");

    await renameGroup(db, G, "Mine, newer", T2);
    api.nextSync = { ...api.nextSync, group: serverGroupRow({ name: "Older server name", updatedAt: T1 }) };
    await syncGroup({ db, api }, G);
    expect((await getGroup(db, G))?.name).toBe("Mine, newer");
  });

  it("pushes a deletion once and skips the group afterwards", async () => {
    const api = await registered();
    await deleteGroup(db, G, T2);
    await syncAll({ db, api });
    await syncAll({ db, api });
    expect(api.deleteCalls).toEqual([G]);
    expect(api.syncCalls).toHaveLength(1); // only the registration-time sync
    expect(await getGroup(db, G)).toMatchObject({ deletedAt: T2, dirty: false });
  });

  it("does not call the server for a group deleted before it was ever registered", async () => {
    await offlineGroup();
    await deleteGroup(db, G, T1);
    const api = new FakeApi();
    await syncAll({ db, api });
    expect(api.createGroupCalls).toEqual([]);
    expect(api.deleteCalls).toEqual([]);
  });

  it("hides a group locally when the server answers GROUP_NOT_FOUND", async () => {
    const api = await registered();
    api.syncError = Object.assign(new Error("gone"), { code: "GROUP_NOT_FOUND" });
    await syncGroup({ db, api, now: () => T2 }, G);
    expect(await listGroups(db)).toEqual([]);
    expect(await getGroup(db, G)).toMatchObject({ deletedAt: T2, dirty: false });
  });
});

describe("importGroup and syncAll", () => {
  it("imports a joined group with its members and remembers my member", async () => {
    await importGroup(db, serverGroup(ME, "Me"), USER);
    expect(await getGroup(db, G)).toMatchObject({ inviteCode: "KAZB2326", myMemberId: ME, dirty: false });
    expect((await listMembers(db, G)).map((m) => m.name)).toEqual(["Me"]);
  });

  it("continues past a group whose sync fails", async () => {
    await offlineGroup();
    const G2 = "22222222-2222-4222-8222-222222222222";
    await insertGroup(db, { id: G2, name: "Flat", currency: "GEL", now: T1 });
    const api = new FakeApi();
    const original = api.createGroup.bind(api);
    api.createGroup = async (req) => {
      if (req.id === G2) throw new Error("server down");
      return original(req);
    };
    const { results, errors } = await syncAll({ db, api });
    expect(results.map((r) => r.groupId)).toEqual([G]);
    expect(errors.map((e) => e.groupId)).toEqual([G2]);
  });
});
