import { DatabaseSync } from "node:sqlite";
import type { SqlDb, SqlValue } from "./sql";

/** Test-only adapter. Node's built-in SQLite lets the repositories run under Vitest without a phone. */
export function openNodeDb(path = ":memory:"): SqlDb & { close(): void } {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  return {
    async run(sql: string, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async transaction<T>(fn: () => Promise<T>) {
      db.exec("BEGIN");
      try {
        const result = await fn();
        db.exec("COMMIT");
        return result;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    close() {
      db.close();
    },
  };
}
