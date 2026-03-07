import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "@/App";

function renderApp(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]} initialIndex={0}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("App", () => {
  it("renders layout with main content at /", () => {
    renderApp("/");
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows Home at /", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { name: "home.title" })).toBeInTheDocument();
  });

  it("shows Account page at /account", () => {
    renderApp("/account");
    // AccountPage shows loading until useMe resolves; we only assert we're on account route
    expect(screen.getByText("account.loading")).toBeInTheDocument();
  });

  it("shows Not found at unknown path", () => {
    renderApp("/unknown");
    expect(screen.getByRole("heading", { name: "notFound.title" })).toBeInTheDocument();
  });
});
