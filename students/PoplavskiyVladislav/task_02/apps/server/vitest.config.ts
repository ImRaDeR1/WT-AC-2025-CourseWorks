import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    threads: false,
    testTimeout: 30_000,
  },
});
