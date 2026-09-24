/** The only database surface the repositories use. expo-sqlite and node:sqlite both fit behind it. */
export type SqlValue = string | number | null;

export interface SqlDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Runs fn inside BEGIN/COMMIT, rolling back if it throws. Not re-entrant. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export async function one<T>(db: SqlDb, sql: string, params?: SqlValue[]): Promise<T | null> {
  const rows = await db.all<T>(sql, params);
  return rows[0] ?? null;
}
