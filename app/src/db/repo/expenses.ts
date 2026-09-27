import { expenseSchema, type Expense } from "@tsili/shared";
import { one, type SqlDb } from "../sql";

export type LocalExpense = Expense & { dirty: boolean };

interface ExpenseRow {
  id: string;
  group_id: string;
  payer_member_id: string;
  amount: number;
  description: string;
  date: string;
  split_rule: string;
  shares: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: number;
}

/** Insert or replace. Local edits pass dirty=true; records applied from the server pass dirty=false. */
export async function upsertExpense(db: SqlDb, e: Expense, dirty: boolean): Promise<void> {
  await db.run(
    `INSERT INTO expenses (id, group_id, payer_member_id, amount, description, date, split_rule, shares,
                           created_at, updated_at, deleted_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payer_member_id = excluded.payer_member_id, amount = excluded.amount,
       description = excluded.description, date = excluded.date,
       split_rule = excluded.split_rule, shares = excluded.shares,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, dirty = excluded.dirty`,
    [
      e.id,
      e.groupId,
      e.payerMemberId,
      e.amount,
      e.description,
      e.date,
      JSON.stringify(e.splitRule),
      JSON.stringify(e.shares),
      e.createdAt,
      e.updatedAt,
      e.deletedAt,
      dirty ? 1 : 0,
    ],
  );
}

/** Live expenses, newest date first. */
export async function listExpenses(db: SqlDb, groupId: string): Promise<LocalExpense[]> {
  const rows = await db.all<ExpenseRow>(
    "SELECT * FROM expenses WHERE group_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC",
    [groupId],
  );
  return rows.map(fromRow);
}

export async function getExpense(db: SqlDb, id: string): Promise<LocalExpense | null> {
  const row = await one<ExpenseRow>(db, "SELECT * FROM expenses WHERE id = ?", [id]);
  return row ? fromRow(row) : null;
}

export async function deleteExpense(db: SqlDb, id: string, now: string): Promise<void> {
  await db.run("UPDATE expenses SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?", [now, now, id]);
}

function fromRow(r: ExpenseRow): LocalExpense {
  // Parsing through the shared schema recomputes the split, so a corrupted row throws instead of skewing balances.
  const expense = expenseSchema.parse({
    id: r.id,
    groupId: r.group_id,
    payerMemberId: r.payer_member_id,
    amount: r.amount,
    description: r.description,
    date: r.date,
    splitRule: JSON.parse(r.split_rule),
    shares: JSON.parse(r.shares),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  });
  return { ...expense, dirty: r.dirty === 1 };
}
