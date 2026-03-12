import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "@/pages/NotFoundPage";

describe("NotFoundPage", () => {
  it("renders heading and ErrorAlert with go-back link", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "notFound.title", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("notFound.message")).toBeInTheDocument();
    const goBack = screen.getByRole("link", { name: "error.goBack" });
    expect(goBack).toBeInTheDocument();
    expect(goBack).toHaveAttribute("href", "/");
  });
});
