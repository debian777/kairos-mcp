import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import logoSvg from "../../../logo/kaiiros-mcp.svg";

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const path = location.pathname;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `min-h-[44px] flex items-center px-4 py-3 text-[var(--color-text)] no-underline border-l-[3px] border-transparent outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-heading)] ${
      isActive
        ? "font-semibold text-[var(--color-primary)] border-l-[var(--color-primary)] bg-[var(--color-surface)]"
        : ""
    }`;

  return (
    <>
      <a href="#main" className="skip-link">
        {t("skipToMain")}
      </a>
      <div className="flex min-h-screen">
        <aside
          className="w-48 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-4"
          aria-label="Main navigation"
        >
          <div className="px-4 pb-4">
            <NavLink
              to="/"
              end
              className="flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <img
                src={logoSvg}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-lg object-contain"
                width="40"
                height="40"
              />
              <span className="flex flex-col leading-tight">
                <span className="font-bold text-[var(--color-text-heading)] text-lg">Kairos</span>
                <span className="font-bold text-[var(--color-text-muted)] text-xs uppercase tracking-wide">MCP</span>
              </span>
            </NavLink>
          </div>
          <nav className="flex flex-col gap-0.5">
            <NavLink to="/" end aria-current={path === "/" ? "page" : undefined} className={navLinkClass}>
              {t("nav.home")}
            </NavLink>
            <NavLink
              to="/kairos"
              aria-current={path === "/kairos" ? "page" : undefined}
              className={navLinkClass}
            >
              {t("nav.kairos")}
            </NavLink>
            <NavLink
              to="/protocols/new"
              aria-current={path === "/protocols/new" ? "page" : undefined}
              className={navLinkClass}
            >
              {t("nav.create")}
            </NavLink>
            <NavLink
              to="/runs"
              aria-current={path === "/runs" ? "page" : undefined}
              className={navLinkClass}
            >
              {t("nav.runs")}
            </NavLink>
            <NavLink
              to="/account"
              aria-current={path === "/account" ? "page" : undefined}
              className={navLinkClass}
            >
              {t("nav.account")}
            </NavLink>
          </nav>
        </aside>
        <main
          id="main"
          className="flex-1 max-w-[48rem] mx-auto w-full px-6 py-6"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </>
  );
}
