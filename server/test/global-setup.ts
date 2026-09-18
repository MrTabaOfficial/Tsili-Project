import { execSync } from "node:child_process";

/** Brings the test database up to date before any test file runs. */
export default function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? "postgresql://tsili:tsili@localhost:5432/tsili_test";
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
