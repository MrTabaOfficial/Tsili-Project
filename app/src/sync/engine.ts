import type {
  CreateGroupRequest,
  Expense,
  Group,
  GroupWithMembers,
  Member,
  Repayment,
  SyncRejection,
  SyncRequest,
  SyncResponse,
  UpdateGroupRequest,
} from "@tsili/shared";
import { getExpense, listDirtyExpenses, upsertExpense } from "../db/repo/expenses";
import {
  applyServerGroup,
  getGroup,
  listGroupsToSync,
  markGroupClean,
  markGroupGone,
  setMyMember,
  type LocalGroup,
} from "../db/repo/groups";
import { getMember, listDirtyMembers, listMembers, upsertMember } from "../db/repo/members";
import { getRepayment, listDirtyRepayments, upsertRepayment } from "../db/repo/repayments";
import { getCursor, markClean, setCursor } from "../db/repo/syncState";
import type { SqlDb } from "../db/sql";

/** The three server calls the engine needs; the app passes real HTTP, tests pass a fake. */
export interface SyncApi {
  createGroup(req: CreateGroupRequest): Promise<GroupWithMembers>;
  getGroup(groupId: string): Promise<GroupWithMembers>;
  renameGroup(groupId: string, req: UpdateGroupRequest): Promise<GroupWithMembers>;
  deleteGroup(groupId: string): Promise<void>;
  sync(groupId: string, req: SyncRequest): Promise<SyncResponse>;
}

export interface GroupSyncResult {
  groupId: string;
  pushed: number;
  pulled: number;
  rejected: SyncRejection[];
}

export interface EngineDeps {
  db: SqlDb;
  api: SyncApi;
  now?: () => string;
}

/** Syncs every live group in turn. A failure in one group is reported and does not stop the others. */
export async function syncAll(deps: EngineDeps): Promise<{ results: GroupSyncResult[]; errors: { groupId: string; error: Error }[] }> {
  const results: GroupSyncResult[] = [];
  const errors: { groupId: string; error: Error }[] = [];
  for (const group of await listGroupsToSync(deps.db)) {
    try {
      results.push(await syncGroup(deps, group.id));
    } catch (err) {
      errors.push({ groupId: group.id, error: err instanceof Error ? err : new Error(String(err)) });
    }
  }
  return { results, errors };
}

export async function syncGroup(deps: EngineDeps, groupId: string): Promise<GroupSyncResult> {
  const { db, api } = deps;
  const now = deps.now ?? (() => new Date().toISOString());
  const group = await getGroup(db, groupId);
  if (!group) return { groupId, pushed: 0, pulled: 0, rejected: [] };
  if (group.deletedAt) {
    // Only an unpushed deletion needs the server; a group deleted offline before registration is nobody's business.
    if (group.dirty && group.inviteCode) await api.deleteGroup(groupId);
    if (group.dirty) await markGroupClean(db, groupId, group.updatedAt);
    return { groupId, pushed: 0, pulled: 0, rejected: [] };
  }
  if (!group.inviteCode) await registerGroup(deps, group);
  else if (group.dirty) {
    const data = await api.renameGroup(groupId, { name: group.name, updatedAt: group.updatedAt });
    await applyGroup(db, data.group);
    await markGroupClean(db, groupId, group.updatedAt);
  }

  const [members, expenses, repayments] = await Promise.all([
    listDirtyMembers(db, groupId),
    listDirtyExpenses(db, groupId),
    listDirtyRepayments(db, groupId),
  ]);
  const cursor = await getCursor(db, groupId);
  let response: SyncResponse;
  try {
    response = await api.sync(groupId, {
      cursor,
      changes: {
        members: members.map(stripDirty),
        expenses: expenses.map(stripDirty),
        repayments: repayments.map(stripDirty),
      },
    });
  } catch (err) {
    // The server no longer lets us in: the group was deleted, or we were removed. Hide it here too.
    if (isCode(err, "GROUP_NOT_FOUND")) {
      await markGroupGone(db, groupId, now());
      return { groupId, pushed: 0, pulled: 0, rejected: [] };
    }
    throw err;
  }

  const rejectedIds = new Set(response.rejected.map((r) => r.id));
  let pulled = 0;
  await db.transaction(async () => {
    await applyGroup(db, response.group);
    for (const m of members) if (!rejectedIds.has(m.id)) await markClean(db, "members", m.id, m.updatedAt);
    for (const e of expenses) if (!rejectedIds.has(e.id)) await markClean(db, "expenses", e.id, e.updatedAt);
    for (const r of repayments) if (!rejectedIds.has(r.id)) await markClean(db, "repayments", r.id, r.updatedAt);

    for (const m of response.changes.members) pulled += await applyMember(db, m);
    for (const e of response.changes.expenses) pulled += await applyExpense(db, e);
    for (const r of response.changes.repayments) pulled += await applyRepayment(db, r);

    await setCursor(db, groupId, response.cursor, now());
  });

  return {
    groupId,
    pushed: members.length + expenses.length + repayments.length - response.rejected.length,
    pulled,
    rejected: response.rejected,
  };
}

/** Writes a group received from the server (join flow) and remembers which member is this user. */
export async function importGroup(db: SqlDb, data: GroupWithMembers, userId: string): Promise<void> {
  await db.transaction(async () => {
    await applyServerGroup(db, data.group);
    for (const m of data.members) await applyMember(db, m);
    const mine = data.members.find((m) => m.userId === userId);
    if (mine) await setMyMember(db, data.group.id, mine.id);
  });
}

/** First contact for an offline-created group: the server takes our id and claims our member for this account. */
async function registerGroup(deps: EngineDeps, group: LocalGroup): Promise<void> {
  const { db, api } = deps;
  const myMember = group.myMemberId ? await getMember(db, group.myMemberId) : null;
  const fallback = myMember ?? (await listMembers(db, group.id))[0] ?? null;
  const request: CreateGroupRequest = {
    id: group.id,
    name: group.name,
    currency: group.currency,
    ...(fallback ? { creatorMember: { id: fallback.id, name: fallback.name } } : {}),
  };
  let data: GroupWithMembers;
  try {
    data = await api.createGroup(request);
  } catch (err) {
    // A lost reply from an earlier attempt leaves the group registered; fetching it is the recovery.
    if (isCode(err, "GROUP_EXISTS")) data = await api.getGroup(group.id);
    else throw err;
  }
  await db.transaction(async () => {
    await applyServerGroup(db, data.group);
    for (const m of data.members) await applyMember(db, m);
    if (fallback && !group.myMemberId) await setMyMember(db, group.id, fallback.id);
  });
}

/** Newer-wins for the group row itself; a dirty local rename that is newer is kept until pushed. */
async function applyGroup(db: SqlDb, remote: Group): Promise<void> {
  const local = await getGroup(db, remote.id);
  if (local && local.updatedAt > remote.updatedAt) return;
  await applyServerGroup(db, remote);
}

/**
 * Same rule as the server: the newer updatedAt wins. A newer local row stays as it is (and stays dirty
 * if it has not been pushed yet); anything else is replaced by the server copy and marked clean.
 */
async function applyMember(db: SqlDb, remote: Member): Promise<number> {
  const local = await getMember(db, remote.id);
  if (local && local.updatedAt > remote.updatedAt) {
    // userId is server-owned, so a claim is taken even when the local row is otherwise newer.
    if (local.userId !== remote.userId) await upsertMember(db, { ...local, userId: remote.userId }, local.dirty);
    return 0;
  }
  await upsertMember(db, remote, false);
  return 1;
}

async function applyExpense(db: SqlDb, remote: Expense): Promise<number> {
  const local = await getExpense(db, remote.id);
  if (local && local.updatedAt > remote.updatedAt) return 0;
  await upsertExpense(db, remote, false);
  return 1;
}

async function applyRepayment(db: SqlDb, remote: Repayment): Promise<number> {
  const local = await getRepayment(db, remote.id);
  if (local && local.updatedAt > remote.updatedAt) return 0;
  await upsertRepayment(db, remote, false);
  return 1;
}

function stripDirty<T extends { dirty: boolean }>(row: T): Omit<T, "dirty"> {
  const { dirty: _dirty, ...rest } = row;
  return rest;
}

function isCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === code;
}
