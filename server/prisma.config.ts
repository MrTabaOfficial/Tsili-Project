import { defineConfig, env } from "prisma/config";

// Variables already in the environment win over .env, so tests can point at another database.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
