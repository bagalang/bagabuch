"use client";

// Табло — начална страница след вход.

import { RequireAuth } from "../components/RequireAuth";
import { useI18n } from "../components/I18nProvider";

export default function DashboardPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <h1 className="page-title">{t("dashboard.title")}</h1>
      <div className="card content">{t("dashboard.welcome")}</div>
    </RequireAuth>
  );
}
