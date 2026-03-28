import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import {
  BrowseTargetContent,
  EditorToolbarIconSetTargetContent,
  HomeTargetContent,
  ProtocolDetailTargetContent,
  ProtocolEditTargetContent,
  RunGuidedTargetContent,
  RunsTargetContent,
  SkillBundleTargetContent,
} from "@/mockups/ProtocolUXMockupContent";

/**
 * **Protocol UX (Target) mockups.** Design reference for the next implementation phase.
 * These stories show the intended UI: browse-by-letter discovery (A–Z blocks), rendered rich-text editing
 * with a real embedded Tiptap editor, explicit export actions, skill bundle preparation, and the
 * restored Test Run surfaces.
 *
 * Run `npm run storybook` to view.
 */

function MockupWrapper({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route path="*" element={<Layout />}>
        <Route path="*" element={children} />
      </Route>
    </Routes>
  );
}

const meta: Meta<typeof MockupWrapper> = {
  title: "Mockups / Protocol UX (Target)",
  component: MockupWrapper,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof MockupWrapper>;

/** Home — lightweight orientation page with direct paths to browse, create, and testing. */
export const HomeTarget: Story = {
  parameters: { initialEntry: "/" },
  render: () => (
    <MockupWrapper>
      <HomeTargetContent />
    </MockupWrapper>
  ),
};

/** Browse — simple search plus browse-by-label default. */
export const BrowseTarget: Story = {
  parameters: { initialEntry: "/kairos" },
  render: () => (
    <MockupWrapper>
      <BrowseTargetContent />
    </MockupWrapper>
  ),
};

/** Protocol detail — target design: step flow graph, challenge cards, rendered-looking content. */
export const ProtocolDetailTarget: Story = {
  parameters: { initialEntry: "/protocols/kairos%3A%2F%2Fmem%2Fmock" },
  render: () => (
    <MockupWrapper>
      <ProtocolDetailTargetContent />
    </MockupWrapper>
  ),
};

/** Protocol edit — target design: rendered editor, step builder, and Markdown-safe formatting only. */
export const ProtocolEditTarget: Story = {
  parameters: { initialEntry: "/protocols/new" },
  render: () => (
    <MockupWrapper>
      <ProtocolEditTargetContent />
    </MockupWrapper>
  ),
};

/** Editor icon set — review the proposed toolbar iconography in isolation. */
export const EditorIconSetTarget: Story = {
  parameters: { initialEntry: "/" },
  render: () => (
    <MockupWrapper>
      <EditorToolbarIconSetTargetContent />
    </MockupWrapper>
  ),
};

/** Edit as skill — target design: bundle review and zip preparation before download. */
export const SkillBundleTarget: Story = {
  parameters: { initialEntry: "/protocols/kairos%3A%2F%2Fmem%2Fmock/skill" },
  render: () => (
    <MockupWrapper>
      <SkillBundleTargetContent />
    </MockupWrapper>
  ),
};

/** Test Run list — restored Runs-style page with saved sessions. */
export const TestRunListTarget: Story = {
  parameters: { initialEntry: "/runs" },
  render: () => (
    <MockupWrapper>
      <RunsTargetContent />
    </MockupWrapper>
  ),
};

/** Test Run — restored guided run flow with relabeled copy only. */
export const TestRunTarget: Story = {
  parameters: { initialEntry: "/protocols/kairos%3A%2F%2Fmem%2Fmock/run" },
  render: () => (
    <MockupWrapper>
      <RunGuidedTargetContent />
    </MockupWrapper>
  ),
};
