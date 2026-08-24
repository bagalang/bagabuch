"use client";

import { RequireAuth } from "../../components/RequireAuth";
import { CrudPage, CrudConfig } from "../../components/CrudPage";

const config: CrudConfig = {
  endpoint: "/v1/counterparts",
  titleKey: "counterparts.title",
  fields: [
    { name: "name", labelKey: "counterparts.name", type: "text", required: true },
    { name: "eik", labelKey: "counterparts.eik", type: "text" },
    { name: "vat_number", labelKey: "counterparts.vat_number", type: "text" },
    { name: "city", labelKey: "counterparts.city", type: "text" },
    { name: "country", labelKey: "counterparts.country", type: "text", default: "BG" },
    { name: "is_client", labelKey: "counterparts.is_client", type: "checkbox" },
    { name: "is_supplier", labelKey: "counterparts.is_supplier", type: "checkbox" },
  ],
  columns: ["name", "eik", "city", "is_client", "is_supplier"],
};

export default function CounterpartsPage() {
  return (
    <RequireAuth>
      <CrudPage config={config} />
    </RequireAuth>
  );
}
