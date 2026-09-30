import { repaymentSchema, type Repayment } from "@tsili/shared";
import { one, type SqlDb } from "../sql";

export type LocalRepayment = Repayment & { dirty: boolean };

interface RepaymentRow {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

export async function upsertRepayment(db: SqlDb, r: Repayment, dirty: boolean): Promise<void> {
  await db.run(
    `INSERT INTO repayments (id, group_id, from_member_id, to_member_id, amount, date, note,
                             created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       from_member_id = excluded.from_member_id, to_member_id = excluded.to_member_id,
       amount = excluded.amount, date = excluded.date, note = excluded.note,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, dirty = excluded.dirty`,
    [r.id, r.groupId, r.fromMemberId, r.toMemberId, r.amount, r.date, r.note, r.createdAt, r.updatedAt, r.deletedAt, dirty ? 1 : 0],
  );
}

export async function listRepayments(db: SqlDb, groupId: string): Promise<LocalRepayment[]> {
  const rows = await db.all<RepaymentRow>(
    "SELECT * FROM repayments WHERE group_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC",
    [groupId],
  );
  return rows.map(fromRow);
}

export async function listDirtyRepayments(db: SqlDb, groupId: string): Promise<LocalRepayment[]> {
  const rows = await db.all<RepaymentRow>("SELECT * FROM repayments WHERE group_id = ? AND dirty = 1 ORDER BY created_at ASC", [groupId]);
  return rows.map(fromRow);
}

export async function getRepayment(db: SqlDb, id: string): Promise<LocalRepayment | null> {
  const row = await one<RepaymentRow>(db, "SELECT * FROM repayments WHERE id = ?", [id]);
  return row ? fromRow(row) : null;
}

export async function deleteRepayment(db: SqlDb, id: string, now: string): Promise<void> {
  await db.run("UPDATE repayments SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?", [now, now, id]);
}

function fromRow(r: RepaymentRow): LocalRepayment {
  const repayment = repaymentSchema.parse({
    id: r.id,
    groupId: r.group_id,
    fromMemberId: r.from_member_id,
    toMemberId: r.to_member_id,
    amount: r.amount,
    date: r.date,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  });
  return { ...repayment, dirty: r.dirty === 1 };
}
