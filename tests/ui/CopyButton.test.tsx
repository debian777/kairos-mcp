import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CopyButton } from "@/components/CopyButton";

describe("CopyButton", () => {
  beforeEach(() => {
    const writeText = navigator.clipboard?.writeText as { mockClear?: () => void };
    if (writeText?.mockClear) writeText.mockClear();
  });

  it("renders with label and calls clipboard.writeText on click", async () => {
    const value = "https://example.com/uri";
    render(<CopyButton value={value} label="Copy URI" />);
    const button = screen.getByRole("button", { name: "Copy URI" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Copy URI");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
  });

  it("shows copied state after click", async () => {
    render(<CopyButton value="x" label="Copy" />);
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button).toHaveTextContent("run.copy");

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveTextContent("run.copied");
    });
    expect(screen.getByRole("button", { name: "run.copied" })).toBeInTheDocument();
  });

});
