import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { HTTP_RATE_LIMIT_MAX, HTTP_RATE_LIMIT_WINDOW_MS } from "../config.js";
import { createRateLimiter } from "./http-server-config.js";

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
  const uiLimiter = createRateLimiter({
    identifier: "ui-static",
    windowMs: HTTP_RATE_LIMIT_WINDOW_MS,
    limit: HTTP_RATE_LIMIT_MAX,
    message: "Too many UI requests. Try again later."
  });

  app.get("/", uiLimiter, (_req, res) => {
    res.redirect(302, "/ui");
  });

  app.use("/ui", uiLimiter, express.static(UI_DIR));

  app.use("/ui", uiLimiter, (req, res) => {
    res.sendFile("index.html", { root: UI_DIR });
  });
}
