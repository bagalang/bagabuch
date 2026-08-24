"use client";

// Фактури — списък + създаване с редове (автоматични суми) + публикуване.

import { useCallback, useEffect, useState, FormEvent } from "react";
import { api, ListResponse } from "../../lib/api";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";

interface Invoice {
  id: number;
  direction: string;
  number: string;
  issue_date: string;
  accounting_month: string;
  counterpart_id: number;
  net_amount: string;
  vat_amount: string;
  total_amount: string;
  status: string;
}

interface Counterpart {
  id: number;
  name: string;
}

interface LineDraft {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function lineAmounts(l: LineDraft) {
  const q = parseFloat(l.quantity) || 0;
  const p = parseFloat(l.unit_price) || 0;
  const r = parseFloat(l.vat_rate) || 0;
  const net = q * p;
  const vat = (net * r) / 100;
  return { net, vat, total: net + vat };
}

function InvoicesInner() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [direction, setDirection] = useState("out");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [accountingMonth, setAccountingMonth] = useState("");
  const [counterpartId, setCounterpartId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { description: "", quantity: "1", unit_price: "0", vat_rate: "20" },
  ]);

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

  const loadCounterparts = useCallback(async () => {
    try {
      const data = await api.get<ListResponse<Counterpart>>("/v1/counterparts");
      setCounterparts(data.items ?? []);
    } catch {
      /* игнор — падащото меню ще е празно */
    }
  }, []);

  // Зареждане при монтиране (данните зависят от автентикацията, четат се от
  // клиента; сетСтейт е асинхронен след await, не синхронен каскаден рендер).
  useEffect(() => {
    load();
    loadCounterparts();
  }, [load, loadCounterparts]);

  const openCreate = () => {
    setDirection("out");
    setNumber("");
    setIssueDate("");
    setAccountingMonth("");
    setCounterpartId("");
    setLines([{ description: "", quantity: "1", unit_price: "0", vat_rate: "20" }]);
    setFormError("");
    setModalOpen(true);
  };

  const setLine = (i: number, field: keyof LineDraft, value: string) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const addLine = () =>
    setLines((prev) => [...prev, { description: "", quantity: "1", unit_price: "0", vat_rate: "20" }]);

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const totals = lines.reduce(
    (acc, l) => {
      const a = lineAmounts(l);
      return { net: acc.net + a.net, vat: acc.vat + a.vat, total: acc.total + a.total };
    },
    { net: 0, vat: 0, total: 0 }
  );

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        direction,
        number,
        issue_date: issueDate,
        accounting_month: accountingMonth,
        counterpart_id: Number(counterpartId),
        lines: lines.map((l) => {
          const a = lineAmounts(l);
          return {
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            net_amount: round2(a.net),
            vat_rate: l.vat_rate,
            vat_amount: round2(a.vat),
            total_amount: round2(a.total),
          };
        }),
      };
      await api.post("/v1/invoices", payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (inv: Invoice) => {
    try {
      await api.post(`/v1/invoices/${inv.id}/post`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`/v1/invoices/${inv.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const cpName = (id: number) =>
    counterparts.find((c) => c.id === id)?.name ?? String(id);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("invoices.title")}</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          {t("common.create")}
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="content muted">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="content muted">{t("common.empty")}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("invoices.number")}</th>
                <th>{t("invoices.direction")}</th>
                <th>{t("invoices.issue_date")}</th>
                <th>{t("invoices.counterpart")}</th>
                <th>{t("invoices.total")}</th>
                <th>{t("invoices.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number}</td>
                  <td>{t(`invoices.direction.${inv.direction}`)}</td>
                  <td>{inv.issue_date}</td>
                  <td>{cpName(inv.counterpart_id)}</td>
                  <td>{inv.total_amount}</td>
                  <td>
                    <span
                      className={`badge ${
                        inv.status === "posted" ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {t(`invoices.status.${inv.status}`)}
                    </span>
                  </td>
                  <td>
                    {inv.status !== "posted" && (
                      <button className="btn btn-sm" onClick={() => handlePost(inv)}>
                        {t("invoices.post")}
                      </button>
                    )}{" "}
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(inv)}
                    >
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t("common.create")}</h2>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="field">
                  <label className="label">{t("invoices.direction")}</label>
                  <select
                    className="select"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="out">{t("invoices.direction.out")}</option>
                    <option value="in">{t("invoices.direction.in")}</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t("invoices.number")} *</label>
                  <input
                    className="input"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">{t("invoices.issue_date")}</label>
                  <input
                    className="input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    placeholder="2026-08-01"
                  />
                </div>
                <div className="field">
                  <label className="label">
                    {t("invoices.counterpart")}
                  </label>
                  <select
                    className="select"
                    value={counterpartId}
                    onChange={(e) => setCounterpartId(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {counterparts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <h3>{t("invoices.title")}</h3>
              {lines.map((l, i) => {
                const a = lineAmounts(l);
                return (
                  <div className="form-grid" key={i}>
                    <div className="field">
                      <label className="label">{t("journal.description")}</label>
                      <input
                        className="input"
                        value={l.description}
                        onChange={(e) => setLine(i, "description", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="label">
                        {t("products.unit")} / {t("products.price")} / ДДС%
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          className="input"
                          value={l.quantity}
                          onChange={(e) => setLine(i, "quantity", e.target.value)}
                          style={{ width: 70 }}
                        />
                        <input
                          className="input"
                          value={l.unit_price}
                          onChange={(e) => setLine(i, "unit_price", e.target.value)}
                        />
                        <input
                          className="input"
                          value={l.vat_rate}
                          onChange={(e) => setLine(i, "vat_rate", e.target.value)}
                          style={{ width: 70 }}
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeLine(i)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {round2(a.net)} + {round2(a.vat)} = {round2(a.total)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn btn-sm" onClick={addLine}>
                + {t("common.create")}
              </button>

              <div className="muted" style={{ marginTop: 12 }}>
                {t("invoices.total")}: {round2(totals.total)}
              </div>

              {formError && <div className="error-text">{formError}</div>}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModalOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button className="btn btn-primary" disabled={saving}>
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
