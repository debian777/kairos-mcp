import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

// So JSX in test files has React in scope (Vitest/esbuild may not inject automatic runtime for tests)
(globalThis as unknown as { React: typeof React }).React = React;

expect.extend(matchers);

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(""),
  },
  writable: true,
  configurable: true,
});

afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined" && typeof localStorage.clear === "function") {
    localStorage.clear();
  }
  const writeText = navigator.clipboard?.writeText;
  if (writeText && typeof (writeText as { mockClear?: () => void }).mockClear === "function") {
    (writeText as { mockClear: () => void }).mockClear();
  }
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
