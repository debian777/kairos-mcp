import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { NotFoundPage } from "@/pages/NotFoundPage";

describe("NotFoundPage", () => {
  it("renders heading and ErrorAlert with go-back link", () => {
    renderWithProviders(<NotFoundPage />);
    expect(screen.getByRole("heading", { name: "notFound.title", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("notFound.message")).toBeInTheDocument();
    const goBack = screen.getByRole("link", { name: "error.goBack" });
    expect(goBack).toBeInTheDocument();
    expect(goBack).toHaveAttribute("href", "/");
  });
});
