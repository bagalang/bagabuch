"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ListResponse } from "../../lib/api";
import { Invoice, docTypesFor, formatBgDate } from "../../lib/invoice";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";

interface Counterpart {
  id: number;
  name: string;
}

function InvoicesInner() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dirFilter, setDirFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<ListResponse<Invoice>>("/v1/invoices");
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api
      .get<ListResponse<Counterpart>>("/v1/counterparts")
      .then((d) => setCounterparts(d.items ?? []))
      .catch(() => setCounterparts([]));
  }, [load]);

  const cpName = (inv: Invoice) =>
    inv.counterpart_name ||
    counterparts.find((c) => c.id === inv.counterpart_id)?.name ||
    String(inv.counterpart_id);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((inv) => {
      if (typeFilter && inv.document_type !== typeFilter) return false;
      if (dirFilter && inv.direction !== dirFilter) return false;
      if (!q) return true;
      const name = (
        inv.counterpart_name ||
        counterparts.find((c) => c.id === inv.counterpart_id)?.name ||
        ""
      ).toLowerCase();
      return inv.number.toLowerCase().includes(q) || name.includes(q);
    });
  }, [rows, search, typeFilter, dirFilter, counterparts]);

  const statusClass = (s: string) => {
    if (s === "posted" || s === "paid") return "badge-success";
    if (s === "cancelled") return "badge-danger";
    return "badge-warning";
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("invoices.title")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/scan">
            {t("invoices.scan")}
          </Link>
          <Link className="btn btn-primary" href="/invoices/new">
            {t("invoices.new")}
          </Link>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="field">
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("invoices.search")}
            />
          </div>
          <div className="field">
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">{t("invoices.all_types")}</option>
              {docTypesFor("out").map((dt) => (
                <option key={dt} value={dt}>
                  {dt === "proforma" ? "" : `${dt} — `}
                  {t(`invoices.document_type.${dt}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <select
              className="select"
              value={dirFilter}
              onChange={(e) => setDirFilter(e.target.value)}
            >
              <option value="">{t("invoices.all_directions")}</option>
              <option value="out">{t("invoices.direction.out")}</option>
              <option value="in">{t("invoices.direction.in")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="content muted">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="content muted">{t("common.empty")}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("invoices.document_type")}</th>
                <th>{t("invoices.number")}</th>
                <th>{t("invoices.issue_date")}</th>
                <th>{t("invoices.counterpart")}</th>
                <th>{t("invoices.total")}</th>
                <th>{t("invoices.status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`}>
                      {t(`invoices.document_type.${inv.document_type}`)}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
                  </td>
                  <td>{formatBgDate(inv.issue_date)}</td>
                  <td>{cpName(inv)}</td>
                  <td>
                    {inv.total_amount} {inv.currency}
                  </td>
                  <td>
                    <span className={`badge ${statusClass(inv.status)}`}>
                      {t(`invoices.status.${inv.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <RequireAuth>
      <InvoicesInner />
    </RequireAuth>
  );
}
