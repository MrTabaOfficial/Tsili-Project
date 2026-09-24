import type { Currency } from "@tsili/shared";
import { one, type SqlDb } from "../sql";

/** A group as stored on the phone. inviteCode is null until the server has registered the group. */
export interface LocalGroup {
  id: string;
  name: string;
  currency: Currency;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
}

interface GroupRow {
  id: string;
  name: string;
  currency: string;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

export interface NewGroup {
  id: string;
  name: string;
  currency: Currency;
  now: string;
}

export async function insertGroup(db: SqlDb, input: NewGroup): Promise<LocalGroup> {
  await db.run(
    `INSERT INTO groups (id, name, currency, invite_code, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, NULL, ?, ?, NULL, 1)`,
    [input.id, input.name, input.currency, input.now, input.now],
  );
  return (await getGroup(db, input.id))!;
}

export async function listGroups(db: SqlDb): Promise<LocalGroup[]> {
  const rows = await db.all<GroupRow>("SELECT * FROM groups WHERE deleted_at IS NULL ORDER BY created_at DESC");
  return rows.map(fromRow);
}

export async function getGroup(db: SqlDb, id: string): Promise<LocalGroup | null> {
  const row = await one<GroupRow>(db, "SELECT * FROM groups WHERE id = ?", [id]);
  return row ? fromRow(row) : null;
}

export async function renameGroup(db: SqlDb, id: string, name: string, now: string): Promise<void> {
  await db.run("UPDATE groups SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?", [name, now, id]);
}

export async function deleteGroup(db: SqlDb, id: string, now: string): Promise<void> {
  await db.run("UPDATE groups SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?", [now, now, id]);
}

function fromRow(r: GroupRow): LocalGroup {
  return {
    id: r.id,
    name: r.name,
    currency: r.currency as Currency,
    inviteCode: r.invite_code,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    dirty: r.dirty === 1,
  };
}
