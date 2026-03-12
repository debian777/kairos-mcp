import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe("HomePage", () => {
  it("renders page title and search form", () => {
    renderHomePage();
    expect(screen.getByRole("heading", { name: "home.title", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("home.searchLabel")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "home.searchLabel" })).toBeInTheDocument();
  });

  it("search input has visible label and hint", () => {
    renderHomePage();
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("aria-describedby", "home-search-hint");
    expect(document.querySelector('label[for="home-search-query"]')).toBeInTheDocument();
  });

  it("renders stats row and CTA link to KAIROS", () => {
    renderHomePage();
    expect(screen.getByLabelText("home.statsLabel")).toBeInTheDocument();
    const kairosLink = screen.getByRole("link", { name: "nav.kairos" });
    expect(kairosLink).toHaveAttribute("href", "/kairos");
  });
});
