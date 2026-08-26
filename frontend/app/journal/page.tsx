"use client";

// Дневник — счетоводни записи. Нов запис: модал с три таба
// (Покупки / Продажби / Без ДДС) — покупките и продажбите влизат в
// дневниците за ДДС.

import { useCallback, useEffect, useState, Fragment, FormEvent } from "react";
import { api, ListResponse } from "../../lib/api";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";

interface JournalEntry {
  id: number;
  entry_date: string;
  document_type: string;
  document_id: number;
  description: string;
  vat_type: string;
  counterpart_name: string;
}

interface JournalLine {
  id: number;
  account_id: number;
  direction: string;
  amount: string;
  vat_amount?: string;
  account_number?: string;
  account_name?: string;
}

interface Account {
  id: number;
  number: string;
  name: string;
}

interface Counterpart {
  id: number;
  name: string;
  counterpart_type: string;
}

type Tab = "purchase" | "sales" | "no_vat";

interface LineDraft {
  accountId: string;
  direction: "debit" | "credit";
  amount: string;
  vatAmount: string;
}

const VAT_TYPE_LABEL: Record<string, string> = {
  purchase: "journal.tab.purchase",
  sales: "journal.tab.sales",
  no_vat: "journal.tab.no_vat",
};

function JournalInner() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [linesByEntry, setLinesByEntry] = useState<Record<number, JournalLine[]>>({});

  // модал
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("purchase");
  const [entryDate, setEntryDate] = useState("");
  const [description, setDescription] = useState("");
  const [counterpartId, setCounterpartId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [vatPeriod, setVatPeriod] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { accountId: "", direction: "debit", amount: "", vatAmount: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<ListResponse<JournalEntry>>("/v1/journal");
      setEntries(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRefs = useCallback(async () => {
    try {
      const a = await api.get<ListResponse<Account>>("/v1/accounts");
      setAccounts(a.items ?? []);
      const c = await api.get<ListResponse<Counterpart>>("/v1/counterparts");
      setCounterparts(c.items ?? []);
    } catch {
      /* празни списъци */
    }
  }, []);

  useEffect(() => {
    load();
    loadRefs();
  }, [load, loadRefs]);

  const accLabel = (line: JournalLine) => {
    if (line.account_number) {
      return line.account_name
        ? `${line.account_number} ${line.account_name}`
        : line.account_number;
    }
    const a = accounts.find((x) => x.id === line.account_id);
    return a ? `${a.number} ${a.name}` : String(line.account_id);
  };

  const toggle = async (entry: JournalEntry) => {
    if (expanded === entry.id) {
      setExpanded(null);
      return;
    }
    setExpanded(entry.id);
    if (!linesByEntry[entry.id]) {
      try {
        const data = await api.get<JournalEntry & { lines: JournalLine[] }>(
          `/v1/journal/${entry.id}`
        );
        setLinesByEntry((prev) => ({ ...prev, [entry.id]: data.lines ?? [] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const openCreate = () => {
    setTab("purchase");
    setEntryDate("");
    setDescription("");
    setCounterpartId("");
    setDocumentNumber("");
    setDocumentDate("");
    setVatPeriod("");
    setLines([{ accountId: "", direction: "debit", amount: "", vatAmount: "" }]);
    setFormError("");
    setModalOpen(true);
  };

  const setLine = (i: number, f: keyof LineDraft, v: string) =>
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [f]: v } : l))
    );

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { accountId: "", direction: "debit", amount: "", vatAmount: "" },
    ]);

  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const debitSum = lines
    .filter((l) => l.direction === "debit")
    .reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
  const creditSum = lines
    .filter((l) => l.direction === "credit")
    .reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
  const balanced = Math.abs(debitSum - creditSum) < 0.0001;

  const filteredCounterparts = counterparts.filter((c) => {
    if (tab === "purchase") return c.counterpart_type !== "customer";
    if (tab === "sales") return c.counterpart_type !== "supplier";
    return true;
  });

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        entry_date: entryDate,
        description,
        vat_type: tab,
        counterpart_id: tab === "no_vat" ? 0 : Number(counterpartId) || 0,
        document_number: documentNumber,
        document_date: documentDate,
        vat_period: tab === "no_vat" ? "" : vatPeriod,
        lines: lines.map((l) => ({
          account_id: Number(l.accountId),
          direction: l.direction,
          amount: l.amount,
          vat_amount: l.vatAmount || "0",
        })),
      };
      await api.post("/v1/journal", payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("journal.title")}</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          {t("journal.new_entry")}
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="content muted">{t("common.loading")}</div>
        ) : entries.length === 0 ? (
          <div className="content muted">{t("common.empty")}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("journal.entry_date")}</th>
                <th>{t("journal.document")}</th>
                <th>{t("journal.description")}</th>
                <th>{t("journal.counterpart")}</th>
                <th>{t("invoices.status")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((en) => (
                <Fragment key={en.id}>
                  <tr onClick={() => toggle(en)} style={{ cursor: "pointer" }}>
                    <td>{en.entry_date}</td>
                    <td>
                      {en.document_type} #{en.document_id}
                    </td>
                    <td>{en.description}</td>
                    <td>{en.counterpart_name}</td>
                    <td>
                      <span
                        className={`badge ${
                          en.vat_type === "no_vat"
                            ? "badge-muted"
                            : en.vat_type === "sales"
                              ? "badge-success"
                              : "badge-warning"
                        }`}
                      >
                        {t(VAT_TYPE_LABEL[en.vat_type] ?? "journal.tab.no_vat")}
                      </span>
                    </td>
                  </tr>
                  {expanded === en.id && linesByEntry[en.id] && (
                    <tr>
                      <td colSpan={5}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t("journal.account")}</th>
                              <th>{t("journal.debit")}</th>
                              <th>{t("journal.credit")}</th>
                              <th>{t("journal.vat_amount")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {linesByEntry[en.id].map((l) => (
                              <tr key={l.id}>
                                <td>{accLabel(l)}</td>
                                <td>{l.direction === "debit" ? l.amount : ""}</td>
                                <td>{l.direction === "credit" ? l.amount : ""}</td>
                                <td>{l.vat_amount || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t("journal.new_entry")}</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {(
                [
                  ["purchase", "journal.tab.purchase"],
                  ["sales", "journal.tab.sales"],
                  ["no_vat", "journal.tab.no_vat"],
                ] as const
              ).map(([value, key]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn btn-sm ${tab === value ? "btn-primary" : ""}`}
                  onClick={() => setTab(value)}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="field">
                  <label className="label">{t("journal.entry_date")} *</label>
                  <input
                    className="input"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    placeholder="2026-08-20"
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">{t("journal.description")} *</label>
                  <input
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
                {tab !== "no_vat" && (
                  <>
                    <div className="field">
                      <label className="label">{t("journal.counterpart")}</label>
                      <select
                        className="select"
                        value={counterpartId}
                        onChange={(e) => setCounterpartId(e.target.value)}
                      >
                        <option value="">—</option>
                        {filteredCounterparts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label">{t("journal.vat_period")}</label>
                      <input
                        className="input"
                        value={vatPeriod}
                        onChange={(e) => setVatPeriod(e.target.value)}
                        placeholder="2026-08"
                      />
                    </div>
                    <div className="field">
                      <label className="label">{t("journal.document_number")}</label>
                      <input
                        className="input"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="label">{t("journal.document_date")}</label>
                      <input
                        className="input"
                        value={documentDate}
                        onChange={(e) => setDocumentDate(e.target.value)}
                        placeholder="2026-08-20"
                      />
                    </div>
                  </>
                )}
              </div>

              <h3 style={{ margin: "12px 0 8px" }}>{t("journal.title")}</h3>
              {lines.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <select
                    className="select"
                    style={{ flex: 2 }}
                    value={l.accountId}
                    onChange={(e) => setLine(i, "accountId", e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      {t("journal.account")}…
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.number} {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    style={{ flex: 1 }}
                    value={l.direction}
                    onChange={(e) =>
                      setLine(i, "direction", e.target.value as "debit" | "credit")
                    }
                  >
                    <option value="debit">{t("journal.debit")}</option>
                    <option value="credit">{t("journal.credit")}</option>
                  </select>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder={t("journal.amount")}
                    value={l.amount}
                    onChange={(e) => setLine(i, "amount", e.target.value)}
                    required
                  />
                  {tab !== "no_vat" && (
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder={t("journal.vat_amount")}
                      value={l.vatAmount}
                      onChange={(e) => setLine(i, "vatAmount", e.target.value)}
                    />
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeLine(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={addLine}>
                + {t("journal.add_line")}
              </button>

              <div className="muted" style={{ marginTop: 12 }}>
                {t("journal.balance")}: {debitSum.toFixed(2)} /{" "}
                {creditSum.toFixed(2)}{" "}
                {balanced ? "✓" : "✗"}
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
                <button
                  className="btn btn-primary"
                  disabled={saving || !balanced}
                >
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

export default function JournalPage() {
  return (
    <RequireAuth>
      <JournalInner />
    </RequireAuth>
  );
}
