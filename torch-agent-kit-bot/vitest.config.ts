import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
  },
  esbuild: {
    target: "es2022",
  },
  resolve: {
    extensions: [".ts"],
  },
});
