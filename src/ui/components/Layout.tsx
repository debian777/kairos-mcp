import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const path = location.pathname;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `min-h-[44px] flex items-center px-4 py-3 text-[var(--color-text)] no-underline border-l-[3px] border-transparent outline-offset-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-heading)] ${
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
