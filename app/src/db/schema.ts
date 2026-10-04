import type { SqlDb } from "./sql";

/**
 * Append a new entry for every schema change; never edit an applied one, because phones in the
 * field have already run it. The index in this array is the version stored in PRAGMA user_version.
 */
export const MIGRATIONS: readonly (readonly string[])[] = [
  [
    `CREATE TABLE groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL,
      invite_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id),
      name TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE INDEX members_group ON members(group_id)`,
    `CREATE TABLE expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id),
      payer_member_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      split_rule TEXT NOT NULL,
      shares TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE INDEX expenses_group_date ON expenses(group_id, date)`,
    `CREATE TABLE repayments (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id),
      from_member_id TEXT NOT NULL,
      to_member_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      dirty INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE INDEX repayments_group_date ON repayments(group_id, date)`,
    `CREATE TABLE sync_state (
      group_id TEXT PRIMARY KEY REFERENCES groups(id),
      cursor TEXT NOT NULL DEFAULT '0',
      last_synced_at TEXT
    )`,
  ],
  [
    // Which member in the group is this phone's user; set at creation or when joining.
    `ALTER TABLE groups ADD COLUMN my_member_id TEXT`,
  ],
  [
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: SqlDb): Promise<void> {
  const [row] = await db.all<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const statements = MIGRATIONS[version]!;
    const next = version + 1;
    await db.transaction(async () => {
      for (const sql of statements) await db.run(sql);
      await db.run(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
