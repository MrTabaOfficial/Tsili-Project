import type { Member } from "@tsili/shared";
import { one, type SqlDb } from "../sql";

export type LocalMember = Member & { dirty: boolean };

interface MemberRow {
  id: string;
  group_id: string;
  name: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

export interface NewMember {
  id: string;
  groupId: string;
  name: string;
  now: string;
}

export async function insertMember(db: SqlDb, input: NewMember): Promise<LocalMember> {
  await db.run(
    `INSERT INTO members (id, group_id, name, user_id, created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, NULL, ?, ?, NULL, 1)`,
    [input.id, input.groupId, input.name, input.now, input.now],
  );
  return (await getMember(db, input.id))!;
}

/** Live members only, oldest first, which is the order people were added in. */
export async function listMembers(db: SqlDb, groupId: string): Promise<LocalMember[]> {
  const rows = await db.all<MemberRow>(
    "SELECT * FROM members WHERE group_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC",
    [groupId],
  );
  return rows.map(fromRow);
}

export async function getMember(db: SqlDb, id: string): Promise<LocalMember | null> {
  const row = await one<MemberRow>(db, "SELECT * FROM members WHERE id = ?", [id]);
  return row ? fromRow(row) : null;
}

export async function renameMember(db: SqlDb, id: string, name: string, now: string): Promise<void> {
  await db.run("UPDATE members SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?", [name, now, id]);
}

export async function deleteMember(db: SqlDb, id: string, now: string): Promise<void> {
  await db.run("UPDATE members SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?", [now, now, id]);
}

function fromRow(r: MemberRow): LocalMember {
  return {
    id: r.id,
    groupId: r.group_id,
    name: r.name,
    userId: r.user_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    dirty: r.dirty === 1,
  };
}
