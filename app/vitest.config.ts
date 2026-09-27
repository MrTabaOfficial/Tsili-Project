import { defineConfig } from "vitest/config";

// Pure modules and the database layer are tested here; the latter runs on node:sqlite instead of expo-sqlite.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
