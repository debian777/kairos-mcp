import type { Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "../src/ui/i18n";
import "../src/ui/index.css";

/** Optional: [queryKey, data][] to seed React Query cache for this story. */
type QueryDataEntry = [string[], unknown];

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const queryData = context.parameters.queryData as QueryDataEntry[] | undefined;
      queryData?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      const initialEntry = (context.parameters.initialEntry as string) ?? "/";
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]} initialIndex={0}>
            <Story />
          </MemoryRouter>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    layout: "fullscreen",
  },
};

export default preview;
