import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(String(key)) ? (store.get(String(key)) as string) : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  } as Storage;
}

/**
 * Node 22+ may expose an unusable global `localStorage` without `--localstorage-file`;
 * Vitest/jsdom then leaves bare `localStorage` undefined in tests. Mirror a single store on
 * `globalThis` and `window` so hooks and tests agree.
 */
const uiTestLocalStorage = createInMemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  value: uiTestLocalStorage,
  writable: true,
  configurable: true,
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: uiTestLocalStorage,
    writable: true,
    configurable: true,
  });
}

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
