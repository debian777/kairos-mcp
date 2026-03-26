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
  { name: "Personal", adapter_count: 3 },
  { name: "Kairos app", adapter_count: 12 },
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

/** KAIROS with results — seeded activate response. */
export const KairosWithResults: Story = {
  parameters: {
    initialEntry: "/kairos?q=deploy",
    queryData: [
      [
        ["activate", "deploy"],
        {
          must_obey: true,
          message: "Pick one choice and follow that choice's next_action.",
          next_action: "Pick one choice and follow that choice's next_action.",
          choices: [
            {
              uri: "kairos://adapter/11111111-1111-1111-1111-111111111111",
              label: "Deploy and test workflow",
              adapter_name: "Build → test → deploy",
              activation_score: 0.87,
              role: "match",
              tags: [],
              next_action: "call forward with kairos://adapter/11111111-1111-1111-1111-111111111111 to execute this adapter",
              adapter_version: "1.0.0",
              activation_patterns: [],
            },
            {
              uri: "kairos://adapter/22222222-2222-2222-2222-222222222222",
              label: "Get step-by-step help improving your activation query",
              adapter_name: "Refine query",
              activation_score: null,
              role: "refine",
              tags: [],
              next_action: "call forward with kairos://adapter/22222222-2222-2222-2222-222222222222 to execute the refine adapter",
              adapter_version: null,
              activation_patterns: [],
            },
            {
              uri: "kairos://adapter/33333333-3333-3333-3333-333333333333",
              label: "Create a new protocol",
              adapter_name: "Start from scratch",
              activation_score: null,
              role: "create",
              tags: [],
              next_action: "call train with adapter markdown to register a new adapter",
              adapter_version: null,
              activation_patterns: [],
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
{"contract": {"type": "shell"}}
\`\`\`

## Run tests

Run tests.

\`\`\`json
{"contract": {"type": "shell"}}
\`\`\`

## Deploy

Deploy step.

\`\`\`json
{"contract": {"type": "shell"}}
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
          adapter_name: "Build → test → deploy",
          layer_count: 4,
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
