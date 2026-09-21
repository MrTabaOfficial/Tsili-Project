import type { Expense, Group, Member, Repayment, Shares, SplitRule } from "@tsili/shared";
import type {
  Expense as ExpenseRow,
  Group as GroupRow,
  Member as MemberRow,
  Repayment as RepaymentRow,
} from "../generated/prisma/client.js";

/** Rows to wire shape: dates become ISO strings, BigInt tetri become numbers, JSON columns regain their types. */
export function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency as Group["currency"],
    inviteCode: row.inviteCode,
    ...timestamps(row),
  };
}

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    userId: row.userId,
    ...timestamps(row),
  };
}

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    groupId: row.groupId,
    payerMemberId: row.payerMemberId,
    amount: Number(row.amount),
    description: row.description,
    date: row.date,
    splitRule: row.splitRule as SplitRule,
    shares: row.shares as Shares,
    ...timestamps(row),
  };
}

export function toRepayment(row: RepaymentRow): Repayment {
  return {
    id: row.id,
    groupId: row.groupId,
    fromMemberId: row.fromMemberId,
    toMemberId: row.toMemberId,
    amount: Number(row.amount),
    date: row.date,
    note: row.note,
    ...timestamps(row),
  };
}

function timestamps(row: { createdAt: Date; updatedAt: Date; deletedAt: Date | null }) {
  return {
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
