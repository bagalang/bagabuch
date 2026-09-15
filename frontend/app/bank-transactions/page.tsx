"use client";

// Банкови транзакции: импорт от файл (преглед + дубликати), ръчно
// осчетоводяване и разнасяне с търсене на контрагент и сметка — като
// secret/baraba. Сумите остават десимални низове.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "../../components/RequireAuth";
import { useI18n } from "../../components/I18nProvider";
import { api, ListResponse } from "../../lib/api";

interface BankAccount {
  id: number;
  name: string;
  iban: string;
  currency: string;
  gl_account_id?: number;
}

interface Account {
  id: number;
  number: string;
  name: string;
}

interface Counterpart {
  id: number;
  name: string;
  eik: string;
  vat_number: string;
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

interface JeLine {
  id: number;
  account_id: number;
  direction: string;
  amount: string;
  account_number?: string;
  account_name?: string;
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

function matchCounterpart(
  name: string,
  list: Counterpart[]
): Counterpart | null {
  const needle = name.trim().toLowerCase();
  if (needle.length < 2) return null;
  const exact = list.find((c) => c.name.toLowerCase() === needle);
  if (exact) return exact;
  return (
    list.find((c) => {
      const n = c.name.toLowerCase();
      if (n.length < 3) return false;
      return n.includes(needle) || needle.includes(n);
    }) ?? null
  );
}

function filterCounterparts(list: Counterpart[], q: string): Counterpart[] {
  const s = q.trim().toLowerCase();
  const src = !s
    ? list
    : list.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          (c.eik || "").toLowerCase().includes(s) ||
          (c.vat_number || "").toLowerCase().includes(s)
      );
  return src.slice(0, 40);
}

function filterAccounts(list: Account[], q: string): Account[] {
  const s = q.trim().toLowerCase();
  const src = !s
    ? list
    : list.filter(
        (a) =>
          a.number.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)
      );
  return src.slice(0, 80);
}

function cpLabel(c: Counterpart): string {
  const eik = (c.eik || "").trim();
  return eik ? `${c.name} (${eik})` : c.name;
}

function BankTransactionsInner() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>([]);
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [rows, setRows] = useState<BankTransaction[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingContent, setPendingContent] = useState("");
  const [importing, setImporting] = useState(false);

  const [bookTx, setBookTx] = useState<BankTransaction | null>(null);
  const [bookContra, setBookContra] = useState(0);
  const [bookDebit, setBookDebit] = useState(0);
  const [bookCredit, setBookCredit] = useState(0);
  const [bookCpId, setBookCpId] = useState(0);
  const [bookCpSearch, setBookCpSearch] = useState("");
  const [bookAccSearch, setBookAccSearch] = useState("");
  const [bookLoading, setBookLoading] = useState(false);

  const [reallocTx, setReallocTx] = useState<BankTransaction | null>(null);
  const [reallocAccount, setReallocAccount] = useState(0);
  const [reallocCpId, setReallocCpId] = useState(0);
  const [reallocCpSearch, setReallocCpSearch] = useState("");
  const [reallocAccSearch, setReallocAccSearch] = useState("");
  const [reallocLines, setReallocLines] = useState<JeLine[]>([]);
  const [reallocLoading, setReallocLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [b, a, c] = await Promise.all([
        api.get<ListResponse<BankAccount>>("/v1/bank-accounts"),
        api.get<ListResponse<Account>>("/v1/accounts"),
        api.get<ListResponse<Counterpart>>("/v1/counterparts"),
      ]);
      setAccounts(b.items ?? []);
      setChartAccounts(a.items ?? []);
      setCounterparts(c.items ?? []);
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

  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((tx) =>
      [tx.description, tx.counterpart_name, tx.reference, tx.amount, tx.transaction_date]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

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

  const openBook = (tx: BankTransaction) => {
    const m = matchCounterpart(tx.counterpart_name || "", counterparts);
    setBookTx(tx);
    setBookContra(0);
    setBookDebit(0);
    setBookCredit(0);
    setBookCpId(m?.id ?? 0);
    setBookCpSearch(tx.counterpart_name || "");
    setBookAccSearch("");
  };

  const openReallocate = async (tx: BankTransaction) => {
    const m = matchCounterpart(tx.counterpart_name || "", counterparts);
    setReallocTx(tx);
    setReallocAccount(0);
    setReallocCpId(m?.id ?? 0);
    setReallocCpSearch(tx.counterpart_name || "");
    setReallocAccSearch("");
    setReallocLines([]);
    if (tx.journal_entry_id > 0) {
      try {
        const je = await api.get<{ lines?: JeLine[] }>(
          `/v1/journal/${tx.journal_entry_id}`
        );
        setReallocLines(je.lines ?? []);
      } catch {
        setReallocLines([]);
      }
    }
  };

  const bankGlId = (tx: BankTransaction | null): number => {
    if (!tx) return 0;
    const ba = accounts.find((a) => a.id === tx.bank_account_id);
    return ba?.gl_account_id ?? 0;
  };

  const handleBook = async () => {
    if (!bookTx) return;
    const gl = bankGlId(bookTx);
    const payload: Record<string, number> = {};
    if (gl > 0) {
      if (!bookContra) {
        setError(t("bank_tx.pick_contra"));
        return;
      }
      payload.contra_account_id = bookContra;
    } else {
      if (!bookDebit || !bookCredit) {
        setError(t("bank_tx.pick_both_accounts"));
        return;
      }
      payload.debit_account_id = bookDebit;
      payload.credit_account_id = bookCredit;
    }
    if (bookCpId > 0) payload.counterpart_id = bookCpId;
    setBookLoading(true);
    try {
      await api.post(`/v1/bank-transactions/${bookTx.id}/book`, payload);
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
    const payload: Record<string, number> = { account_id: reallocAccount };
    if (reallocCpId > 0) payload.counterpart_id = reallocCpId;
    setReallocLoading(true);
    try {
      const r = await api.post<{ message: string }>(
        `/v1/bank-transactions/${reallocTx.id}/reallocate`,
        payload
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

  const counterpartSelect = (
    value: number,
    search: string,
    onSearch: (v: string) => void,
    onChange: (v: number) => void
  ) => (
    <div>
      <input
        className="input"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={t("bank_tx.search_counterpart")}
        style={{ marginBottom: 6 }}
      />
      <select
        className="select"
        value={value || 0}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value={0}>{t("bank_tx.none_counterpart")}</option>
        {filterCounterparts(counterparts, search).map((c) => (
          <option key={c.id} value={c.id}>
            {cpLabel(c)}
          </option>
        ))}
      </select>
    </div>
  );

  const accountSelect = (
    value: number,
    search: string,
    onSearch: (v: string) => void,
    onChange: (v: number) => void
  ) => (
    <div>
      <input
        className="input"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={t("bank_tx.search_account")}
        style={{ marginBottom: 6 }}
      />
      <select
        className="select"
        value={value || 0}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value={0}>{t("bank_tx.pick_account")}</option>
        {filterAccounts(chartAccounts, search).map((a) => (
          <option key={a.id} value={a.id}>
            {a.number} {a.name}
          </option>
        ))}
      </select>
    </div>
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

  const txSummary = (tx: BankTransaction) => (
    <div className="summary-grid" style={{ marginBottom: 16 }}>
      <div className="summary-box">
        <div className="summary-label">{t("bank_tx.date")}</div>
        <div className="summary-value">{tx.transaction_date}</div>
      </div>
      <div className="summary-box">
        <div className="summary-label">{t("bank_tx.amount")}</div>
        <div
          className="summary-value"
          style={{ color: isPositive(tx.amount) ? "var(--success)" : "var(--danger)" }}
        >
          {fmtAmount(tx.amount)} {tx.currency}
        </div>
      </div>
      {tx.reference ? (
        <div className="summary-box">
          <div className="summary-label">{t("bank_tx.reference")}</div>
          <div className="summary-value" style={{ fontSize: 13 }}>
            {tx.reference}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("bank_tx.title")}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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

      <div className="card" style={{ marginBottom: 12 }}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("bank_tx.search_placeholder")}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="content muted">{t("common.loading")}</div>
        ) : filteredRows.length === 0 ? (
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
              {filteredRows.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{tx.transaction_date}</td>
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
                          <button className="btn btn-sm" onClick={() => openBook(tx)}>
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
                            void openReallocate(tx);
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
                            style={{
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
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

      {bookTx && (
        <div className="modal-backdrop" onClick={() => setBookTx(null)}>
          <div
            className="card modal"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{t("bank_tx.book_title")}</h2>
            {txSummary(bookTx)}
            {bookTx.description ? (
              <p className="muted" style={{ marginBottom: 12 }}>
                {bookTx.description}
              </p>
            ) : null}
            {bookTx.counterpart_name ? (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">{t("bank_tx.bank_counterpart")}</label>
                <div>{bookTx.counterpart_name}</div>
              </div>
            ) : null}
            <p className="muted" style={{ marginBottom: 16 }}>
              {t("bank_tx.book_hint")}
            </p>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label">{t("bank_tx.counterpart")}</label>
              {counterpartSelect(bookCpId, bookCpSearch, setBookCpSearch, setBookCpId)}
            </div>
            {bankGlId(bookTx) > 0 ? (
              <div className="field" style={{ marginBottom: 16 }}>
                <label className="label">{t("bank_tx.contra_account")}</label>
                {accountSelect(
                  bookContra,
                  bookAccSearch,
                  setBookAccSearch,
                  setBookContra
                )}
              </div>
            ) : (
              <>
                <p className="muted" style={{ marginBottom: 12 }}>
                  {t("bank_tx.no_gl")}
                </p>
              <div className="form-grid">
                <div className="field">
                  <label className="label">{t("bank_tx.debit")}</label>
                  {accountSelect(
                    bookDebit,
                    bookAccSearch,
                    setBookAccSearch,
                    setBookDebit
                  )}
                </div>
                <div className="field">
                  <label className="label">{t("bank_tx.credit")}</label>
                  {accountSelect(
                    bookCredit,
                    bookAccSearch,
                    setBookAccSearch,
                    setBookCredit
                  )}
                </div>
              </div>
              </>
            )}
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

      {reallocTx && (
        <div className="modal-backdrop" onClick={() => setReallocTx(null)}>
          <div
            className="card modal"
            style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{t("bank_tx.reallocate_title")}</h2>
            {txSummary(reallocTx)}
            {reallocTx.description ? (
              <p className="muted" style={{ marginBottom: 12 }}>
                {reallocTx.description}
              </p>
            ) : null}
            {reallocTx.counterpart_name ? (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="label">{t("bank_tx.bank_counterpart")}</label>
                <div>{reallocTx.counterpart_name}</div>
              </div>
            ) : null}
            {reallocLines.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>
                  {t("bank_tx.je_lines")}
                </h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("bank_tx.target_account")}</th>
                      <th style={{ textAlign: "right" }}>{t("bank_tx.debit")}</th>
                      <th style={{ textAlign: "right" }}>{t("bank_tx.credit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reallocLines.map((ln) => (
                      <tr key={ln.id}>
                        <td>
                          {(ln.account_number || "") +
                            (ln.account_name ? ` ${ln.account_name}` : "")}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {ln.direction === "debit" ? fmtAmount(ln.amount) : ""}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {ln.direction === "credit" ? fmtAmount(ln.amount) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted" style={{ marginBottom: 16 }}>
              {t("bank_tx.reallocate_hint")}
            </p>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label">{t("bank_tx.counterpart")}</label>
              {counterpartSelect(
                reallocCpId,
                reallocCpSearch,
                setReallocCpSearch,
                setReallocCpId
              )}
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="label">{t("bank_tx.contra_account")}</label>
              {accountSelect(
                reallocAccount,
                reallocAccSearch,
                setReallocAccSearch,
                setReallocAccount
              )}
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
