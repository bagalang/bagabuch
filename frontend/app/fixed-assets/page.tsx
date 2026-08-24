"use client";

// ДМА — дълготрайни материални активи: активи (CRUD), категории (ЗКПО),
// месечна амортизация (изчисляване + осчетоводяване).

import { useCallback, useEffect, useState, FormEvent } from "react";
import { api, ListResponse } from "../../lib/api";
import { useI18n } from "../../components/I18nProvider";
import { RequireAuth } from "../../components/RequireAuth";
import { CrudPage, CrudConfig } from "../../components/CrudPage";

interface Fac {
  id: number;
  name: string;
  cita_category: string;
  min_depreciation_rate: string;
  max_depreciation_rate: string;
  default_method: string;
}

interface Fa {
  id: number;
  name: string;
  inventory_number: string;
  category_id?: number;
  acquisition_date: string;
  put_into_service_date: string;
  cost: string;
  salvage_value: string;
  useful_life_months: string;
  depreciation_method: string;
  accounting_depreciation_rate: string;
  tax_depreciation_rate: string;
  accumulated_depreciation: string;
  status: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  responsible_person: string;
  is_conserved: number;
}

interface DepItem {
  id: number;
  name: string;
  method: string;
  monthly_amount: string;
}

interface DepPreview {
  items: DepItem[];
  total_amount: string;
}

const facConfig: CrudConfig = {
  endpoint: "/v1/fixed-asset-categories",
  titleKey: "fa.tab.categories",
  fields: [
    { name: "name", labelKey: "fa.name", type: "text", required: true },
    { name: "cita_category", labelKey: "fa.cita_category", type: "text" },
    { name: "min_depreciation_rate", labelKey: "fa.min_rate", type: "number", default: "0" },
    { name: "max_depreciation_rate", labelKey: "fa.max_rate", type: "number", default: "0" },
    {
      name: "default_method",
      labelKey: "fa.depreciation_method",
      type: "select",
      default: "linear",
      options: [
        { value: "linear", labelKey: "fa.depreciation_method.linear" },
        { value: "declining", labelKey: "fa.depreciation_method.declining" },
      ],
    },
  ],
  columns: ["name", "cita_category", "min_depreciation_rate", "max_depreciation_rate", "default_method"],
};

function FaInner() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"assets" | "categories" | "depreciation">("assets");

  const [assets, setAssets] = useState<Fa[]>([]);
  const [categories, setCategories] = useState<Fac[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // модал за актив
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fa | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // амортизация
  const [depPeriod, setDepPeriod] = useState("");
  const [preview, setPreview] = useState<DepPreview | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const a = await api.get<ListResponse<Fa>>("/v1/fixed-assets");
      setAssets(a.items ?? []);
      const c = await api.get<ListResponse<Fac>>("/v1/fixed-asset-categories");
      setCategories(c.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catName = (id?: number) =>
    id ? categories.find((c) => c.id === id)?.name ?? String(id) : "";

  const openCreate = () => {
    setForm({
      name: "",
      inventory_number: "",
      category_id: "",
      acquisition_date: "",
      put_into_service_date: "",
      cost: "0",
      salvage_value: "0",
      useful_life_months: "0",
      depreciation_method: "linear",
      accounting_depreciation_rate: "0",
      tax_depreciation_rate: "0",
      status: "active",
      serial_number: "",
      manufacturer: "",
      model: "",
      responsible_person: "",
      is_conserved: false,
    });
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (a: Fa) => {
    setForm({
      name: a.name,
      inventory_number: a.inventory_number,
      category_id: a.category_id ? String(a.category_id) : "",
      acquisition_date: a.acquisition_date,
      put_into_service_date: a.put_into_service_date,
      cost: a.cost,
      salvage_value: a.salvage_value,
      useful_life_months: a.useful_life_months,
      depreciation_method: a.depreciation_method,
      accounting_depreciation_rate: a.accounting_depreciation_rate,
      tax_depreciation_rate: a.tax_depreciation_rate,
      status: a.status,
      serial_number: a.serial_number,
      manufacturer: a.manufacturer,
      model: a.model,
      responsible_person: a.responsible_person,
      is_conserved: a.is_conserved === 1,
    });
    setEditing(a);
    setFormError("");
    setModalOpen(true);
  };

  const setField = (name: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        inventory_number: form.inventory_number,
        category_id: Number(form.category_id) || 0,
        acquisition_date: form.acquisition_date,
        put_into_service_date: form.put_into_service_date,
        cost: form.cost,
        salvage_value: form.salvage_value,
        useful_life_months: form.useful_life_months,
        depreciation_method: form.depreciation_method,
        accounting_depreciation_rate: form.accounting_depreciation_rate,
        tax_depreciation_rate: form.tax_depreciation_rate,
        status: form.status,
        serial_number: form.serial_number,
        manufacturer: form.manufacturer,
        model: form.model,
        responsible_person: form.responsible_person,
        is_conserved: form.is_conserved ? 1 : 0,
      };
      if (editing) {
        await api.patch(`/v1/fixed-assets/${editing.id}`, payload);
      } else {
        await api.post("/v1/fixed-assets", payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: Fa) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`/v1/fixed-assets/${a.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePreview = async () => {
    if (!depPeriod) return;
    try {
      const p = await api.post<DepPreview>("/v1/fixed-assets/depreciation/preview", {});
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePost = async () => {
    if (!depPeriod) return;
    setPosting(true);
    setError("");
    try {
      await api.post("/v1/fixed-assets/depreciation/post", { period: depPeriod });
      await load();
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("fa.title")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {(
            [
              ["assets", "fa.tab.assets"],
              ["categories", "fa.tab.categories"],
              ["depreciation", "fa.tab.depreciation"],
            ] as const
          ).map(([value, key]) => (
            <button
              key={value}
              className={`btn btn-sm ${tab === value ? "btn-primary" : ""}`}
              onClick={() => setTab(value)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {tab === "assets" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={openCreate}>
              {t("common.create")}
            </button>
          </div>
          <div className="card">
            {loading ? (
              <div className="content muted">{t("common.loading")}</div>
            ) : assets.length === 0 ? (
              <div className="content muted">{t("common.empty")}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("fa.inventory_number")}</th>
                    <th>{t("fa.name")}</th>
                    <th>{t("fa.category")}</th>
                    <th>{t("fa.cost")}</th>
                    <th>{t("fa.accumulated")}</th>
                    <th>{t("fa.status")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td>{a.inventory_number}</td>
                      <td>{a.name}</td>
                      <td>{catName(a.category_id)}</td>
                      <td>{a.cost}</td>
                      <td>{a.accumulated_depreciation}</td>
                      <td>{t(`fa.status.${a.status}`)}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => openEdit(a)}>
                          {t("common.edit")}
                        </button>{" "}
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a)}>
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "categories" && <CrudPage config={facConfig} />}

      {tab === "depreciation" && (
        <div className="card content">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
            <div className="field" style={{ margin: 0, flex: 1 }}>
              <label className="label">{t("vat.period")}</label>
              <input
                className="input"
                value={depPeriod}
                onChange={(e) => setDepPeriod(e.target.value)}
                placeholder="2026-09-01"
              />
            </div>
            <button className="btn" onClick={handlePreview} disabled={!depPeriod}>
              {t("fa.dep_preview")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePost}
              disabled={!depPeriod || posting}
            >
              {t("fa.dep_post")}
            </button>
          </div>
          {preview && (
            <>
              <table className="table" style={{ maxWidth: 560 }}>
                <thead>
                  <tr>
                    <th>{t("fa.name")}</th>
                    <th>{t("fa.depreciation_method")}</th>
                    <th style={{ textAlign: "right" }}>{t("fa.dep_monthly")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.name}</td>
                      <td>{t(`fa.depreciation_method.${it.method}`)}</td>
                      <td style={{ textAlign: "right" }}>{it.monthly_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="muted" style={{ marginTop: 8 }}>
                {t("fa.dep_total")}: {preview.total_amount}
              </div>
            </>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {editing ? t("common.edit") : t("common.create")}
            </h2>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="field">
                  <label className="label">{t("fa.name")} *</label>
                  <input
                    className="input"
                    value={String(form.name)}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.inventory_number")}</label>
                  <input
                    className="input"
                    value={String(form.inventory_number)}
                    onChange={(e) => setField("inventory_number", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.category")}</label>
                  <select
                    className="select"
                    value={String(form.category_id)}
                    onChange={(e) => setField("category_id", e.target.value)}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t("fa.acquisition_date")}</label>
                  <input
                    className="input"
                    value={String(form.acquisition_date)}
                    onChange={(e) => setField("acquisition_date", e.target.value)}
                    placeholder="2026-01-15"
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.put_into_service_date")}</label>
                  <input
                    className="input"
                    value={String(form.put_into_service_date)}
                    onChange={(e) => setField("put_into_service_date", e.target.value)}
                    placeholder="2026-01-15"
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.cost")}</label>
                  <input
                    className="input"
                    value={String(form.cost)}
                    onChange={(e) => setField("cost", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.salvage_value")}</label>
                  <input
                    className="input"
                    value={String(form.salvage_value)}
                    onChange={(e) => setField("salvage_value", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.useful_life_months")}</label>
                  <input
                    className="input"
                    value={String(form.useful_life_months)}
                    onChange={(e) => setField("useful_life_months", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.depreciation_method")}</label>
                  <select
                    className="select"
                    value={String(form.depreciation_method)}
                    onChange={(e) => setField("depreciation_method", e.target.value)}
                  >
                    <option value="linear">{t("fa.depreciation_method.linear")}</option>
                    <option value="declining">{t("fa.depreciation_method.declining")}</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t("fa.accounting_rate")}</label>
                  <input
                    className="input"
                    value={String(form.accounting_depreciation_rate)}
                    onChange={(e) => setField("accounting_depreciation_rate", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.tax_rate")}</label>
                  <input
                    className="input"
                    value={String(form.tax_depreciation_rate)}
                    onChange={(e) => setField("tax_depreciation_rate", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.status")}</label>
                  <select
                    className="select"
                    value={String(form.status)}
                    onChange={(e) => setField("status", e.target.value)}
                  >
                    <option value="active">{t("fa.status.active")}</option>
                    <option value="sold">{t("fa.status.sold")}</option>
                    <option value="disposed">{t("fa.status.disposed")}</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t("fa.serial_number")}</label>
                  <input
                    className="input"
                    value={String(form.serial_number)}
                    onChange={(e) => setField("serial_number", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.manufacturer")}</label>
                  <input
                    className="input"
                    value={String(form.manufacturer)}
                    onChange={(e) => setField("manufacturer", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.model")}</label>
                  <input
                    className="input"
                    value={String(form.model)}
                    onChange={(e) => setField("model", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.responsible_person")}</label>
                  <input
                    className="input"
                    value={String(form.responsible_person)}
                    onChange={(e) => setField("responsible_person", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">{t("fa.is_conserved")}</label>
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_conserved)}
                    onChange={(e) => setField("is_conserved", e.target.checked)}
                  />
                </div>
              </div>
              {formError && <div className="error-text">{formError}</div>}
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>
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

export default function FixedAssetsPage() {
  return (
    <RequireAuth>
      <FaInner />
    </RequireAuth>
  );
}
