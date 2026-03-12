import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ErrorAlert } from "@/components/ErrorAlert";

function renderErrorAlert(props: Parameters<typeof ErrorAlert>[0]) {
  return render(
    <MemoryRouter>
      <ErrorAlert {...props} />
    </MemoryRouter>
  );
}

describe("ErrorAlert", () => {
  it("renders message and has role alert", () => {
    renderErrorAlert({ message: "Something failed." });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something failed.")).toBeInTheDocument();
  });

  it("renders nextAction when provided", () => {
    renderErrorAlert({
      message: "Failed",
      nextAction: "Retry the request.",
    });
    expect(screen.getByText("Retry the request.")).toBeInTheDocument();
  });

  it("shows Retry button when onRetry provided", async () => {
    const onRetry = vi.fn();
    renderErrorAlert({ message: "Err", onRetry });
    const retry = screen.getByRole("button", { name: "error.retry" });
    expect(retry).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows Go to Home link when showGoBack is true", () => {
    renderErrorAlert({ message: "Err", showGoBack: true });
    const goBack = screen.getByRole("link", { name: "error.goBack" });
    expect(goBack).toBeInTheDocument();
    expect(goBack).toHaveAttribute("href", "/");
  });

  it("does not show Go to Home when showGoBack is false", () => {
    renderErrorAlert({ message: "Err", showGoBack: false });
    expect(screen.queryByRole("link", { name: "error.goBack" })).not.toBeInTheDocument();
  });
});
