"use client";

// CrudPage — генеричен списък + създаване/редакция/изтриване по конфигурация.
// Използва се за фирми, сметкоплан, контрагенти, стоки. Фактурите и дневникът
// са специализирани (редове/кореспонденции) и са отделни страници.

import { useCallback, useEffect, useState, FormEvent } from "react";
import { api, ListResponse } from "../lib/api";
import { useI18n } from "./I18nProvider";

export interface SelectOption {
  value: string;
  labelKey: string;
}

export interface FieldDef {
  name: string;
  labelKey: string;
  type: "text" | "number" | "select" | "checkbox";
  required?: boolean;
  options?: SelectOption[];
  default?: string;
}

export interface CrudConfig {
  endpoint: string;
  titleKey: string;
  fields: FieldDef[];
  columns: string[];
}

type Record_ = Record<string, unknown>;

function cellText(rec: Record_, field: FieldDef, t: (k: string) => string): string {
  const v = rec[field.name];
  if (v === null || v === undefined) return "";
  if (field.type === "checkbox") return Number(v) === 1 ? "✓" : "";
  if (field.type === "select") {
    const opt = field.options?.find((o) => o.value === String(v));
    return opt ? t(opt.labelKey) : String(v);
  }
  return String(v);
}

export function CrudPage({ config }: { config: CrudConfig }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record_ | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<ListResponse<Record_>>(config.endpoint);
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  useEffect(() => {
    // Зареждане при монтиране (данните зависят от автентикацията, четат се от
    // клиента; сетСтейт е асинхронен след await, не синхронен каскаден рендер).
    load();
  }, [load]);

  const openCreate = () => {
    const initial: Record<string, string | boolean> = {};
    for (const f of config.fields) {
      if (f.type === "checkbox") initial[f.name] = false;
      else initial[f.name] = f.default ?? "";
    }
    setForm(initial);
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (rec: Record_) => {
    const initial: Record<string, string | boolean> = {};
    for (const f of config.fields) {
      const v = rec[f.name];
      if (f.type === "checkbox") initial[f.name] = Number(v) === 1;
      else initial[f.name] = v === null || v === undefined ? "" : String(v);
    }
    setForm(initial);
    setEditing(rec);
    setFormError("");
    setModalOpen(true);
  };

  const buildPayload = (): Record_ => {
    const payload: Record_ = {};
    for (const f of config.fields) {
      const v = form[f.name];
      if (f.type === "checkbox") payload[f.name] = v ? 1 : 0;
      else payload[f.name] = v ?? "";
    }
    return payload;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = buildPayload();
      if (editing) {
        await api.patch(`${config.endpoint}/${editing.id}`, payload);
      } else {
        await api.post(config.endpoint, payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec: Record_) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`${config.endpoint}/${rec.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const setField = (name: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t(config.titleKey)}</h1>
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
                {config.columns.map((c) => {
                  const f = config.fields.find((x) => x.name === c);
                  return <th key={c}>{f ? t(f.labelKey) : c}</th>;
                })}
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rec) => (
                <tr key={String(rec.id)}>
                  {config.columns.map((c) => {
                    const f = config.fields.find((x) => x.name === c);
                    return (
                      <td key={c}>
                        {f ? cellText(rec, f, t) : String(rec[c] ?? "")}
                      </td>
                    );
                  })}
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => openEdit(rec)}
                    >
                      {t("common.edit")}
                    </button>{" "}
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(rec)}
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
            <h2 className="modal-title">
              {editing ? t("common.edit") : t("common.create")}
            </h2>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                {config.fields.map((f) => (
                  <div className="field" key={f.name}>
                    <label className="label">
                      {t(f.labelKey)}
                      {f.required ? " *" : ""}
                    </label>
                    {f.type === "select" ? (
                      <select
                        className="select"
                        value={String(form[f.name] ?? "")}
                        onChange={(e) => setField(f.name, e.target.value)}
                      >
                        {(f.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {t(o.labelKey)}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(form[f.name])}
                        onChange={(e) => setField(f.name, e.target.checked)}
                      />
                    ) : (
                      <input
                        className="input"
                        type={f.type === "number" ? "text" : "text"}
                        value={String(form[f.name] ?? "")}
                        onChange={(e) => setField(f.name, e.target.value)}
                        required={f.required}
                      />
                    )}
                  </div>
                ))}
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
