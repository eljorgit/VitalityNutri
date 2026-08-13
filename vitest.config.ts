import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@src": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@i18n": path.resolve(__dirname, "src/i18n"),
      "@services": path.resolve(__dirname, "src/services"),
      "@server": path.resolve(__dirname, "server"),
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
