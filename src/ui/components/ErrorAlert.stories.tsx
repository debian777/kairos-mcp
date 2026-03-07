import type { Meta, StoryObj } from "@storybook/react";
import { ErrorAlert } from "./ErrorAlert";

const meta: Meta<typeof ErrorAlert> = {
  title: "Components/ErrorAlert",
  component: ErrorAlert,
};

export default meta;

type Story = StoryObj<typeof ErrorAlert>;

/** Default: message, retry, go back (mockup 04). */
export const Default: Story = {
  args: {
    message: "Search failed. The server may be unavailable.",
    onRetry: () => {},
    showGoBack: true,
  },
};

/** With next_action from API. */
export const WithNextAction: Story = {
  args: {
    message: "Nonce mismatch. Please use the challenge from the last response.",
    nextAction: "Retry kairos_next with the fresh challenge below.",
    onRetry: () => {},
    showGoBack: true,
  },
};

/** Retry only, no go back. */
export const RetryOnly: Story = {
  args: {
    message: "Connection lost.",
    onRetry: () => {},
    showGoBack: false,
  },
};
