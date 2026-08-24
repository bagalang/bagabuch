"use client";

import { RequireAuth } from "../../components/RequireAuth";
import { CrudPage, CrudConfig } from "../../components/CrudPage";

const config: CrudConfig = {
  endpoint: "/v1/accounts",
  titleKey: "accounts.title",
  fields: [
    { name: "number", labelKey: "accounts.number", type: "text", required: true },
    { name: "name", labelKey: "accounts.name", type: "text", required: true },
    { name: "saft_account_type", labelKey: "accounts.saft_account_type", type: "text" },
    {
      name: "analytic_type",
      labelKey: "accounts.analytic_type",
      type: "select",
      default: "none",
      options: [
        { value: "none", labelKey: "accounts.analytic.none" },
        { value: "counterpart", labelKey: "accounts.analytic.counterpart" },
        { value: "product", labelKey: "accounts.analytic.product" },
      ],
    },
  ],
  columns: ["number", "name", "saft_account_type", "analytic_type"],
};

export default function AccountsPage() {
  return (
    <RequireAuth>
      <CrudPage config={config} />
    </RequireAuth>
  );
}
