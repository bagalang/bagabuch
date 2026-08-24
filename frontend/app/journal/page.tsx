"use client";

// Дневник — счетоводни записи; клик разгъва редовете (дебит/кредит).

import { useCallback, useEffect, useState, Fragment } from "react";
import { api, ListResponse } from "../../lib/api";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";

interface JournalEntry {
  id: number;
  entry_date: string;
  document_type: string;
  document_id: number;
  description: string;
}

interface JournalLine {
  id: number;
  account_id: number;
  direction: string;
  amount: string;
}

interface Account {
  id: number;
  number: string;
  name: string;
}

function JournalInner() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [linesByEntry, setLinesByEntry] = useState<Record<number, JournalLine[]>>({});

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

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.get<ListResponse<Account>>("/v1/accounts");
      setAccounts(data.items ?? []);
    } catch {
      /* празно */
    }
  }, []);

  // Зареждане при монтиране (данните зависят от автентикацията, четат се от
  // клиента; сетСтейт е асинхронен след await, не синхронен каскаден рендер).
  useEffect(() => {
    load();
    loadAccounts();
  }, [load, loadAccounts]);

  const accLabel = (id: number) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.number} ${a.name}` : String(id);
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

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("journal.title")}</h1>
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
                  </tr>
                  {expanded === en.id && linesByEntry[en.id] && (
                    <tr>
                      <td colSpan={3}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>{t("journal.account")}</th>
                              <th>{t("journal.debit")}</th>
                              <th>{t("journal.credit")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {linesByEntry[en.id].map((l) => (
                              <tr key={l.id}>
                                <td>{accLabel(l.account_id)}</td>
                                <td>
                                  {l.direction === "debit" ? l.amount : ""}
                                </td>
                                <td>
                                  {l.direction === "credit" ? l.amount : ""}
                                </td>
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
