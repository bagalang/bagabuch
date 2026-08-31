"use client";

// Банкови транзакции: импорт от файл (преглед + дубликати), ръчно
// осчетоводяване, разнасяне от буферна сметка, изтриване. Порт на
// secret/su-doxis bank_transactions.rs върху bagabuch REST API.

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "../../components/RequireAuth";
import { useI18n } from "../../components/I18nProvider";
import { api, ListResponse } from "../../lib/api";

interface BankAccount {
  id: number;
  name: string;
  iban: string;
  currency: string;
}

interface Account {
  id: number;
  number: string;
  name: string;
}

interface ParsedTx {
  date: string;
  amount: string;
  currency: string;
  description: string;
  contra_name: string;
  contra_iban: string;
  reference: string;
  is_duplicate: boolean;
}

interface Preview {
  format_name: string;
  account_iban: string;
  account_currency: string;
  transactions: ParsedTx[];
  total_count: number;
  duplicate_count: number;
  new_count: number;
}

interface BankTransaction {
  id: number;
  bank_account_id: number;
  transaction_date: string;
  amount: string;
  currency: string;
  counterpart_name: string;
  counterpart_iban: string;
  description: string;
  reference: string;
  transaction_type: string;
  is_booked: boolean;
  is_allocated: boolean;
  journal_entry_id: number;
}

const fmtAmount = (v: string) => {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("bg-BG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const isPositive = (v: string) => Number(v) >= 0;

function BankTransactionsInner() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<BankTransaction[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // preview modal
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingContent, setPendingContent] = useState("");
  const [importing, setImporting] = useState(false);

  // book modal
  const [bookTx, setBookTx] = useState<BankTransaction | null>(null);
  const [bookDebit, setBookDebit] = useState(0);
  const [bookCredit, setBookCredit] = useState(0);
  const [bookLoading, setBookLoading] = useState(false);

  // reallocate modal
  const [reallocTx, setReallocTx] = useState<BankTransaction | null>(null);
  const [reallocAccount, setReallocAccount] = useState(0);
  const [reallocLoading, setReallocLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [b, a] = await Promise.all([
        api.get<ListResponse<BankAccount>>("/v1/bank-accounts"),
        api.get<ListResponse<Account>>("/v1/accounts"),
      ]);
      setAccounts(b.items ?? []);
      setChartAccounts(a.items ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedAccount) params.set("bank_account_id", selectedAccount);
      if (filterStatus) params.set("status", filterStatus);
      const qs = params.toString();
      const data = await api.get<ListResponse<BankTransaction>>(
        `/v1/bank-transactions${qs ? `?${qs}` : ""}`
      );
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, filterStatus]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (file: File) => {
    if (!selectedAccount) {
      setError(t("bank_tx.select_account"));
      return;
    }
    setError("");
    setSuccess("");
    const content = await file.text();
    setPendingContent(content);
    setPreview(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const data = await api.post<Preview>("/v1/bank-transactions/preview", {
        bank_account_id: Number(selectedAccount),
        file_content: content,
      });
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const r = await api.post<{ imported: number; journal_count: number }>(
        "/v1/bank-transactions/import",
        {
          bank_account_id: Number(selectedAccount),
          file_content: pendingContent,
        }
      );
      const msg =
        r.journal_count > 0
          ? t("bank_tx.imported_with_journal")
              .replace("{n}", String(r.imported))
              .replace("{j}", String(r.journal_count))
          : t("bank_tx.imported").replace("{n}", String(r.imported));
      setSuccess(msg);
      setError("");
      setPreviewOpen(false);
      setPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleBook = async () => {
    if (!bookTx) return;
    if (!bookDebit || !bookCredit) {
      setError(t("bank_tx.pick_both_accounts"));
      return;
    }
    setBookLoading(true);
    try {
      await api.post(`/v1/bank-transactions/${bookTx.id}/book`, {
        debit_account_id: bookDebit,
        credit_account_id: bookCredit,
      });
      setSuccess(t("bank_tx.booked"));
      setBookTx(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBookLoading(false);
    }
  };

  const handleReallocate = async () => {
    if (!reallocTx) return;
    if (!reallocAccount) {
      setError(t("bank_tx.pick_account"));
      return;
    }
    setReallocLoading(true);
    try {
      const r = await api.post<{ message: string }>(
        `/v1/bank-transactions/${reallocTx.id}/reallocate`,
        { account_id: reallocAccount }
      );
      setSuccess(r.message || t("bank_tx.reallocated"));
      setReallocTx(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReallocLoading(false);
    }
  };

  const handleDelete = async (tx: BankTransaction) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`/v1/bank-transactions/${tx.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const accountOptions = (value: number, onChange: (v: number) => void) => (
    <select
      className="select"
      value={value || 0}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value={0}>{t("bank_tx.pick_account")}</option>
      {chartAccounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.number} {a.name}
        </option>
      ))}
    </select>
  );

  const statusBadge = (tx: BankTransaction) => {
    if (tx.is_allocated)
      return (
        <span className="badge badge-success">{t("bank_tx.status.allocated")}</span>
      );
    if (tx.is_booked)
      return (
        <span className="badge badge-warning">{t("bank_tx.status.booked")}</span>
      );
    return <span className="badge badge-danger">{t("bank_tx.status.new")}</span>;
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("bank_tx.title")}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="select"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="">{t("bank_tx.all_accounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.iban})
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">{t("bank_tx.all_statuses")}</option>
            <option value="new">{t("bank_tx.status.new")}</option>
            <option value="booked">{t("bank_tx.status.booked")}</option>
            <option value="allocated">{t("bank_tx.status.allocated")}</option>
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.sta,.mt940,.txt,.STA,.csv,.CSV"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {t("bank_tx.import_file")}
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {success && (
        <div className="muted" style={{ color: "var(--success)", marginBottom: 12 }}>
          {success}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="content muted">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="content muted">{t("bank_tx.empty")}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("bank_tx.date")}</th>
                <th>{t("bank_tx.description")}</th>
                <th>{t("bank_tx.counterpart")}</th>
                <th style={{ textAlign: "right" }}>{t("bank_tx.amount")}</th>
                <th style={{ textAlign: "center" }}>{t("bank_tx.status")}</th>
                <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {tx.transaction_date}
                  </td>
                  <td
                    style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}
                    title={tx.description}
                  >
                    {tx.description}
                  </td>
                  <td>{tx.counterpart_name}</td>
                  <td
                    style={{
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                      color: isPositive(tx.amount)
                        ? "var(--success)"
                        : "var(--danger)",
                    }}
                  >
                    {fmtAmount(tx.amount)} {tx.currency}
                  </td>
                  <td style={{ textAlign: "center" }}>{statusBadge(tx)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div className="icon-actions" style={{ justifyContent: "flex-end" }}>
                      {!tx.is_booked && (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setBookTx(tx);
                              setBookDebit(0);
                              setBookCredit(0);
                            }}
                          >
                            {t("bank_tx.book")}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(tx)}
                          >
                            {t("common.delete")}
                          </button>
                        </>
                      )}
                      {tx.is_booked && !tx.is_allocated && (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setReallocTx(tx);
                            setReallocAccount(0);
                          }}
                        >
                          {t("bank_tx.reallocate")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Import preview modal ─── */}
      {previewOpen && (
        <div className="modal-backdrop" onClick={() => setPreviewOpen(false)}>
          <div
            className="card modal"
            style={{ maxWidth: 840, maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{t("bank_tx.preview_title")}</h2>
            {previewLoading ? (
              <div className="content muted">{t("common.loading")}</div>
            ) : preview ? (
              <>
                <div className="summary-grid">
                  <div className="summary-box">
                    <div className="summary-label">{t("bank_tx.preview.format")}</div>
                    <div className="summary-value">{preview.format_name}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">{t("bank_tx.preview.total")}</div>
                    <div className="summary-value">{preview.total_count}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">{t("bank_tx.preview.new")}</div>
                    <div className="summary-value" style={{ color: "var(--success)" }}>
                      {preview.new_count}
                    </div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-label">{t("bank_tx.preview.duplicates")}</div>
                    <div className="summary-value" style={{ color: "var(--danger)" }}>
                      {preview.duplicate_count}
                    </div>
                  </div>
                </div>
                {preview.account_iban && (
                  <div className="muted" style={{ margin: "12px 0" }}>
                    {t("bank_tx.preview.iban")}:{" "}
                    <strong>{preview.account_iban}</strong>
                  </div>
                )}
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("bank_tx.date")}</th>
                        <th>{t("bank_tx.description")}</th>
                        <th>{t("bank_tx.counterpart")}</th>
                        <th style={{ textAlign: "right" }}>{t("bank_tx.amount")}</th>
                        <th style={{ textAlign: "center" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.transactions.map((tx, i) => (
                        <tr
                          key={i}
                          style={
                            tx.is_duplicate
                              ? { opacity: 0.6, background: "var(--danger-soft)" }
                              : undefined
                          }
                        >
                          <td style={{ whiteSpace: "nowrap" }}>{tx.date}</td>
                          <td
                            style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}
                            title={tx.description}
                          >
                            {tx.description}
                          </td>
                          <td>{tx.contra_name}</td>
                          <td
                            style={{
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              fontWeight: 500,
                              color: isPositive(tx.amount)
                                ? "var(--success)"
                                : "var(--danger)",
                            }}
                          >
                            {fmtAmount(tx.amount)} {tx.currency}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {tx.is_duplicate && (
                              <span className="badge badge-danger">
                                {t("bank_tx.duplicate")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="form-actions">
                  <button
                    className="btn"
                    onClick={() => setPreviewOpen(false)}
                    type="button"
                  >
                    {t("common.cancel")}
                  </button>
                  {preview.new_count > 0 && (
                    <button
                      className="btn btn-primary"
                      onClick={handleImport}
                      disabled={importing}
                      type="button"
                    >
                      {importing
                        ? t("bank_tx.importing")
                        : t("bank_tx.import_n").replace(
                            "{n}",
                            String(preview.new_count)
                          )}
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ─── Manual booking modal ─── */}
      {bookTx && (
        <div className="modal-backdrop" onClick={() => setBookTx(null)}>
          <div
            className="card modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{t("bank_tx.book_title")}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {t("bank_tx.book_hint")}
            </p>
            <div className="form-grid">
              <div className="field">
                <label className="label">{t("bank_tx.debit")}</label>
                {accountOptions(bookDebit, setBookDebit)}
              </div>
              <div className="field">
                <label className="label">{t("bank_tx.credit")}</label>
                {accountOptions(bookCredit, setBookCredit)}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn" onClick={() => setBookTx(null)} type="button">
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBook}
                disabled={bookLoading}
                type="button"
              >
                {t("bank_tx.book")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reallocate modal ─── */}
      {reallocTx && (
        <div className="modal-backdrop" onClick={() => setReallocTx(null)}>
          <div
            className="card modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{t("bank_tx.reallocate_title")}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {t("bank_tx.reallocate_hint")}
            </p>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="label">{t("bank_tx.target_account")}</label>
              {accountOptions(reallocAccount, setReallocAccount)}
            </div>
            <div className="form-actions">
              <button
                className="btn"
                onClick={() => setReallocTx(null)}
                type="button"
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleReallocate}
                disabled={reallocLoading}
                type="button"
              >
                {t("bank_tx.reallocate")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BankTransactionsPage() {
  return (
    <RequireAuth>
      <BankTransactionsInner />
    </RequireAuth>
  );
}
