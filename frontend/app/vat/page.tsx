"use client";

// ДДС справки — дневници покупки/продажби + ППДДС клетки за периода.
// Данните идват от счетоводните записи с ДДС тип (ръчни + постнати фактури).

import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";

interface VatRow {
  id: number;
  entry_date: string;
  document_type: string;
  document_number: string;
  counterpart_name: string;
  counterpart_vat_number: string;
  base_amount: string;
  vat_amount: string;
}

interface Registers {
  period: string;
  purchases: VatRow[];
  sales: VatRow[];
}

interface VatReturn {
  cell_01: string;
  cell_11: string;
  cell_31: string;
  cell_41: string;
  cell_71: string;
  cell_81: string;
  cell_82: string;
}

function RegistersTable({
  rows,
  title,
  t,
}: {
  rows: VatRow[];
  title: string;
  t: (k: string) => string;
}) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="content">
        <h3 style={{ margin: "0 0 10px" }}>{title}</h3>
        {rows.length === 0 ? (
          <div className="muted">{t("common.empty")}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("vat.date")}</th>
                <th>{t("vat.doc_type")}</th>
                <th>{t("vat.document")}</th>
                <th>{t("vat.counterpart")}</th>
                <th>{t("vat.vat_number")}</th>
                <th style={{ textAlign: "right" }}>{t("vat.base")}</th>
                <th style={{ textAlign: "right" }}>{t("vat.vat")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.entry_date}</td>
                  <td title={t(`invoices.document_type.${r.document_type}`)}>
                    {r.document_type}
                  </td>
                  <td>{r.document_number}</td>
                  <td>{r.counterpart_name}</td>
                  <td>{r.counterpart_vat_number}</td>
                  <td style={{ textAlign: "right" }}>{r.base_amount}</td>
                  <td style={{ textAlign: "right" }}>{r.vat_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function VatInner() {
  const { t } = useI18n();
  const [period, setPeriod] = useState("");
  const [registers, setRegisters] = useState<Registers | null>(null);
  const [vatReturn, setVatReturn] = useState<VatReturn | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.get<Registers>(`/v1/vat/registers?period=${encodeURIComponent(period)}`);
      setRegisters(r);
      const v = await api.get<VatReturn>(`/v1/vat/return?period=${encodeURIComponent(period)}`);
      setVatReturn(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  const cells: [string, keyof VatReturn][] = [
    ["vat.cell_01", "cell_01"],
    ["vat.cell_11", "cell_11"],
    ["vat.cell_31", "cell_31"],
    ["vat.cell_41", "cell_41"],
    ["vat.cell_71", "cell_71"],
    ["vat.cell_81", "cell_81"],
    ["vat.cell_82", "cell_82"],
  ];

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("vat.title")}</h1>
      </div>

      <div className="card content" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label className="label">{t("vat.period")}</label>
            <input
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2026-08"
            />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={!period || loading}>
            {t("vat.show")}
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {vatReturn && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="content">
            <h3 style={{ margin: "0 0 10px" }}>{t("vat.cells")}</h3>
            <table className="table" style={{ maxWidth: 480 }}>
              <tbody>
                {cells.map(([labelKey, key]) => (
                  <tr key={key}>
                    <td>{t(labelKey)}</td>
                    <td style={{ textAlign: "right" }}>{vatReturn[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {registers && (
        <>
          <RegistersTable rows={registers.purchases} title={t("vat.purchases")} t={t} />
          <RegistersTable rows={registers.sales} title={t("vat.sales")} t={t} />
        </>
      )}
    </div>
  );
}

export default function VatPage() {
  return (
    <RequireAuth>
      <VatInner />
    </RequireAuth>
  );
}
