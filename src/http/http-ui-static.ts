import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

/** Serve the built SPA from dist/ui. Resolve so it works: (1) local dev with ts-node from src/ → dist/ui; (2) run from dist/ or npm-installed/Docker → .../dist/ui. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parentDirName = path.basename(path.resolve(__dirname, ".."));
const UI_DIR =
  parentDirName === "src"
    ? path.resolve(__dirname, "..", "..", "dist", "ui")
    : path.resolve(__dirname, "..", "ui");

/**
 * Serve the built SPA at URL /ui.
 * - GET / -> redirect to /ui
 * - Static files from dist/ui at /ui
 * - SPA fallback: GET /ui/* that don't match a file -> index.html
 */
export function setupUiStatic(app: express.Express): void {
  app.get("/", (_req, res) => {
    res.redirect(302, "/ui");
  });

  app.use("/ui", express.static(UI_DIR));

  app.use("/ui", (req, res) => {
    res.sendFile("index.html", { root: UI_DIR });
  });
}
