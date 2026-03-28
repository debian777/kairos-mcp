import type { Preview } from "@storybook/react-vite";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "../src/ui/i18n";
import "../src/ui/index.css";
import {
  applyThemeToDocument,
  isThemePreference,
  ThemeProvider,
  type ThemePreference,
  resolveEffectiveTheme,
} from "../src/ui/hooks/useThemePreference";

/** Optional: [queryKey, data][] to seed React Query cache for this story. */
type QueryDataEntry = [string[], unknown];

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Theme",
      description: "UI theme preference",
      defaultValue: "light",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const globalTheme = context.globals.theme;
      const preference: ThemePreference =
        typeof globalTheme === "string" && isThemePreference(globalTheme) ? globalTheme : "light";
      const effectiveTheme = resolveEffectiveTheme(preference, false);
      applyThemeToDocument(effectiveTheme);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnMount: false,
            staleTime: Number.POSITIVE_INFINITY,
          },
        },
      });
      const queryData = context.parameters.queryData as QueryDataEntry[] | undefined;
      queryData?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      const initialEntry = (context.parameters.initialEntry as string) ?? "/";
      return (
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <MemoryRouter basename="/ui" initialEntries={[initialEntry]} initialIndex={0}>
                <Story />
              </MemoryRouter>
            </ThemeProvider>
          </QueryClientProvider>
        </StrictMode>
      );
    },
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    layout: "fullscreen",
    // Viewport presets for responsive testing (addon-viewport removed in SB 10; params kept for future built-in support).
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile (375)",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        tablet: {
          name: "Tablet (768)",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
        desktop: {
          name: "Desktop (1280)",
          styles: { width: "1280px", height: "800px" },
          type: "desktop",
        },
        wide: {
          name: "Wide (1920)",
          styles: { width: "1920px", height: "1080px" },
          type: "desktop",
        },
      },
      defaultViewport: "desktop",
    },
  },
};

export default preview;
