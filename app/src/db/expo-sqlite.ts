import * as SQLite from "expo-sqlite";
import type { SqlDb, SqlValue } from "./sql";

export const DATABASE_NAME = "tsili.db";

export async function openExpoDb(name = DATABASE_NAME): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  return {
    async run(sql: string, params: SqlValue[] = []) {
      await db.runAsync(sql, params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.getAllAsync<T>(sql, params);
    },
    transaction<T>(fn: () => Promise<T>) {
      let result: T;
      return db
        .withExclusiveTransactionAsync(async () => {
          result = await fn();
        })
        .then(() => result);
    },
  };
}
