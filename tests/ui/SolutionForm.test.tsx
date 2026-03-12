import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SolutionForm } from "@/components/run/SolutionForm";
import type { Challenge } from "@/lib/kairosRunTypes";

describe("SolutionForm", () => {
  it("renders shell challenge fields and submits with exit_code, stdout, stderr", async () => {
    const onSubmit = vi.fn();
    const challenge: Challenge = {
      type: "shell",
      shell: { cmd: "npm test" },
    };
    render(<SolutionForm challenge={challenge} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("run.shell.exitCode")).toBeInTheDocument();
    expect(screen.getByLabelText("run.shell.stdout")).toBeInTheDocument();
    expect(screen.getByLabelText("run.shell.stderr")).toBeInTheDocument();

    const exitInput = screen.getByRole("spinbutton", { name: "run.shell.exitCode" });
    await userEvent.clear(exitInput);
    await userEvent.type(exitInput, "0");
    await userEvent.type(screen.getByLabelText("run.shell.stdout"), "ok");
    fireEvent.submit(screen.getByRole("form", { name: "run.solutionFormLabel" }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "shell",
      shell: { exit_code: 0, stdout: "ok" },
    });
  });

  it("renders mcp challenge fields and submits with result", async () => {
    const onSubmit = vi.fn();
    const challenge: Challenge = {
      type: "mcp",
      mcp: { tool_name: "kairos_search" },
    };
    render(<SolutionForm challenge={challenge} onSubmit={onSubmit} />);
    expect(screen.getByText("kairos_search")).toBeInTheDocument();
    const resultArea = screen.getByLabelText("run.mcp.result");
    fireEvent.change(resultArea, { target: { value: '{"ok": true}' } });
    fireEvent.submit(screen.getByRole("form", { name: "run.solutionFormLabel" }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "mcp",
      mcp: {
        tool_name: "kairos_search",
        result: { ok: true },
        success: true,
      },
    });
  });

  it("renders user_input challenge fields and submits confirmation", async () => {
    const onSubmit = vi.fn();
    const challenge: Challenge = {
      type: "user_input",
      user_input: { prompt: "Proceed?" },
    };
    render(<SolutionForm challenge={challenge} onSubmit={onSubmit} />);
    expect(screen.getByText("Proceed?")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("run.userInput.confirmation"), "Yes");
    fireEvent.submit(screen.getByRole("form", { name: "run.solutionFormLabel" }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "user_input",
      user_input: expect.objectContaining({
        confirmation: "Yes",
      }),
    });
  });

  it("renders comment challenge and submit disabled until min length", async () => {
    const onSubmit = vi.fn();
    const challenge: Challenge = {
      type: "comment",
      comment: { min_length: 10 },
    };
    render(<SolutionForm challenge={challenge} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("run.comment.text")).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: "run.submitStep" });
    expect(submitBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText("run.comment.text"), "short");
    expect(submitBtn).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("run.comment.text"));
    await userEvent.type(screen.getByLabelText("run.comment.text"), "ten chars!!");
    expect(submitBtn).not.toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "run.solutionFormLabel" }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "comment",
      comment: { text: "ten chars!!" },
    });
  });

  it("submit button is disabled when disabled prop is true", () => {
    const challenge: Challenge = { type: "comment", comment: { min_length: 2 } };
    render(<SolutionForm challenge={challenge} onSubmit={vi.fn()} disabled />);
    const textarea = screen.getByLabelText("run.comment.text");
    fireEvent.change(textarea, { target: { value: "ab" } });
    expect(screen.getByRole("button", { name: "run.submitStep" })).toBeDisabled();
  });
});
