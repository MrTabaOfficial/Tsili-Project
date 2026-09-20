import type { Group, Member } from "@tsili/shared";
import type { Group as GroupRow, Member as MemberRow } from "../generated/prisma/client.js";

/** Rows to wire shape: dates become ISO strings, the enum stays a string the shared schema will check. */
export function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency as Group["currency"],
    inviteCode: row.inviteCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
