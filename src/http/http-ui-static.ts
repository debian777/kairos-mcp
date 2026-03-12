import path from "node:path";
import express from "express";

/** Always serve the built SPA from dist/ui (dev runs from src via ts-node, so we use cwd). */
const UI_DIR = path.resolve(process.cwd(), "dist", "ui");

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
