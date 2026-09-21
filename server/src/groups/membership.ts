import type { Db } from "../db.js";
import { HttpError } from "../errors.js";

type Reader = Pick<Db, "member">;

/** Non-members get the same 404 as a missing group, so ids cannot be probed. */
export async function requireMembership(db: Reader, userId: string, groupId: string): Promise<void> {
  const member = await db.member.findFirst({
    where: { groupId, userId, deletedAt: null, group: { deletedAt: null } },
    select: { id: true },
  });
  if (!member) throw new HttpError(404, "GROUP_NOT_FOUND", "group not found");
}
