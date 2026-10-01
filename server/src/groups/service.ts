import { randomUUID } from "node:crypto";
import type {
  CreateGroupRequest,
  CreateMemberRequest,
  GroupWithMembers,
  InvitePreview,
  JoinGroupRequest,
  Member,
  UpdateGroupRequest,
  UpdateMemberRequest,
} from "@tsili/shared";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import { nextServerSeq } from "../sync/seq.js";
import { generateInviteCode } from "./invite.js";
import { toGroup, toMember } from "./mappers.js";
import { requireMembership } from "./membership.js";

const INVITE_CODE_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "P2002";

export class GroupService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userId: string, input: CreateGroupRequest): Promise<GroupWithMembers> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
    if (input.id && (await this.db.group.findUnique({ where: { id: input.id }, select: { id: true } }))) {
      throw new HttpError(409, "GROUP_EXISTS", "a group with this id already exists");
    }
    if (input.creatorMember && (await this.db.member.findUnique({ where: { id: input.creatorMember.id }, select: { id: true } }))) {
      throw new HttpError(409, "MEMBER_EXISTS", "a member with this id already exists");
    }
    for (let attempt = 1; ; attempt++) {
      try {
        const group = await this.db.group.create({
          data: {
            id: input.id ?? randomUUID(),
            name: input.name,
            currency: input.currency,
            inviteCode: generateInviteCode(),
            members: {
              create: {
                id: input.creatorMember?.id ?? randomUUID(),
                name: input.creatorMember?.name ?? user.displayName,
                userId,
              },
            },
          },
          include: { members: true },
        });
        return { group: toGroup(group), members: group.members.map(toMember) };
      } catch (err) {
        // Only an invite-code collision is worth retrying; everything else propagates.
        if (!isUniqueViolation(err, "inviteCode") || attempt >= INVITE_CODE_ATTEMPTS) throw err;
      }
    }
  }

  async listForUser(userId: string): Promise<GroupWithMembers[]> {
    const groups = await this.db.group.findMany({
      where: { deletedAt: null, members: { some: { userId, deletedAt: null } } },
      include: { members: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return groups.map((g) => ({ group: toGroup(g), members: g.members.map(toMember) }));
  }

  async get(userId: string, groupId: string): Promise<GroupWithMembers> {
    await requireMembership(this.db, userId, groupId);
    return this.load(groupId);
  }

  async update(userId: string, groupId: string, input: UpdateGroupRequest): Promise<GroupWithMembers> {
    await requireMembership(this.db, userId, groupId);
    if (input.updatedAt) {
      // Offline rename with a timestamp: newer wins, exactly like synced records.
      await this.db.group.updateMany({
        where: { id: groupId, updatedAt: { lt: new Date(input.updatedAt) } },
        data: { name: input.name, updatedAt: new Date(input.updatedAt) },
      });
    } else {
      await this.db.group.update({ where: { id: groupId }, data: { name: input.name } });
    }
    return this.load(groupId);
  }

  async softDelete(userId: string, groupId: string): Promise<void> {
    await requireMembership(this.db, userId, groupId);
    await this.db.group.update({ where: { id: groupId }, data: { deletedAt: this.now() } });
  }

  async addMember(userId: string, groupId: string, input: CreateMemberRequest): Promise<Member> {
    await requireMembership(this.db, userId, groupId);
    if (input.id && (await this.db.member.findUnique({ where: { id: input.id }, select: { id: true } }))) {
      throw new HttpError(409, "MEMBER_EXISTS", "a member with this id already exists");
    }
    const row = await this.db.member.create({ data: { id: input.id ?? randomUUID(), groupId, name: input.name } });
    return toMember(row);
  }

  async updateMember(userId: string, groupId: string, memberId: string, input: UpdateMemberRequest): Promise<Member> {
    await requireMembership(this.db, userId, groupId);
    await this.requireLiveMember(groupId, memberId);
    const row = await this.db.member.update({
      where: { id: memberId },
      data: { name: input.name, serverSeq: await nextServerSeq(this.db) },
    });
    return toMember(row);
  }

  async removeMember(userId: string, groupId: string, memberId: string): Promise<void> {
    await requireMembership(this.db, userId, groupId);
    const target = await this.requireLiveMember(groupId, memberId);
    if (target.userId && target.userId !== userId) {
      throw new HttpError(403, "MEMBER_CLAIMED", "cannot remove a member who has joined with their own account");
    }
    await this.db.member.update({
      where: { id: memberId },
      data: { deletedAt: this.now(), serverSeq: await nextServerSeq(this.db) },
    });
  }

  async previewInvite(userId: string, code: string): Promise<InvitePreview> {
    const group = await this.requireGroupByInvite(code);
    const members = await this.db.member.findMany({ where: { groupId: group.id, deletedAt: null }, orderBy: { createdAt: "asc" } });
    return {
      group: { id: group.id, name: group.name, currency: toGroup(group).currency },
      unclaimedMembers: members.filter((m) => m.userId === null).map((m) => ({ id: m.id, name: m.name })),
      alreadyMemberId: members.find((m) => m.userId === userId)?.id ?? null,
    };
  }

  async join(userId: string, code: string, input: JoinGroupRequest): Promise<GroupWithMembers> {
    const group = await this.requireGroupByInvite(code);
    const existing = await this.db.member.findFirst({ where: { groupId: group.id, userId, deletedAt: null } });
    if (existing) return this.load(group.id);

    if ("memberId" in input) {
      const slot = await this.requireLiveMember(group.id, input.memberId);
      if (slot.userId) throw new HttpError(409, "MEMBER_CLAIMED", "that member has already been claimed");
      await this.db.member.update({ where: { id: slot.id }, data: { userId, serverSeq: await nextServerSeq(this.db) } });
    } else {
      await this.db.member.create({ data: { id: randomUUID(), groupId: group.id, name: input.name, userId } });
    }
    return this.load(group.id);
  }

  private async load(groupId: string): Promise<GroupWithMembers> {
    const group = await this.db.group.findUniqueOrThrow({
      where: { id: groupId },
      include: { members: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } },
    });
    return { group: toGroup(group), members: group.members.map(toMember) };
  }

  private async requireLiveMember(groupId: string, memberId: string) {
    const member = await this.db.member.findFirst({ where: { id: memberId, groupId, deletedAt: null } });
    if (!member) throw new HttpError(404, "MEMBER_NOT_FOUND", "member not found");
    return member;
  }

  private async requireGroupByInvite(code: string) {
    const group = await this.db.group.findFirst({ where: { inviteCode: code, deletedAt: null } });
    if (!group) throw new HttpError(404, "INVITE_NOT_FOUND", "no group with this invite code");
    return group;
  }
}

function isUniqueViolation(err: unknown, field: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; meta?: { target?: unknown } };
  const target = e.meta?.target;
  return e.code === UNIQUE_VIOLATION && Array.isArray(target) && target.includes(field);
}
