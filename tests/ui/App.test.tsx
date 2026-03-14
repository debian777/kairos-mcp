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
  it("renders layout with main content at /", async () => {
    renderApp("/");
    expect(screen.getByRole("main")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "home.title" });
  });

  it("shows Home at /", async () => {
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "home.title" })).toBeInTheDocument();
  });

  it("shows Account page at /account", async () => {
    renderApp("/account");
    // AccountPage shows loading until useMe resolves; we only assert we're on account route
    expect(await screen.findByText("account.loading")).toBeInTheDocument();
  });

  it("shows Not found at unknown path", async () => {
    renderApp("/unknown");
    expect(await screen.findByRole("heading", { name: "notFound.title" })).toBeInTheDocument();
  });
});
