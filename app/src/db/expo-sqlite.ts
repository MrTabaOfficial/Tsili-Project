import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type { SqlDb, SqlValue } from "./sql";

export const DATABASE_NAME = "tsili.db";

export async function openExpoDb(name = DATABASE_NAME): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // The web build holds an exclusive file lock; release it on unload or the next page load cannot open the database.
    window.addEventListener("pagehide", () => void db.closeAsync());
  }
  return {
    async run(sql: string, params: SqlValue[] = []) {
      await db.runAsync(sql, params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.getAllAsync<T>(sql, params);
    },
    // withTransactionAsync is the variant that also works on web; the exclusive form is native-only.
    transaction<T>(fn: () => Promise<T>) {
      let result: T;
      return db
        .withTransactionAsync(async () => {
          result = await fn();
        })
        .then(() => result);
    },
  };
}
