import { defineConfig } from "vitest/config";

// Defaults match docker-compose.yml so `npm test` works with no .env. Override via the environment.
const testEnv = {
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL_TEST ?? "postgresql://tsili:tsili@localhost:5432/tsili_test",
  JWT_SECRET: "test-secret-test-secret-test-secret-test-secret",
  LOG_LEVEL: "silent",
};

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ["./test/global-setup.ts"],
    // Tests share one database and truncate between cases, so files must not run concurrently.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
