import { one, type SqlDb } from "../sql";

export async function getSetting(db: SqlDb, key: string): Promise<string | null> {
  const row = await one<{ value: string }>(db, "SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(db: SqlDb, key: string, value: string): Promise<void> {
  await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}
