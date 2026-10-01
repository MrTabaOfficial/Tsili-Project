import {
  expenseSchema,
  memberSchema,
  repaymentSchema,
  type Expense,
  type Member,
  type Repayment,
  type SyncRecordKind,
  type SyncRejection,
  type SyncRequest,
  type SyncResponse,
} from "@tsili/shared";
import type { Db } from "../db.js";
import { toExpense, toGroup, toMember, toRepayment } from "../groups/mappers.js";
import { requireMembership } from "../groups/membership.js";
import { nextServerSeq } from "./seq.js";

const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

interface Rejections {
  list: SyncRejection[];
  add(kind: SyncRecordKind, id: string | null, code: string, message: string): void;
}

export class SyncService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async sync(userId: string, groupId: string, input: SyncRequest): Promise<SyncResponse> {
    await requireMembership(this.db, userId, groupId);
    const cursor = BigInt(input.cursor);
    const rejections: Rejections = {
      list: [],
      add(kind, id, code, message) {
        this.list.push({ kind, id, code, message });
      },
    };

    return this.db.$transaction(async (tx) => {
      // One sync per group at a time, so a slow writer cannot commit a lower serverSeq after a faster
      // reader has already moved its cursor past it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${groupId}))`;

      const memberRows = await tx.member.findMany({ where: { groupId }, select: { id: true, userId: true } });
      const memberIds = new Set(memberRows.map((m) => m.id));
      const superseded = { members: new Set<string>(), expenses: new Set<string>(), repayments: new Set<string>() };

      for (const raw of input.changes.members) {
        await this.applyMember(tx, userId, groupId, raw, memberIds, superseded.members, rejections);
      }
      for (const raw of input.changes.expenses) {
        await this.applyExpense(tx, groupId, raw, memberIds, superseded.expenses, rejections);
      }
      for (const raw of input.changes.repayments) {
        await this.applyRepayment(tx, groupId, raw, memberIds, superseded.repayments, rejections);
      }

      const [group, members, expenses, repayments] = await Promise.all([
        tx.group.findUniqueOrThrow({ where: { id: groupId } }),
        tx.member.findMany({
          where: { groupId, OR: [{ serverSeq: { gt: cursor } }, { id: { in: [...superseded.members] } }] },
          orderBy: { serverSeq: "asc" },
        }),
        tx.expense.findMany({
          where: { groupId, OR: [{ serverSeq: { gt: cursor } }, { id: { in: [...superseded.expenses] } }] },
          orderBy: { serverSeq: "asc" },
        }),
        tx.repayment.findMany({
          where: { groupId, OR: [{ serverSeq: { gt: cursor } }, { id: { in: [...superseded.repayments] } }] },
          orderBy: { serverSeq: "asc" },
        }),
      ]);

      let newCursor = cursor;
      for (const row of [...members, ...expenses, ...repayments]) {
        if (row.serverSeq > newCursor) newCursor = row.serverSeq;
      }

      return {
        cursor: newCursor.toString(),
        group: toGroup(group),
        changes: {
          members: members.map(toMember),
          expenses: expenses.map(toExpense),
          repayments: repayments.map(toRepayment),
        },
        rejected: rejections.list,
      };
    });
  }

  private async applyMember(
    tx: Tx,
    userId: string,
    groupId: string,
    raw: unknown,
    memberIds: Set<string>,
    superseded: Set<string>,
    rejections: Rejections,
  ): Promise<void> {
    const record = this.validate("member", memberSchema, raw, groupId, rejections);
    if (!record) return;
    const existing = await tx.member.findUnique({ where: { id: record.id } });
    if (existing && existing.groupId !== groupId) {
      rejections.add("member", record.id, "WRONG_GROUP", "this id belongs to a record in another group");
      return;
    }
    if (!existing) {
      // userId is never taken from the client; claiming happens only through the invite endpoint.
      await tx.member.create({ data: { ...memberData(record), id: record.id, groupId, userId: null } });
      memberIds.add(record.id);
      return;
    }
    if (!isNewer(record, existing)) {
      superseded.add(record.id);
      return;
    }
    const wantsDelete = record.deletedAt !== null && existing.deletedAt === null;
    if (wantsDelete && existing.userId && existing.userId !== userId) {
      rejections.add("member", record.id, "MEMBER_CLAIMED", "cannot remove a member who has joined with their own account");
      superseded.add(record.id);
      return;
    }
    await tx.member.update({
      where: { id: record.id },
      data: { ...memberData(record), serverSeq: await nextServerSeq(tx) },
    });
  }

  private async applyExpense(
    tx: Tx,
    groupId: string,
    raw: unknown,
    memberIds: Set<string>,
    superseded: Set<string>,
    rejections: Rejections,
  ): Promise<void> {
    const record = this.validate("expense", expenseSchema, raw, groupId, rejections);
    if (!record) return;
    const referenced = [record.payerMemberId, ...Object.keys(record.shares)];
    if (!this.membersKnown("expense", record.id, referenced, memberIds, rejections)) return;

    const existing = await tx.expense.findUnique({ where: { id: record.id } });
    if (existing && existing.groupId !== groupId) {
      rejections.add("expense", record.id, "WRONG_GROUP", "this id belongs to a record in another group");
      return;
    }
    if (!existing) {
      await tx.expense.create({ data: { ...expenseData(record), id: record.id, groupId } });
    } else if (isNewer(record, existing)) {
      await tx.expense.update({ where: { id: record.id }, data: { ...expenseData(record), serverSeq: await nextServerSeq(tx) } });
    } else {
      superseded.add(record.id);
    }
  }

  private async applyRepayment(
    tx: Tx,
    groupId: string,
    raw: unknown,
    memberIds: Set<string>,
    superseded: Set<string>,
    rejections: Rejections,
  ): Promise<void> {
    const record = this.validate("repayment", repaymentSchema, raw, groupId, rejections);
    if (!record) return;
    if (!this.membersKnown("repayment", record.id, [record.fromMemberId, record.toMemberId], memberIds, rejections)) return;

    const existing = await tx.repayment.findUnique({ where: { id: record.id } });
    if (existing && existing.groupId !== groupId) {
      rejections.add("repayment", record.id, "WRONG_GROUP", "this id belongs to a record in another group");
      return;
    }
    if (!existing) {
      await tx.repayment.create({ data: { ...repaymentData(record), id: record.id, groupId } });
    } else if (isNewer(record, existing)) {
      await tx.repayment.update({ where: { id: record.id }, data: { ...repaymentData(record), serverSeq: await nextServerSeq(tx) } });
    } else {
      superseded.add(record.id);
    }
  }

  private validate<T extends { id: string; groupId: string; updatedAt: string }>(
    kind: SyncRecordKind,
    schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
    raw: unknown,
    groupId: string,
    rejections: Rejections,
  ): T | null {
    const result = schema.safeParse(raw);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path.map(String).join(".") ?? "";
      rejections.add(kind, idOf(raw), "VALIDATION", path ? `${path}: ${first?.message}` : (first?.message ?? "invalid record"));
      return null;
    }
    const record = result.data;
    if (record.groupId !== groupId) {
      rejections.add(kind, record.id, "WRONG_GROUP", "record groupId does not match the route");
      return null;
    }
    if (new Date(record.updatedAt).getTime() - this.now().getTime() > MAX_FUTURE_MS) {
      rejections.add(kind, record.id, "FUTURE_TIMESTAMP", "updatedAt is more than a day in the future; check the device clock");
      return null;
    }
    return record;
  }

  private membersKnown(kind: SyncRecordKind, id: string, ids: string[], memberIds: Set<string>, rejections: Rejections): boolean {
    const unknown = ids.find((m) => !memberIds.has(m));
    if (unknown) {
      rejections.add(kind, id, "MEMBER_NOT_IN_GROUP", `member ${unknown} is not in this group`);
      return false;
    }
    return true;
  }
}

function isNewer(record: { updatedAt: string }, existing: { updatedAt: Date }): boolean {
  return new Date(record.updatedAt).getTime() > existing.updatedAt.getTime();
}

function idOf(raw: unknown): string | null {
  if (typeof raw === "object" && raw !== null && typeof (raw as { id?: unknown }).id === "string") {
    return (raw as { id: string }).id;
  }
  return null;
}

function memberData(m: Member) {
  return {
    name: m.name,
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
    deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
  };
}

function expenseData(e: Expense) {
  return {
    payerMemberId: e.payerMemberId,
    amount: BigInt(e.amount),
    description: e.description,
    date: e.date,
    splitRule: e.splitRule,
    shares: e.shares,
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
    deletedAt: e.deletedAt ? new Date(e.deletedAt) : null,
  };
}

function repaymentData(r: Repayment) {
  return {
    fromMemberId: r.fromMemberId,
    toMemberId: r.toMemberId,
    amount: BigInt(r.amount),
    date: r.date,
    note: r.note,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
  };
}
