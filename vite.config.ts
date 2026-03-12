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
    outDir: path.resolve(__dirname, "dist/ui"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3300", changeOrigin: true },
      "/ui": { target: "http://localhost:3300", changeOrigin: true },
    },
  },
});
