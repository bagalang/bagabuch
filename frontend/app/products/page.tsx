"use client";

import { RequireAuth } from "../../components/RequireAuth";
import { CrudPage, CrudConfig } from "../../components/CrudPage";

const config: CrudConfig = {
  endpoint: "/v1/products",
  titleKey: "products.title",
  fields: [
    { name: "name", labelKey: "products.name", type: "text", required: true },
    { name: "code", labelKey: "products.code", type: "text" },
    { name: "unit", labelKey: "products.unit", type: "text" },
    { name: "price", labelKey: "products.price", type: "number", default: "0" },
    { name: "vat_rate", labelKey: "products.vat_rate", type: "number", default: "20" },
    { name: "is_service", labelKey: "products.is_service", type: "checkbox" },
  ],
  columns: ["name", "code", "unit", "price", "vat_rate", "is_service"],
};

export default function ProductsPage() {
  return (
    <RequireAuth>
      <CrudPage config={config} />
    </RequireAuth>
  );
}
