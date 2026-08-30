"use client";

// Справки — оборотна ведомост, главна книга, хронологичен журнал,
// по контрагент (оборотна + хронологична). Експорт PDF/XLSX/ODS през
// същия reportbaga път като печата на фактури.

import { useCallback, useEffect, useState } from "react";
import { api, downloadFile, ListResponse } from "../../lib/api";
import { formatBgDate, todayIso } from "../../lib/dates";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";
import { IconButton } from "../../components/IconButton";

type Kind =
  | "trial_balance"
  | "general_ledger"
  | "chronological"
  | "counterpart_trial"
  | "counterpart_chrono";

interface Counterpart {
  id: number;
  name: string;
}

interface TrialRow {
  account_number: string;
  account_name: string;
  opening_debit: string;
  opening_credit: string;
  turnover_debit: string;
  turnover_credit: string;
  closing_debit: string;
  closing_credit: string;
}

interface TrialTotals {
  opening_debit: string;
  opening_credit: string;
  turnover_debit: string;
  turnover_credit: string;
  closing_debit: string;
  closing_credit: string;
}

interface TrialData {
  kind: string;
  from: string;
  to: string;
  title: string;
  rows: TrialRow[];
  totals: TrialTotals;
}

interface ChronoRow {
  row_number: number;
  date: string;
  document_number: string;
  description: string;
  counterpart_name: string;
  debit_account: string;
  credit_account: string;
  debit_amount: string;
  credit_amount: string;
}

interface ChronoData {
  kind: string;
  from: string;
  to: string;
  title: string;
  rows: ChronoRow[];
  totals: { debit_amount: string; credit_amount: string };
}

interface LedgerTx {
  date: string;
  document_number: string;
  description: string;
  debit: string;
  credit: string;
  running_debit: string;
  running_credit: string;
}

interface LedgerAccount {
  account_number: string;
  account_name: string;
  opening_debit: string;
  opening_credit: string;
  turnover_debit: string;
  turnover_credit: string;
  closing_debit: string;
  closing_credit: string;
  transactions: LedgerTx[];
}

interface LedgerData {
  kind: string;
  from: string;
  to: string;
  title: string;
  accounts: LedgerAccount[];
}

const TABS: { kind: Kind; key: string }[] = [
  { kind: "trial_balance", key: "reports.tab.trial" },
  { kind: "general_ledger", key: "reports.tab.ledger" },
  { kind: "chronological", key: "reports.tab.chrono" },
  { kind: "counterpart_trial", key: "reports.tab.cp_trial" },
  { kind: "counterpart_chrono", key: "reports.tab.cp_chrono" },
];

function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function isCp(kind: Kind): boolean {
  return kind === "counterpart_trial" || kind === "counterpart_chrono";
}

function qs(kind: Kind, from: string, to: string, account: string, cpid: string): string {
  const p = new URLSearchParams();
  p.set("kind", kind);
  p.set("from", from);
  p.set("to", to);
  if (account.trim()) p.set("account", account.trim());
  if (isCp(kind) && cpid) p.set("counterpart_id", cpid);
  return p.toString();
}

function Num({ v }: { v: string }) {
  return <td className="num">{v}</td>;
}

function TrialTable({
  data,
  t,
}: {
  data: TrialData;
  t: (k: string) => string;
}) {
  const tot = data.totals;
  return (
    <div className="table-wrap print-sheet">
      <table className="table">
        <thead>
          <tr>
            <th>{t("reports.col.account")}</th>
            <th>{t("reports.col.name")}</th>
            <th className="num">{t("reports.col.od")}</th>
            <th className="num">{t("reports.col.oc")}</th>
            <th className="num">{t("reports.col.td")}</th>
            <th className="num">{t("reports.col.tc")}</th>
            <th className="num">{t("reports.col.cd")}</th>
            <th className="num">{t("reports.col.cc")}</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows ?? []).map((r) => (
            <tr key={r.account_number}>
              <td>{r.account_number}</td>
              <td>{r.account_name}</td>
              <Num v={r.opening_debit} />
              <Num v={r.opening_credit} />
              <Num v={r.turnover_debit} />
              <Num v={r.turnover_credit} />
              <Num v={r.closing_debit} />
              <Num v={r.closing_credit} />
            </tr>
          ))}
        </tbody>
        {tot && (
          <tfoot>
            <tr>
              <td colSpan={2}>{t("reports.total")}</td>
              <Num v={tot.opening_debit} />
              <Num v={tot.opening_credit} />
              <Num v={tot.turnover_debit} />
              <Num v={tot.turnover_credit} />
              <Num v={tot.closing_debit} />
              <Num v={tot.closing_credit} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ChronoTable({
  data,
  t,
}: {
  data: ChronoData;
  t: (k: string) => string;
}) {
  return (
    <div className="table-wrap print-sheet">
      <table className="table">
        <thead>
          <tr>
            <th>{t("reports.col.n")}</th>
            <th>{t("reports.col.date")}</th>
            <th>{t("reports.col.document")}</th>
            <th>{t("reports.col.description")}</th>
            <th>{t("reports.col.counterpart")}</th>
            <th>{t("reports.col.debit_acc")}</th>
            <th>{t("reports.col.credit_acc")}</th>
            <th className="num">{t("reports.col.debit")}</th>
            <th className="num">{t("reports.col.credit")}</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows ?? []).map((r) => (
            <tr key={r.row_number}>
              <td>{r.row_number}</td>
              <td>{formatBgDate(r.date)}</td>
              <td>{r.document_number}</td>
              <td>{r.description}</td>
              <td>{r.counterpart_name}</td>
              <td>{r.debit_account}</td>
              <td>{r.credit_account}</td>
              <Num v={r.debit_amount} />
              <Num v={r.credit_amount} />
            </tr>
          ))}
        </tbody>
        {data.totals && (
          <tfoot>
            <tr>
              <td colSpan={7}>{t("reports.total")}</td>
              <Num v={data.totals.debit_amount} />
              <Num v={data.totals.credit_amount} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function LedgerTables({
  data,
  t,
}: {
  data: LedgerData;
  t: (k: string) => string;
}) {
  return (
    <div className="print-sheet">
      {(data.accounts ?? []).map((acc) => (
        <div key={acc.account_number} style={{ marginBottom: 28 }}>
          <h3 className="report-account" style={{ padding: "8px 12px", margin: "0 0 8px" }}>
            {acc.account_number} {acc.account_name}
          </h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("reports.col.date")}</th>
                  <th>{t("reports.col.document")}</th>
                  <th>{t("reports.col.description")}</th>
                  <th className="num">{t("reports.col.debit")}</th>
                  <th className="num">{t("reports.col.credit")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3}>{t("reports.opening")}</td>
                  <Num v={acc.opening_debit} />
                  <Num v={acc.opening_credit} />
                </tr>
                {(acc.transactions ?? []).map((tx, i) => (
                  <tr key={`${acc.account_number}-${i}`}>
                    <td>{formatBgDate(tx.date)}</td>
                    <td>{tx.document_number}</td>
                    <td>{tx.description}</td>
                    <Num v={tx.debit} />
                    <Num v={tx.credit} />
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>{t("reports.turnover")}</td>
                  <Num v={acc.turnover_debit} />
                  <Num v={acc.turnover_credit} />
                </tr>
                <tr>
                  <td colSpan={3}>{t("reports.closing")}</td>
                  <Num v={acc.closing_debit} />
                  <Num v={acc.closing_credit} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsInner() {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("trial_balance");
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(todayIso);
  const [account, setAccount] = useState("");
  const [cpid, setCpid] = useState("");
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [trial, setTrial] = useState<TrialData | null>(null);
  const [chrono, setChrono] = useState<ChronoData | null>(null);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ListResponse<Counterpart>>("/v1/counterparts")
      .then((d) => setCounterparts(d.items ?? []))
      .catch(() => setCounterparts([]));
  }, []);

  const load = useCallback(async () => {
    if (isCp(kind) && !cpid) {
      setError(t("reports.need_counterpart"));
      return;
    }
    setLoading(true);
    setError("");
    setTrial(null);
    setChrono(null);
    setLedger(null);
    try {
      const path = `/v1/reports?${qs(kind, from, to, account, cpid)}`;
      if (kind === "general_ledger") {
        setLedger(await api.get<LedgerData>(path));
      } else if (kind === "chronological" || kind === "counterpart_chrono") {
        setChrono(await api.get<ChronoData>(path));
      } else {
        setTrial(await api.get<TrialData>(path));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [kind, from, to, account, cpid, t]);

  const exportFmt = async (fmt: "pdf" | "xlsx" | "ods") => {
    if (isCp(kind) && !cpid) {
      setError(t("reports.need_counterpart"));
      return;
    }
    setBusy(fmt);
    setError("");
    try {
      const slug =
        kind === "trial_balance"
          ? "oborotna"
          : kind === "general_ledger"
            ? "glavna-kniga"
            : kind === "chronological"
              ? "hronologichen"
              : kind === "counterpart_trial"
                ? "oborotna-kontragent"
                : "hronologichen-kontragent";
      await downloadFile(
        `/v1/reports/export?${qs(kind, from, to, account, cpid)}&format=${fmt}`,
        `${slug}-${from}-${to}.${fmt}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const hasData = !!(trial || chrono || ledger);

  return (
    <div>
      <div className="page-head no-print">
        <h1 className="page-title">{t("reports.title")}</h1>
      </div>
      <p className="muted no-print" style={{ margin: "0 0 12px" }}>
        {t("reports.hint")}
      </p>
      <div className="tabs tabs-wrap no-print">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            className={`tab${kind === tab.kind ? " tab-active" : ""}`}
            onClick={() => {
              setKind(tab.kind);
              setTrial(null);
              setChrono(null);
              setLedger(null);
            }}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      <div className="card content no-print" style={{ marginBottom: 18 }}>
        <div className="toolbar">
          <div className="field" style={{ margin: 0 }}>
            <label className="label">{t("reports.from")}</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">{t("reports.to")}</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">{t("reports.account")}</label>
            <input
              className="input"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="401"
            />
          </div>
          {isCp(kind) && (
            <div className="field" style={{ margin: 0, minWidth: 220 }}>
              <label className="label">{t("reports.counterpart")}</label>
              <select className="select" value={cpid} onChange={(e) => setCpid(e.target.value)}>
                <option value="">{t("reports.pick_counterpart")}</option>
                {counterparts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={load} disabled={loading || !from || !to}>
            {t("reports.show")}
          </button>
        </div>
      </div>

      {error && <div className="error-text no-print">{error}</div>}
      {loading && <div className="muted">{t("common.loading")}</div>}

      {hasData && (
        <div className="btn-row wrap no-print" style={{ marginBottom: 12 }}>
          <IconButton icon="print" title={t("reports.print")} onClick={() => window.print()} />
          {(["pdf", "xlsx", "ods"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              className="btn btn-sm"
              disabled={!!busy}
              onClick={() => exportFmt(fmt)}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {trial && (kind === "trial_balance" || kind === "counterpart_trial") && (
        <div className="card content">
          <h2 style={{ margin: "0 0 8px" }}>{trial.title}</h2>
          <p className="muted">
            {formatBgDate(trial.from)} — {formatBgDate(trial.to)}
          </p>
          <TrialTable data={trial} t={t} />
        </div>
      )}
      {chrono && (kind === "chronological" || kind === "counterpart_chrono") && (
        <div className="card content">
          <h2 style={{ margin: "0 0 8px" }}>{chrono.title}</h2>
          <p className="muted">
            {formatBgDate(chrono.from)} — {formatBgDate(chrono.to)}
          </p>
          <ChronoTable data={chrono} t={t} />
        </div>
      )}
      {ledger && kind === "general_ledger" && (
        <div className="card content">
          <h2 style={{ margin: "0 0 8px" }}>{ledger.title}</h2>
          <p className="muted">
            {formatBgDate(ledger.from)} — {formatBgDate(ledger.to)}
          </p>
          {(ledger.accounts ?? []).length === 0 ? (
            <div className="muted">{t("common.empty")}</div>
          ) : (
            <LedgerTables data={ledger} t={t} />
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportsInner />
    </RequireAuth>
  );
}
