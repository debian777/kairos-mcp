import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunGuidedContent } from "@/components/run/RunGuidedContent";
import type { RunSession } from "@/hooks/useRunSession";

const baseRun: RunSession = {
  id: "run-1",
  protocol_uri: "kairos://protocol/foo",
  started_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  status: "running",
  current_step: { uri: "kairos://mem/step-1", content: "Step content", mimeType: "text/plain" },
  challenge: { type: "comment", comment: { min_length: 5 } },
  history: [],
};

const defaultProps = {
  attestOutcome: "success" as const,
  setAttestOutcome: vi.fn(),
  attestMessage: "",
  setAttestMessage: vi.fn(),
  copyStatus: null as string | null,
  onCopy: vi.fn(),
  onSubmitStep: vi.fn(),
  onAttest: vi.fn(),
  isNextPending: false,
  isBeginPending: false,
  isAttestPending: false,
};

describe("RunGuidedContent", () => {
  it("running state shows step, challenge, and solution form", () => {
    render(<RunGuidedContent {...defaultProps} run={baseRun} />);
    expect(screen.getByRole("heading", { name: "run.currentStep" })).toBeInTheDocument();
    expect(screen.getByText("kairos://mem/step-1")).toBeInTheDocument();
    expect(screen.getByText("Step content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "run.challenge" })).toBeInTheDocument();
    expect(screen.getByText("comment")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "run.solutionFormLabel" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "run.attest.outcomeLabel" })).not.toBeInTheDocument();
  });

  it("ready_to_attest state shows attest form and no solution form", () => {
    const run: RunSession = {
      ...baseRun,
      status: "ready_to_attest",
    };
    render(<RunGuidedContent {...defaultProps} run={run} />);
    expect(screen.getByRole("heading", { name: "run.attest.title" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "run.attest.outcomeLabel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "run.attest.submit" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "run.solutionFormLabel" })).not.toBeInTheDocument();
  });

  it("completed state shows success banner", () => {
    const run: RunSession = {
      ...baseRun,
      status: "completed",
      last_message: "Done.",
    };
    render(<RunGuidedContent {...defaultProps} run={run} />);
    expect(screen.getByText("run.completed")).toBeInTheDocument();
    expect(screen.getAllByText("Done.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders history when run has history items", () => {
    const run: RunSession = {
      ...baseRun,
      history: [
        {
          step: { uri: "kairos://mem/step-0", content: "", mimeType: "text/plain" },
          challenge: { type: "comment" },
          solution: { type: "comment", comment: { text: "done" } },
          submitted_at: "2024-01-01T00:01:00.000Z",
          server_message: "OK",
        },
      ],
    };
    render(<RunGuidedContent {...defaultProps} run={run} />);
    expect(screen.getByRole("heading", { name: "run.history" })).toBeInTheDocument();
    expect(screen.getByLabelText("run.historyLabel")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("attest outcome change calls setAttestOutcome", () => {
    const setAttestOutcome = vi.fn();
    const run: RunSession = { ...baseRun, status: "ready_to_attest" };
    render(
      <RunGuidedContent
        {...defaultProps}
        run={run}
        setAttestOutcome={setAttestOutcome}
      />
    );
    const failureRadio = screen.getByRole("radio", { name: "run.attest.failure" });
    fireEvent.click(failureRadio);
    expect(setAttestOutcome).toHaveBeenCalledWith("failure");
  });

  it("attest submit button calls onAttest", () => {
    const onAttest = vi.fn();
    const run: RunSession = { ...baseRun, status: "ready_to_attest" };
    render(<RunGuidedContent {...defaultProps} run={run} onAttest={onAttest} />);
    fireEvent.click(screen.getByRole("button", { name: "run.attest.submit" }));
    expect(onAttest).toHaveBeenCalled();
  });
});
