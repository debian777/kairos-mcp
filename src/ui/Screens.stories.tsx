import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppRoutes } from "@/App";

/**
 * **1:1 mockups.** Each story renders the same Layout + page as the live app at the given route.
 * Use these as the design surface; changes here are the implementation.
 *
 * Seed API data via `parameters.queryData` (React Query cache) when a page needs it.
 * Layout shows "Kairos" / "MCP" branding; Home shows space protocol counts; Detail/Edit show Download and Upload.
 */
const meta: Meta<typeof AppRoutes> = {
  title: "Screens",
  component: AppRoutes,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof AppRoutes>;

const mockSpaces = [
  { name: "Personal", chain_count: 3 },
  { name: "Kairos app", chain_count: 12 },
];

/** Home — overview, search form, space protocol counts, CTA to KAIROS (mockup 01). */
export const Home: Story = {
  parameters: {
    initialEntry: "/",
    queryData: [[["spaces"], { spaces: mockSpaces }]],
  },
};

/** Home — loading spaces (no cache). */
export const HomeLoadingSpaces: Story = {
  parameters: { initialEntry: "/" },
};

/** KAIROS — search and results (mockup 07). Empty state until a query is run. */
export const Kairos: Story = {
  parameters: { initialEntry: "/kairos" },
};

/** KAIROS with results — seeded search response. */
export const KairosWithResults: Story = {
  parameters: {
    initialEntry: "/kairos?q=deploy",
    queryData: [
      [
        ["search", "deploy"],
        {
          choices: [
            {
              uri: "kairos://mem/abc123",
              label: "Deploy and test workflow",
              chain_label: "Build → test → deploy",
              score: 0.87,
              role: "match",
              tags: [],
              next_action: "forward",
            },
            {
              uri: "kairos://mem/refine-1",
              label: "Get step-by-step help improving your search",
              chain_label: "Refine query",
              score: null,
              role: "refine",
              tags: [],
              next_action: "forward",
            },
            {
              uri: "kairos://mem/create-1",
              label: "Create a new protocol",
              chain_label: "Start from scratch",
              score: null,
              role: "create",
              tags: [],
              next_action: "forward",
            },
          ],
        },
      ],
    ],
  },
};

/** Account — identity card, sign-out (mockup 05). Signed-in state. */
export const Account: Story = {
  parameters: {
    initialEntry: "/account",
    queryData: [
      [
        ["me"],
        { sub: "user-1", name: "Jane Smith", email: "jane.smith@example.com" },
      ],
    ],
  },
};

/** Account — loading (no cache). */
export const AccountLoading: Story = {
  parameters: { initialEntry: "/account" },
};

/** Protocol detail — title, URI, steps, Edit/Duplicate (mockup 03). */
const mockMarkdown = `# Deploy and test workflow

## Natural Language Triggers

deploy and test, run tests and deploy

## Build

Run build.

\`\`\`json
{"challenge": {"type": "shell"}}
\`\`\`

## Run tests

Run tests.

\`\`\`json
{"challenge": {"type": "shell"}}
\`\`\`

## Deploy

Deploy step.

\`\`\`json
{"challenge": {"type": "shell"}}
\`\`\`

## Completion Rule

Complete when all steps pass.
`;

export const ProtocolDetail: Story = {
  parameters: {
    initialEntry: "/protocols/kairos%3A%2F%2Fmem%2Fabc123",
    queryData: [
      [
        ["protocol", "kairos://mem/abc123"],
        {
          uri: "kairos://mem/abc123",
          label: "Deploy and test workflow",
          chain_label: "Build → test → deploy",
          step_count: 4,
          markdown_doc: mockMarkdown,
        },
      ],
    ],
  },
};

/** Protocol edit — new protocol (mockup 06). */
export const ProtocolEditNew: Story = {
  parameters: { initialEntry: "/protocols/new" },
};

/** Not found (404). */
export const NotFound: Story = {
  parameters: { initialEntry: "/unknown" },
};
