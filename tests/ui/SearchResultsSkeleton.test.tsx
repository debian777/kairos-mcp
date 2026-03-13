import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SearchResultsSkeleton } from "@/components/SearchResultsSkeleton";

describe("SearchResultsSkeleton", () => {
  it("renders list with role list and aria-hidden", () => {
    render(<SearchResultsSkeleton />);
    const list = screen.getByRole("list", { hidden: true });
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-hidden", "true");
  });

  it("renders 3 skeleton items", () => {
    const { container } = render(<SearchResultsSkeleton />);
    const items = container.querySelectorAll("ul > li");
    expect(items).toHaveLength(3);
  });
});
