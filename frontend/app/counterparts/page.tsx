"use client";

import { RequireAuth } from "../../components/RequireAuth";
import { CrudPage, CrudConfig } from "../../components/CrudPage";

const config: CrudConfig = {
  endpoint: "/v1/counterparts",
  titleKey: "counterparts.title",
  vies: {
    endpoint: "/v1/counterparts/vies-lookup",
    vatField: "vat_number",
    eikField: "eik",
    map: {
      name: "name",
      address: "address",
      vies_address: "vies_address",
      country_code: "country",
    },
    labelKey: "counterparts.vies.fetch",
    loadingKey: "counterparts.vies.fetching",
    invalidKey: "counterparts.vies.invalid",
    filledKey: "counterparts.vies.filled",
  },
  fields: [
    { name: "name", labelKey: "counterparts.name", type: "text", required: true },
    {
      name: "counterpart_type",
      labelKey: "counterparts.type",
      type: "select",
      default: "both",
      options: [
        { value: "customer", labelKey: "counterparts.type.customer" },
        { value: "supplier", labelKey: "counterparts.type.supplier" },
        { value: "both", labelKey: "counterparts.type.both" },
      ],
    },
    { name: "eik", labelKey: "counterparts.eik", type: "text" },
    { name: "vat_number", labelKey: "counterparts.vat_number", type: "text" },
    { name: "address", labelKey: "counterparts.address", type: "text" },
    { name: "vies_address", labelKey: "counterparts.vies_address", type: "textarea" },
    { name: "city", labelKey: "counterparts.city", type: "text" },
    { name: "country", labelKey: "counterparts.country", type: "text", default: "BG" },
    { name: "post_code", labelKey: "counterparts.post_code", type: "text" },
    { name: "contact_person", labelKey: "counterparts.contact_person", type: "text" },
    { name: "email", labelKey: "counterparts.email", type: "text" },
    { name: "phone", labelKey: "counterparts.phone", type: "text" },
  ],
  columns: ["name", "counterpart_type", "eik", "city"],
};

export default function CounterpartsPage() {
  return (
    <RequireAuth>
      <CrudPage config={config} />
    </RequireAuth>
  );
}
