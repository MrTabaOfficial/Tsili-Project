import type { Db } from "../db.js";

type Querier = Pick<Db, "$queryRaw">;

/** Inserts get a sequence value from the column default; updates must claim one explicitly so they reappear in pulls. */
export async function nextServerSeq(db: Querier): Promise<bigint> {
  const rows = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('sync_seq')`;
  return rows[0]!.nextval;
}
