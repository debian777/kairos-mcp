import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  THEME_MEDIA_QUERY,
  THEME_PREFERENCE_STORAGE_KEY,
  ThemeProvider,
  applyThemeToDocument,
  getSystemPrefersDark,
  isThemePreference,
  readStoredThemePreference,
  resolveEffectiveTheme,
  useThemePreferenceContext,
} from "@/hooks/useThemePreference";

type MatchMediaListener = (event: MediaQueryListEvent) => void;
type MatchMediaController = {
  setMatches: (nextMatches: boolean) => void;
  dispatch: () => void;
};

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaListener>();

  const matchMedia = vi.fn((query: string): MediaQueryList => {
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.add(listener as MatchMediaListener);
        }
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.delete(listener as MatchMediaListener);
        }
      },
      addListener: (listener: MatchMediaListener) => listeners.add(listener),
      removeListener: (listener: MatchMediaListener) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
  });

  vi.stubGlobal("matchMedia", matchMedia);

  return {
    setMatches: (nextMatches: boolean) => {
      matches = nextMatches;
    },
    dispatch: () => {
      const event = { matches, media: THEME_MEDIA_QUERY } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function ThemeProbe() {
  const { preference, effectiveTheme, setPreference } = useThemePreferenceContext();
  return (
    <div>
      <p data-testid="preference">{preference}</p>
      <p data-testid="effective">{effectiveTheme}</p>
      <button type="button" onClick={() => setPreference("light")}>
        set-light
      </button>
      <button type="button" onClick={() => setPreference("dark")}>
        set-dark
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        set-system
      </button>
    </div>
  );
}

describe("theme preference resolver", () => {
  it("validates known preference values", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("dark-v2")).toBe(false);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("resolves effective theme from preference and system mode", () => {
    expect(resolveEffectiveTheme("light", true)).toBe("light");
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
    expect(resolveEffectiveTheme("system", false)).toBe("light");
  });
});

describe("theme preference DOM sync", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies theme values to document root", () => {
    applyThemeToDocument("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("reads stored theme preference and falls back to system", () => {
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, "dark");
    expect(readStoredThemePreference()).toBe("dark");

    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, "invalid");
    expect(readStoredThemePreference()).toBe("system");
  });

  it("uses matchMedia for system preference detection", () => {
    installMatchMedia(true);
    expect(getSystemPrefersDark()).toBe(true);
  });

  it("syncs data-theme and colorScheme, persisting selected preference", async () => {
    installMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("preference")).toHaveTextContent("system");
      expect(screen.getByTestId("effective")).toHaveTextContent("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    fireEvent.click(screen.getByRole("button", { name: "set-dark" }));

    await waitFor(() => {
      expect(screen.getByTestId("preference")).toHaveTextContent("dark");
      expect(screen.getByTestId("effective")).toHaveTextContent("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe("dark");
    });
  });

  it("reacts to system color scheme changes in system mode", async () => {
    const media = installMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("effective")).toHaveTextContent("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    media.setMatches(true);
    act(() => {
      media.dispatch();
    });

    await waitFor(() => {
      expect(screen.getByTestId("effective")).toHaveTextContent("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });
  });

  it("reacts to storage updates for cross-tab synchronization", async () => {
    installMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("preference")).toHaveTextContent("system");
    });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: THEME_PREFERENCE_STORAGE_KEY,
          newValue: "light",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("preference")).toHaveTextContent("light");
      expect(screen.getByTestId("effective")).toHaveTextContent("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });
});
