"use client";

import { useParams } from "next/navigation";
import { InvoiceForm } from "../../../../components/InvoiceForm";
import { RequireAuth } from "../../../../components/RequireAuth";
import { useI18n } from "../../../../components/I18nProvider";

function EditInner() {
  const { t } = useI18n();
  const params = useParams();
  const id = Number(params.id);
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("invoices.edit")}</h1>
      </div>
      <InvoiceForm mode="edit" invoiceId={id} />
    </div>
  );
}

export default function EditInvoicePage() {
  return (
    <RequireAuth>
      <EditInner />
    </RequireAuth>
  );
}
