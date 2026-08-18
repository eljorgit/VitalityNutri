import { defineConfig } from "vitest/config";
import path from "path";

const rootDir = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "."),
      "@src": path.resolve(rootDir, "src"),
      "@components": path.resolve(rootDir, "src/components"),
      "@utils": path.resolve(rootDir, "src/utils"),
      "@i18n": path.resolve(rootDir, "src/i18n"),
      "@services": path.resolve(rootDir, "src/services"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.*", "src/i18n/**"],
    },
  },
});
