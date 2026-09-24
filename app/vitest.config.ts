import { defineConfig } from "vitest/config";

// Only the database layer is tested here; it runs on node:sqlite instead of expo-sqlite.
export default defineConfig({
  test: {
    include: ["src/db/**/*.test.ts"],
  },
});
