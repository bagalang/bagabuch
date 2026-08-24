"use client";

// AppShell — обвивка за автентикираните страници: странична навигация +
// горна лента (смяна на тема, език, изход).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useI18n } from "./I18nProvider";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";

const NAV_ITEMS = [
  { href: "/", key: "nav.dashboard" },
  { href: "/companies", key: "nav.companies" },
  { href: "/accounts", key: "nav.accounts" },
  { href: "/counterparts", key: "nav.counterparts" },
  { href: "/products", key: "nav.products" },
  { href: "/invoices", key: "nav.invoices" },
  { href: "/journal", key: "nav.journal" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">{t("app.name")}</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " nav-link-active" : ""}`}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div />
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setLang(lang === "bg" ? "en" : "bg")}
              title={lang === "bg" ? "English" : "Български"}
            >
              {lang === "bg" ? "EN" : "BG"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggleTheme}
              title={theme === "dark" ? "Light" : "Dark"}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              {t("nav.logout")}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
