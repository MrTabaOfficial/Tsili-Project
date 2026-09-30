import { one, type SqlDb } from "../sql";

export async function getCursor(db: SqlDb, groupId: string): Promise<string> {
  const row = await one<{ cursor: string }>(db, "SELECT cursor FROM sync_state WHERE group_id = ?", [groupId]);
  return row?.cursor ?? "0";
}

export async function setCursor(db: SqlDb, groupId: string, cursor: string, now: string): Promise<void> {
  await db.run(
    `INSERT INTO sync_state (group_id, cursor, last_synced_at) VALUES (?, ?, ?)
     ON CONFLICT(group_id) DO UPDATE SET cursor = excluded.cursor, last_synced_at = excluded.last_synced_at`,
    [groupId, cursor, now],
  );
}

export async function getLastSyncedAt(db: SqlDb, groupId: string): Promise<string | null> {
  const row = await one<{ last_synced_at: string | null }>(db, "SELECT last_synced_at FROM sync_state WHERE group_id = ?", [groupId]);
  return row?.last_synced_at ?? null;
}

export type SyncedTable = "members" | "expenses" | "repayments";

/** Clears dirty only if the row still has the updatedAt that was pushed; an edit during the request keeps it dirty. */
export async function markClean(db: SqlDb, table: SyncedTable, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.run(`UPDATE ${table} SET dirty = 0 WHERE id = ? AND updated_at = ?`, [id, pushedUpdatedAt]);
}

export async function countDirty(db: SqlDb): Promise<number> {
  const row = await one<{ n: number }>(
    db,
    `SELECT (SELECT COUNT(*) FROM members WHERE dirty = 1)
          + (SELECT COUNT(*) FROM expenses WHERE dirty = 1)
          + (SELECT COUNT(*) FROM repayments WHERE dirty = 1)
          + (SELECT COUNT(*) FROM groups WHERE invite_code IS NULL AND deleted_at IS NULL) AS n`,
  );
  return row?.n ?? 0;
}
