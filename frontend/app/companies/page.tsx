"use client";

import { RequireAuth } from "../../components/RequireAuth";
import { CrudPage, CrudConfig } from "../../components/CrudPage";
import { setActiveCompany } from "../../lib/api";

const config: CrudConfig = {
  endpoint: "/v1/companies",
  titleKey: "companies.title",
  fields: [
    { name: "name", labelKey: "companies.name", type: "text", required: true },
    { name: "eik", labelKey: "companies.eik", type: "text", required: true },
    { name: "vat_number", labelKey: "companies.vat_number", type: "text" },
    { name: "address", labelKey: "companies.address", type: "text" },
    { name: "city", labelKey: "companies.city", type: "text" },
    { name: "mol", labelKey: "companies.mol", type: "text" },
    { name: "iban", labelKey: "companies.iban", type: "text" },
    { name: "bic", labelKey: "companies.bic", type: "text" },
  ],
  columns: ["name", "eik", "vat_number", "city"],
  rowAction: {
    labelKey: "companies.activate",
    onClick: (rec) => {
      const id = Number(rec.id);
      if (id > 0) void setActiveCompany(id);
    },
  },
};

export default function CompaniesPage() {
  return (
    <RequireAuth>
      <CrudPage config={config} />
    </RequireAuth>
  );
}
