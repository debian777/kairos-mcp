import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { getUiImportMetaEnvDefine } from "./scripts/build-vite-ui-env-define.js";

/**
 * Production UI build only (`npm run ui:build`). No dev-server config: the
 * shipped surface is Express + `dist/ui`, matching tag v3.4.0 layout.
 */
export default defineConfig({
  root: "src/ui",
  base: "/ui/",
  define: getUiImportMetaEnvDefine(),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/ui"),
    },
  },
  build: {
    /** CSP sets `img-src 'self'` (helmet). Inlined `data:image/*` logos are blocked — emit assets as /ui/assets/* URLs. */
    assetsInlineLimit: 0,
    outDir: path.resolve(__dirname, "dist/ui"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: "tiptap", test: /[\\/]node_modules[\\/]@tiptap[\\/]/, priority: 15 },
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
              minSize: 20_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
