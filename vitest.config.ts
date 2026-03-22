import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { getUiImportMetaEnvDefine } from "./vite-ui-env-define.js";

const vitestReporters = process.env.CI ? ["default", "github-actions"] : ["default"];

export default defineConfig({
  root: ".",
  define: getUiImportMetaEnvDefine(),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/ui"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/ui/setup.ts"],
    include: ["tests/ui/**/*.test.{ts,tsx}"],
    reporters: vitestReporters,
  },
});
