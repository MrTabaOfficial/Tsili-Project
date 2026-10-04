import type { SqlDb } from "./sql";

type Migration = (db: SqlDb) => Promise<void>;

/**
 * Every step is idempotent (create-if-missing, add-column-if-missing) so the runner can re-apply
 * all of them when the version counter and the real tables disagree. Append new entries; never
 * reorder, because the index is the version stored in PRAGMA user_version.
 */
export const MIGRATIONS: readonly Migration[] = [
  async (db) => {
    await createTable(
      db,
      "groups",
      `id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       currency TEXT NOT NULL,
       invite_code TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       deleted_at TEXT,
       dirty INTEGER NOT NULL DEFAULT 1`,
    );
    await createTable(
      db,
      "members",
      `id TEXT PRIMARY KEY,
       group_id TEXT NOT NULL REFERENCES groups(id),
       name TEXT NOT NULL,
       user_id TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       deleted_at TEXT,
       dirty INTEGER NOT NULL DEFAULT 1`,
    );
    await db.run("CREATE INDEX IF NOT EXISTS members_group ON members(group_id)");
    await createTable(
      db,
      "expenses",
      `id TEXT PRIMARY KEY,
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
       dirty INTEGER NOT NULL DEFAULT 1`,
    );
    await db.run("CREATE INDEX IF NOT EXISTS expenses_group_date ON expenses(group_id, date)");
    await createTable(
      db,
      "repayments",
      `id TEXT PRIMARY KEY,
       group_id TEXT NOT NULL REFERENCES groups(id),
       from_member_id TEXT NOT NULL,
       to_member_id TEXT NOT NULL,
       amount INTEGER NOT NULL,
       date TEXT NOT NULL,
       note TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       deleted_at TEXT,
       dirty INTEGER NOT NULL DEFAULT 1`,
    );
    await db.run("CREATE INDEX IF NOT EXISTS repayments_group_date ON repayments(group_id, date)");
    await createTable(
      db,
      "sync_state",
      `group_id TEXT PRIMARY KEY REFERENCES groups(id),
       cursor TEXT NOT NULL DEFAULT '0',
       last_synced_at TEXT`,
    );
  },
  async (db) => {
    // Which member in the group is this phone's user; set at creation or when joining.
    await addColumn(db, "groups", "my_member_id", "TEXT");
  },
  async (db) => {
    await createTable(db, "settings", `key TEXT PRIMARY KEY, value TEXT NOT NULL`);
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Every table the current code expects. Checked after migrating so a mismatch is caught at startup. */
export const EXPECTED_TABLES = ["groups", "members", "expenses", "repayments", "sync_state", "settings"] as const;

export async function migrate(db: SqlDb): Promise<void> {
  const stored = await readVersion(db);
  for (let version = stored; version < MIGRATIONS.length; version++) {
    await applyStep(db, version);
  }
  const missing = await missingTables(db);
  if (missing.length > 0) {
    // The counter ran ahead of the tables (seen on a device). Steps are idempotent, so re-run them all.
    console.warn(`schema version ${stored} but missing ${missing.join(", ")}; repairing`);
    for (let version = 0; version < MIGRATIONS.length; version++) await applyStep(db, version);
    const still = await missingTables(db);
    if (still.length > 0) throw new Error(`Database repair failed; tables still missing: ${still.join(", ")}`);
  }
}

async function applyStep(db: SqlDb, version: number): Promise<void> {
  await db.transaction(async () => {
    await MIGRATIONS[version]!(db);
    await db.run(`PRAGMA user_version = ${version + 1}`);
  });
}

async function readVersion(db: SqlDb): Promise<number> {
  const rows = await db.all<{ user_version: number }>("PRAGMA user_version");
  return rows[0]?.user_version ?? 0;
}

async function missingTables(db: SqlDb): Promise<string[]> {
  const rows = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  const present = new Set(rows.map((r) => r.name));
  return EXPECTED_TABLES.filter((t) => !present.has(t));
}

async function createTable(db: SqlDb, name: string, columns: string): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS ${name} (${columns})`);
}

async function addColumn(db: SqlDb, table: string, column: string, definition: string): Promise<void> {
  const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return;
  await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
