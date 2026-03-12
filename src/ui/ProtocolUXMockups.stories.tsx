import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import {
  ProtocolDetailTargetContent,
  ProtocolEditTargetContent,
  RunGuidedTargetContent,
} from "@/mockups/ProtocolUXMockupContent";

/**
 * **Protocol UX (Target) mockups.** Design reference for the next implementation phase.
 * These stories show the intended UI: step flow graph, challenge cards, Markdown-rendered
 * content, and editor layout. They are presentational only (no real Markdown renderer or editor).
 *
 * Run `npm run storybook` to view; `npm run storybook:export-mockups` to refresh static export.
 */

function MockupWrapper({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={children} />
      </Route>
    </Routes>
  );
}

const meta: Meta<typeof MockupWrapper> = {
  title: "Mockups / Protocol UX (Target)",
  component: MockupWrapper,
  parameters: { layout: "fullscreen", initialEntry: "/" },
};

export default meta;

type Story = StoryObj<typeof MockupWrapper>;

/** Protocol detail — target design: step flow graph, challenge cards, rendered-looking content. */
export const ProtocolDetailTarget: Story = {
  render: () => (
    <MockupWrapper>
      <ProtocolDetailTargetContent />
    </MockupWrapper>
  ),
};

/** Protocol edit — target design: editor area with toolbar + preview panel. */
export const ProtocolEditTarget: Story = {
  render: () => (
    <MockupWrapper>
      <ProtocolEditTargetContent />
    </MockupWrapper>
  ),
};

/** Run guided — target design: step progress, flow with current highlighted, challenge card, solution form. */
export const RunGuidedTarget: Story = {
  render: () => (
    <MockupWrapper>
      <RunGuidedTargetContent />
    </MockupWrapper>
  ),
};
