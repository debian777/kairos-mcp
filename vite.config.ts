import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/ui",
  base: "/ui/",
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
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3300", changeOrigin: true },
      "/ui": { target: "http://localhost:3300", changeOrigin: true },
    },
  },
});
