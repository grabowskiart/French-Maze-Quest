import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(here, "shared"),
      "@": path.resolve(here, "client", "src"),
    },
  },
});
