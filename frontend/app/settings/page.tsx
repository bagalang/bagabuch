"use client";

// Настройки на активната фирма — по образец на secret/su-doxis settings.rs.
// Таб «Фирма»: реквизити, управител/счетоводител, ДДС. Таб «SAF-T / Собственици»:
// улица/сграда/регион, обекти (поделения), действителни собственици, предприятия-майки.

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "../../components/RequireAuth";
import { useI18n } from "../../components/I18nProvider";
import { DocumentSeriesTab, DocSeries } from "../../components/DocumentSeriesTab";
import { IconButton } from "../../components/IconButton";
import {
  ACTIVE_COMPANY_EVENT,
  Company,
  api,
  getActiveCompany,
} from "../../lib/api";

interface Location {
  id: number;
  name: string;
  location_type: string;
  street_name: string;
  building_number: string;
  city: string;
  post_code: string;
  region: string;
  country: string;
  is_main: number;
}

interface Owner {
  id: number;
  first_name_bg: string;
  last_name_bg: string;
  egn: string;
  first_name_latin: string;
  last_name_latin: string;
  country: string;
  ownership_percentage: string;
}

interface ParentCo {
  id: number;
  name_bg: string;
  uic: string;
  name_latin: string;
  country: string;
}

interface SettingsPack {
  company: Company;
  locations: Location[];
  beneficial_owners: Owner[];
  ultimate_parents: ParentCo[];
  document_series?: DocSeries[];
}

type Form = Record<string, string>;

const EMPTY_LOC: Form = {
  name: "",
  location_type: "OFFICE",
  street_name: "",
  building_number: "",
  city: "",
  post_code: "",
  region: "",
  country: "BG",
  is_main: "0",
};

const EMPTY_OWNER: Form = {
  first_name_bg: "",
  last_name_bg: "",
  egn: "",
  first_name_latin: "",
  last_name_latin: "",
  country: "BG",
  ownership_percentage: "0",
};

const EMPTY_PARENT: Form = {
  name_bg: "",
  uic: "",
  name_latin: "",
  country: "BG",
};

function str(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function parseKeys(raw: unknown): { mistral_api_key: string; zhipu_api_key: string } {
  const empty = { mistral_api_key: "", zhipu_api_key: "" };
  if (typeof raw !== "string" || !raw) return empty;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      mistral_api_key: str(o.mistral_api_key),
      zhipu_api_key: str(o.zhipu_api_key),
    };
  } catch {
    return empty;
  }
}

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: ReactNode;
  span?: number;
}) {
  return (
    <div className="field" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function SettingsInner() {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState(0);
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [companyForm, setCompanyForm] = useState<Form>({});
  const [saftForm, setSaftForm] = useState<Form>({});
  const [keys, setKeys] = useState({ mistral_api_key: "", zhipu_api_key: "" });
  const [rawSettings, setRawSettings] = useState("{}");

  const [locations, setLocations] = useState<Location[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [parents, setParents] = useState<ParentCo[]>([]);
  const [series, setSeries] = useState<DocSeries[]>([]);

  const [showLoc, setShowLoc] = useState(false);
  const [editLocId, setEditLocId] = useState(0);
  const [locForm, setLocForm] = useState<Form>(EMPTY_LOC);

  const [showOwner, setShowOwner] = useState(false);
  const [editOwnerId, setEditOwnerId] = useState(0);
  const [ownerForm, setOwnerForm] = useState<Form>(EMPTY_OWNER);

  const [showParent, setShowParent] = useState(false);
  const [editParentId, setEditParentId] = useState(0);
  const [parentForm, setParentForm] = useState<Form>(EMPTY_PARENT);

  const setC = (k: string, v: string) => setCompanyForm((p) => ({ ...p, [k]: v }));
  const setS = (k: string, v: string) => setSaftForm((p) => ({ ...p, [k]: v }));
  const setL = (k: string, v: string) => setLocForm((p) => ({ ...p, [k]: v }));
  const setO = (k: string, v: string) => setOwnerForm((p) => ({ ...p, [k]: v }));
  const setP = (k: string, v: string) => setParentForm((p) => ({ ...p, [k]: v }));

  const applyPack = (pack: SettingsPack) => {
    const c = pack.company;
    setCompanyForm({
      name: str(c.name),
      eik: str(c.eik),
      vat_number: str(c.vat_number),
      address: str(c.address),
      city: str(c.city),
      post_code: str(c.post_code),
      country: str(c.country, "BG"),
      phone: str(c.phone),
      email: str(c.email),
      website: str(c.website),
      mol: str(c.mol),
      manager_name: str(c.manager_name),
      manager_eik: str(c.manager_eik),
      manager_egn: str(c.manager_egn),
      accountant_name: str(c.accountant_name),
      accountant_egn: str(c.accountant_egn),
      authorized_person_name: str(c.authorized_person_name),
      authorized_person_egn: str(c.authorized_person_egn),
      tax_authority: str(c.tax_authority),
      nap_office: str(c.nap_office),
      iban: str(c.iban),
      bic: str(c.bic),
      is_vat_registered: Number(c.is_vat_registered) ? "1" : "0",
      vat_period: str(c.vat_period, "monthly"),
      currency: str(c.currency, "EUR"),
      vat_branch_number: str(c.vat_branch_number),
      fiscal_year_start_month: str(c.fiscal_year_start_month, "1"),
    });
    setSaftForm({
      street_name: str(c.street_name),
      building_number: str(c.building_number),
      region: str(c.region),
      tax_accounting_basis: str(c.tax_accounting_basis, "A"),
      inventory_valuation_method: str(c.inventory_valuation_method, "WAC"),
      is_part_of_group: str(c.is_part_of_group),
      tax_entity: str(c.tax_entity),
      software_company_name: str(c.software_company_name, "bagabuch"),
      software_id: str(c.software_id, "BAGABUCH"),
      software_version: str(c.software_version, "1.0"),
    });
    const raw = str(c.settings, "{}");
    setRawSettings(raw);
    setKeys(parseKeys(raw));
    setLocations(pack.locations ?? []);
    setOwners(pack.beneficial_owners ?? []);
    setParents(pack.ultimate_parents ?? []);
    setSeries(pack.document_series ?? []);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const ac = await getActiveCompany();
      const id = ac && typeof ac.id === "number" ? ac.id : 0;
      setActiveId(id);
      if (id <= 0) {
        setLoading(false);
        return;
      }
      const pack = await api.get<SettingsPack>(`/v1/companies/${id}/settings`);
      applyPack(pack);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(ACTIVE_COMPANY_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_COMPANY_EVENT, onChange);
  }, [load]);

  const flash = (ok: string) => {
    setMsg(ok);
    setErr("");
  };

  const saveCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (activeId <= 0) return;
    setSaving(true);
    setErr("");
    try {
      let settingsObj: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(rawSettings || "{}") as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          settingsObj = parsed as Record<string, unknown>;
        }
      } catch {
        settingsObj = {};
      }
      settingsObj.mistral_api_key = keys.mistral_api_key;
      settingsObj.zhipu_api_key = keys.zhipu_api_key;
      await api.patch(`/v1/companies/${activeId}`, {
        name: companyForm.name,
        eik: companyForm.eik,
        vat_number: companyForm.vat_number,
        address: companyForm.address,
        city: companyForm.city,
        post_code: companyForm.post_code,
        country: companyForm.country,
        phone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website,
        mol: companyForm.mol,
        manager_name: companyForm.manager_name,
        manager_eik: companyForm.manager_eik,
        manager_egn: companyForm.manager_egn,
        accountant_name: companyForm.accountant_name,
        accountant_egn: companyForm.accountant_egn,
        authorized_person_name: companyForm.authorized_person_name,
        authorized_person_egn: companyForm.authorized_person_egn,
        tax_authority: companyForm.tax_authority,
        nap_office: companyForm.nap_office,
        iban: companyForm.iban,
        bic: companyForm.bic,
        is_vat_registered: companyForm.is_vat_registered === "1",
        vat_period: companyForm.vat_period,
        currency: companyForm.currency,
        vat_branch_number: companyForm.vat_branch_number,
        fiscal_year_start_month: Number(companyForm.fiscal_year_start_month) || 1,
        settings: JSON.stringify(settingsObj),
      });
      flash(t("settings.saved.company"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveSaft = async (e: FormEvent) => {
    e.preventDefault();
    if (activeId <= 0) return;
    setSaving(true);
    setErr("");
    try {
      await api.patch(`/v1/companies/${activeId}`, {
        street_name: saftForm.street_name,
        building_number: saftForm.building_number,
        region: saftForm.region,
        tax_accounting_basis: saftForm.tax_accounting_basis,
        inventory_valuation_method: saftForm.inventory_valuation_method,
        is_part_of_group: saftForm.is_part_of_group,
        tax_entity: saftForm.tax_entity,
        software_company_name: saftForm.software_company_name,
        software_id: saftForm.software_id,
        software_version: saftForm.software_version,
      });
      flash(t("settings.saved.saft"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const reloadRelated = async () => {
    const pack = await api.get<SettingsPack>(`/v1/companies/${activeId}/settings`);
    setLocations(pack.locations ?? []);
    setOwners(pack.beneficial_owners ?? []);
    setParents(pack.ultimate_parents ?? []);
    setSeries(pack.document_series ?? []);
  };

  const saveLoc = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const body = {
        name: locForm.name,
        location_type: locForm.location_type,
        street_name: locForm.street_name,
        building_number: locForm.building_number,
        city: locForm.city,
        post_code: locForm.post_code,
        region: locForm.region,
        country: locForm.country,
        is_main: locForm.is_main === "1",
      };
      if (editLocId > 0) {
        await api.patch(`/v1/company-locations/${editLocId}`, body);
      } else {
        await api.post(`/v1/companies/${activeId}/locations`, body);
      }
      setShowLoc(false);
      setEditLocId(0);
      await reloadRelated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveOwner = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const body = {
        first_name_bg: ownerForm.first_name_bg,
        last_name_bg: ownerForm.last_name_bg,
        egn: ownerForm.egn,
        first_name_latin: ownerForm.first_name_latin,
        last_name_latin: ownerForm.last_name_latin,
        country: ownerForm.country,
        ownership_percentage: ownerForm.ownership_percentage,
      };
      if (editOwnerId > 0) {
        await api.patch(`/v1/beneficial-owners/${editOwnerId}`, body);
      } else {
        await api.post(`/v1/companies/${activeId}/beneficial-owners`, body);
      }
      setShowOwner(false);
      setEditOwnerId(0);
      await reloadRelated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveParent = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const body = {
        name_bg: parentForm.name_bg,
        uic: parentForm.uic,
        name_latin: parentForm.name_latin,
        country: parentForm.country,
      };
      if (editParentId > 0) {
        await api.patch(`/v1/ultimate-parents/${editParentId}`, body);
      } else {
        await api.post(`/v1/companies/${activeId}/ultimate-parents`, body);
      }
      setShowParent(false);
      setEditParentId(0);
      await reloadRelated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const delLoc = async (id: number) => {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`/v1/company-locations/${id}`);
      await reloadRelated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const delOwner = async (id: number) => {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`/v1/beneficial-owners/${id}`);
      await reloadRelated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const delParent = async (id: number) => {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await api.del(`/v1/ultimate-parents/${id}`);
      await reloadRelated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return <div className="muted">{t("common.loading")}</div>;
  }
  if (activeId <= 0) {
    return (
      <div className="card card-pad">
        <p className="muted" style={{ margin: 0 }}>
          {t("settings.no_company")}
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">{t("settings.title")}</h1>
      {msg && (
        <div className="flash-ok">
          {msg}
          <button className="btn-ghost btn-sm" onClick={() => setMsg("")} type="button">
            ×
          </button>
        </div>
      )}
      {err && (
        <div className="flash-err">
          {err}
          <button className="btn-ghost btn-sm" onClick={() => setErr("")} type="button">
            ×
          </button>
        </div>
      )}
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 0 ? " tab-active" : ""}`}
          onClick={() => setTab(0)}
        >
          {t("settings.tab.company")}
        </button>
        <button
          type="button"
          className={`tab${tab === 1 ? " tab-active" : ""}`}
          onClick={() => setTab(1)}
        >
          {t("settings.tab.saft")}
        </button>
        <button
          type="button"
          className={`tab${tab === 2 ? " tab-active" : ""}`}
          onClick={() => setTab(2)}
        >
          {t("settings.tab.series")}
        </button>
      </div>

      {tab === 0 && (
        <form className="card card-pad" onSubmit={saveCompany} style={{ maxWidth: 760 }}>
          <h3 className="section-title">{t("settings.section.basic")}</h3>
          <div className="form-grid">
            <Field label={`${t("companies.name")} *`} span={2}>
              <input className="input" value={companyForm.name ?? ""} onChange={(e) => setC("name", e.target.value)} required />
            </Field>
            <Field label={`${t("companies.eik")} *`}>
              <input className="input" value={companyForm.eik ?? ""} onChange={(e) => setC("eik", e.target.value)} required />
            </Field>
            <Field label={t("companies.vat_number")}>
              <input className="input" value={companyForm.vat_number ?? ""} onChange={(e) => setC("vat_number", e.target.value)} />
            </Field>
            <Field label={t("companies.address")} span={2}>
              <input className="input" value={companyForm.address ?? ""} onChange={(e) => setC("address", e.target.value)} />
            </Field>
            <Field label={t("companies.city")}>
              <input className="input" value={companyForm.city ?? ""} onChange={(e) => setC("city", e.target.value)} />
            </Field>
            <Field label={t("companies.post_code")}>
              <input className="input" value={companyForm.post_code ?? ""} onChange={(e) => setC("post_code", e.target.value)} />
            </Field>
            <Field label={t("settings.country")}>
              <input className="input" value={companyForm.country ?? "BG"} onChange={(e) => setC("country", e.target.value)} />
            </Field>
            <Field label={t("companies.phone")}>
              <input className="input" value={companyForm.phone ?? ""} onChange={(e) => setC("phone", e.target.value)} />
            </Field>
            <Field label={t("companies.email")}>
              <input className="input" type="email" value={companyForm.email ?? ""} onChange={(e) => setC("email", e.target.value)} />
            </Field>
            <Field label={t("companies.website")}>
              <input className="input" value={companyForm.website ?? ""} onChange={(e) => setC("website", e.target.value)} />
            </Field>
            <Field label={t("companies.mol")}>
              <input className="input" value={companyForm.mol ?? ""} onChange={(e) => setC("mol", e.target.value)} />
            </Field>
            <Field label={t("companies.iban")}>
              <input className="input" value={companyForm.iban ?? ""} onChange={(e) => setC("iban", e.target.value)} />
            </Field>
            <Field label={t("companies.bic")}>
              <input className="input" value={companyForm.bic ?? ""} onChange={(e) => setC("bic", e.target.value)} />
            </Field>
            <Field label={t("companies.tax_authority")}>
              <input className="input" value={companyForm.tax_authority ?? ""} onChange={(e) => setC("tax_authority", e.target.value)} />
            </Field>
            <Field label={t("companies.nap_office")}>
              <input className="input" value={companyForm.nap_office ?? ""} onChange={(e) => setC("nap_office", e.target.value)} />
            </Field>
          </div>

          <h3 className="section-title" style={{ marginTop: 22 }}>
            {t("settings.section.people")}
          </h3>
          <div className="inline-form" style={{ marginBottom: 12 }}>
            <h4 className="section-title" style={{ fontSize: 13 }}>
              {t("settings.manager")}
            </h4>
            <div className="form-grid">
              <Field label={t("settings.person.name")}>
                <input className="input" value={companyForm.manager_name ?? ""} onChange={(e) => setC("manager_name", e.target.value)} />
              </Field>
              <Field label={t("settings.person.egn")}>
                <input className="input" value={companyForm.manager_egn ?? ""} onChange={(e) => setC("manager_egn", e.target.value)} />
              </Field>
              <Field label={t("companies.manager_eik")} span={2}>
                <input className="input" value={companyForm.manager_eik ?? ""} onChange={(e) => setC("manager_eik", e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="inline-form" style={{ marginBottom: 12 }}>
            <h4 className="section-title" style={{ fontSize: 13 }}>
              {t("settings.accountant")}
            </h4>
            <div className="form-grid">
              <Field label={t("settings.person.name")}>
                <input className="input" value={companyForm.accountant_name ?? ""} onChange={(e) => setC("accountant_name", e.target.value)} />
              </Field>
              <Field label={t("settings.person.egn")}>
                <input className="input" value={companyForm.accountant_egn ?? ""} onChange={(e) => setC("accountant_egn", e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="inline-form">
            <h4 className="section-title" style={{ fontSize: 13 }}>
              {t("settings.authorized")}
            </h4>
            <div className="form-grid">
              <Field label={t("settings.person.name")}>
                <input className="input" value={companyForm.authorized_person_name ?? ""} onChange={(e) => setC("authorized_person_name", e.target.value)} />
              </Field>
              <Field label={t("settings.person.egn")}>
                <input className="input" value={companyForm.authorized_person_egn ?? ""} onChange={(e) => setC("authorized_person_egn", e.target.value)} />
              </Field>
            </div>
          </div>

          <h3 className="section-title" style={{ marginTop: 22 }}>
            {t("settings.section.vat")}
          </h3>
          <div className="form-grid-3">
            <Field label={t("companies.is_vat_registered")}>
              <select className="select" value={companyForm.is_vat_registered ?? "0"} onChange={(e) => setC("is_vat_registered", e.target.value)}>
                <option value="1">{t("common.yes")}</option>
                <option value="0">{t("common.no")}</option>
              </select>
            </Field>
            <Field label={t("companies.vat_period")}>
              <select className="select" value={companyForm.vat_period ?? "monthly"} onChange={(e) => setC("vat_period", e.target.value)}>
                <option value="monthly">{t("companies.vat_period.monthly")}</option>
                <option value="quarterly">{t("companies.vat_period.quarterly")}</option>
              </select>
            </Field>
            <Field label={t("companies.currency")}>
              <select className="select" value={companyForm.currency ?? "EUR"} onChange={(e) => setC("currency", e.target.value)}>
                <option value="EUR">EUR (€)</option>
                <option value="BGN">BGN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label={t("settings.vat_branch")}>
              <input className="input" value={companyForm.vat_branch_number ?? ""} onChange={(e) => setC("vat_branch_number", e.target.value)} />
            </Field>
            <Field label={t("companies.fiscal_year_start_month")}>
              <input className="input" type="number" min={1} max={12} value={companyForm.fiscal_year_start_month ?? "1"} onChange={(e) => setC("fiscal_year_start_month", e.target.value)} />
            </Field>
          </div>

          <h3 className="section-title" style={{ marginTop: 22 }}>
            {t("settings.section.integrations")}
          </h3>
          <div className="form-grid">
            <Field label={t("settings.mistral_key")} span={2}>
              <input className="input" type="password" autoComplete="off" value={keys.mistral_api_key} onChange={(e) => setKeys((k) => ({ ...k, mistral_api_key: e.target.value }))} />
              <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                {t("settings.mistral_hint")}
              </p>
            </Field>
            <Field label={t("settings.zhipu_key")} span={2}>
              <input className="input" value={keys.zhipu_api_key} onChange={(e) => setKeys((k) => ({ ...k, zhipu_api_key: e.target.value }))} />
              <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                {t("settings.zhipu_hint")}
              </p>
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("settings.save.company")}
            </button>
          </div>
        </form>
      )}

      {tab === 1 && (
        <div style={{ maxWidth: 900 }}>
          <form className="card card-pad" onSubmit={saveSaft} style={{ marginBottom: 16 }}>
            <h3 className="section-title">{t("settings.section.saft")}</h3>
            <div className="form-grid-3">
              <Field label={t("settings.street")}>
                <input className="input" value={saftForm.street_name ?? ""} onChange={(e) => setS("street_name", e.target.value)} />
              </Field>
              <Field label={t("settings.building")}>
                <input className="input" value={saftForm.building_number ?? ""} onChange={(e) => setS("building_number", e.target.value)} />
              </Field>
              <Field label={t("settings.region")}>
                <input className="input" placeholder="BG-22" value={saftForm.region ?? ""} onChange={(e) => setS("region", e.target.value)} />
              </Field>
              <Field label={t("settings.tax_basis")}>
                <select className="select" value={saftForm.tax_accounting_basis ?? "A"} onChange={(e) => setS("tax_accounting_basis", e.target.value)}>
                  <option value="A">{t("settings.tax_basis.A")}</option>
                  <option value="BANK">{t("settings.tax_basis.BANK")}</option>
                  <option value="P">{t("settings.tax_basis.P")}</option>
                </select>
              </Field>
              <Field label={t("companies.inventory_valuation_method")}>
                <select className="select" value={saftForm.inventory_valuation_method ?? "WAC"} onChange={(e) => setS("inventory_valuation_method", e.target.value)}>
                  <option value="WAC">{t("settings.inv.WAC")}</option>
                  <option value="FIFO">{t("settings.inv.FIFO")}</option>
                  <option value="LIFO">{t("settings.inv.LIFO")}</option>
                </select>
              </Field>
              <Field label={t("settings.group")}>
                <select className="select" value={saftForm.is_part_of_group ?? ""} onChange={(e) => setS("is_part_of_group", e.target.value)}>
                  <option value="">{t("settings.group.empty")}</option>
                  <option value="1">{t("settings.group.1")}</option>
                  <option value="2">{t("settings.group.2")}</option>
                  <option value="3">{t("settings.group.3")}</option>
                  <option value="4">{t("settings.group.4")}</option>
                  <option value="5">{t("settings.group.5")}</option>
                </select>
              </Field>
              <Field label={t("settings.tax_entity")}>
                <input className="input" value={saftForm.tax_entity ?? ""} onChange={(e) => setS("tax_entity", e.target.value)} />
              </Field>
              <Field label={t("settings.software_name")}>
                <input className="input" value={saftForm.software_company_name ?? ""} onChange={(e) => setS("software_company_name", e.target.value)} />
              </Field>
              <Field label={t("settings.software_id")}>
                <input className="input" value={saftForm.software_id ?? ""} onChange={(e) => setS("software_id", e.target.value)} />
              </Field>
              <Field label={t("settings.software_version")}>
                <input className="input" value={saftForm.software_version ?? ""} onChange={(e) => setS("software_version", e.target.value)} />
              </Field>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? t("common.loading") : t("settings.save.saft")}
              </button>
            </div>
          </form>

          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="page-head" style={{ marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                {t("settings.locations")}
              </h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setEditLocId(0);
                  setLocForm(EMPTY_LOC);
                  setShowLoc(true);
                }}
              >
                {t("settings.add.location")}
              </button>
            </div>
            {showLoc && (
              <form className="inline-form" onSubmit={saveLoc}>
                <h4 className="section-title" style={{ fontSize: 13 }}>
                  {editLocId > 0 ? t("common.edit") : t("common.create")}
                </h4>
                <div className="form-grid-3">
                  <Field label={`${t("companies.name")} *`}>
                    <input className="input" value={locForm.name} onChange={(e) => setL("name", e.target.value)} required />
                  </Field>
                  <Field label={t("settings.location_type")}>
                    <select className="select" value={locForm.location_type} onChange={(e) => setL("location_type", e.target.value)}>
                      <option value="OFFICE">{t("settings.loc.OFFICE")}</option>
                      <option value="STORE">{t("settings.loc.STORE")}</option>
                      <option value="WAREHOUSE">{t("settings.loc.WAREHOUSE")}</option>
                      <option value="BRANCH">{t("settings.loc.BRANCH")}</option>
                      <option value="OTHER">{t("settings.loc.OTHER")}</option>
                    </select>
                  </Field>
                  <Field label={t("settings.is_main")}>
                    <select className="select" value={locForm.is_main} onChange={(e) => setL("is_main", e.target.value)}>
                      <option value="0">{t("common.no")}</option>
                      <option value="1">{t("settings.is_main.yes")}</option>
                    </select>
                  </Field>
                  <Field label={t("settings.street")}>
                    <input className="input" value={locForm.street_name} onChange={(e) => setL("street_name", e.target.value)} />
                  </Field>
                  <Field label={t("settings.building")}>
                    <input className="input" value={locForm.building_number} onChange={(e) => setL("building_number", e.target.value)} />
                  </Field>
                  <Field label={t("companies.city")}>
                    <input className="input" value={locForm.city} onChange={(e) => setL("city", e.target.value)} />
                  </Field>
                  <Field label={t("companies.post_code")}>
                    <input className="input" value={locForm.post_code} onChange={(e) => setL("post_code", e.target.value)} />
                  </Field>
                  <Field label={t("settings.region")}>
                    <input className="input" placeholder="BG-22" value={locForm.region} onChange={(e) => setL("region", e.target.value)} />
                  </Field>
                  <Field label={t("settings.country")}>
                    <input className="input" value={locForm.country} onChange={(e) => setL("country", e.target.value)} />
                  </Field>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => setShowLoc(false)}>
                    {t("common.cancel")}
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {t("common.save")}
                  </button>
                </div>
              </form>
            )}
            {locations.length === 0 && <p className="muted">{t("settings.empty.locations")}</p>}
            {locations.map((loc) => (
              <div className="list-item" key={loc.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {loc.name}
                    {Number(loc.is_main) ? (
                      <span className="badge badge-success" style={{ marginLeft: 8 }}>
                        {t("settings.is_main.yes")}
                      </span>
                    ) : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t(`settings.loc.${loc.location_type}`)}
                    {loc.city ? ` — ${loc.city}` : ""}
                    {loc.street_name ? `, ${loc.street_name}` : ""}
                    {loc.building_number ? ` ${loc.building_number}` : ""}
                  </div>
                </div>
                <div className="icon-actions">
                  <IconButton
                    icon="edit"
                    title={t("common.edit")}
                    onClick={() => {
                      setEditLocId(loc.id);
                      setLocForm({
                        name: loc.name,
                        location_type: loc.location_type,
                        street_name: loc.street_name ?? "",
                        building_number: loc.building_number ?? "",
                        city: loc.city ?? "",
                        post_code: loc.post_code ?? "",
                        region: loc.region ?? "",
                        country: loc.country || "BG",
                        is_main: Number(loc.is_main) ? "1" : "0",
                      });
                      setShowLoc(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    title={t("common.delete")}
                    danger
                    onClick={() => delLoc(loc.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="page-head" style={{ marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                {t("settings.owners")}
              </h3>
              <Link href="/dividends" className="btn btn-sm">{t("settings.to_dividends")}</Link>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setEditOwnerId(0);
                  setOwnerForm(EMPTY_OWNER);
                  setShowOwner(true);
                }}
              >
                {t("settings.add.owner")}
              </button>
            </div>
            {showOwner && (
              <form className="inline-form" onSubmit={saveOwner}>
                <h4 className="section-title" style={{ fontSize: 13 }}>
                  {editOwnerId > 0 ? t("common.edit") : t("common.create")}
                </h4>
                <div className="form-grid-3">
                  <Field label={`${t("settings.owner.first_bg")} *`}>
                    <input className="input" value={ownerForm.first_name_bg} onChange={(e) => setO("first_name_bg", e.target.value)} required />
                  </Field>
                  <Field label={`${t("settings.owner.last_bg")} *`}>
                    <input className="input" value={ownerForm.last_name_bg} onChange={(e) => setO("last_name_bg", e.target.value)} required />
                  </Field>
                  <Field label={t("settings.person.egn")}>
                    <input className="input" value={ownerForm.egn} onChange={(e) => setO("egn", e.target.value)} />
                  </Field>
                  <Field label={t("settings.owner.first_lat")}>
                    <input className="input" value={ownerForm.first_name_latin} onChange={(e) => setO("first_name_latin", e.target.value)} />
                  </Field>
                  <Field label={t("settings.owner.last_lat")}>
                    <input className="input" value={ownerForm.last_name_latin} onChange={(e) => setO("last_name_latin", e.target.value)} />
                  </Field>
                  <Field label={t("settings.country")}>
                    <input className="input" value={ownerForm.country} onChange={(e) => setO("country", e.target.value)} />
                  </Field>
                  <Field label={t("settings.owner.percent")}>
                    <input className="input" type="number" step="0.01" value={ownerForm.ownership_percentage} onChange={(e) => setO("ownership_percentage", e.target.value)} />
                  </Field>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => setShowOwner(false)}>
                    {t("common.cancel")}
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {t("common.save")}
                  </button>
                </div>
              </form>
            )}
            {owners.length === 0 && <p className="muted">{t("settings.empty.owners")}</p>}
            {owners.map((o) => (
              <div className="list-item" key={o.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {o.first_name_bg} {o.last_name_bg}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {o.ownership_percentage}% {t("settings.owner.owned")}
                    {o.egn ? ` | ${t("settings.person.egn")}: ${o.egn}` : ""} | {o.country}
                  </div>
                </div>
                <div className="icon-actions">
                  <IconButton
                    icon="edit"
                    title={t("common.edit")}
                    onClick={() => {
                      setEditOwnerId(o.id);
                      setOwnerForm({
                        first_name_bg: o.first_name_bg,
                        last_name_bg: o.last_name_bg,
                        egn: o.egn ?? "",
                        first_name_latin: o.first_name_latin ?? "",
                        last_name_latin: o.last_name_latin ?? "",
                        country: o.country || "BG",
                        ownership_percentage: o.ownership_percentage ?? "0",
                      });
                      setShowOwner(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    title={t("common.delete")}
                    danger
                    onClick={() => delOwner(o.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div className="page-head" style={{ marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                {t("settings.parents")}
              </h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setEditParentId(0);
                  setParentForm(EMPTY_PARENT);
                  setShowParent(true);
                }}
              >
                {t("settings.add.parent")}
              </button>
            </div>
            {showParent && (
              <form className="inline-form" onSubmit={saveParent}>
                <h4 className="section-title" style={{ fontSize: 13 }}>
                  {editParentId > 0 ? t("common.edit") : t("common.create")}
                </h4>
                <div className="form-grid">
                  <Field label={`${t("settings.parent.name_bg")} *`}>
                    <input className="input" value={parentForm.name_bg} onChange={(e) => setP("name_bg", e.target.value)} required />
                  </Field>
                  <Field label={t("settings.parent.uic")}>
                    <input className="input" value={parentForm.uic} onChange={(e) => setP("uic", e.target.value)} />
                  </Field>
                  <Field label={t("settings.parent.name_lat")}>
                    <input className="input" value={parentForm.name_latin} onChange={(e) => setP("name_latin", e.target.value)} />
                  </Field>
                  <Field label={t("settings.country")}>
                    <input className="input" value={parentForm.country} onChange={(e) => setP("country", e.target.value)} />
                  </Field>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn" onClick={() => setShowParent(false)}>
                    {t("common.cancel")}
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {t("common.save")}
                  </button>
                </div>
              </form>
            )}
            {parents.length === 0 && <p className="muted">{t("settings.empty.parents")}</p>}
            {parents.map((p) => (
              <div className="list-item" key={p.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name_bg}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {p.uic ? `${t("settings.parent.uic")}: ${p.uic} | ` : ""}
                    {p.country}
                  </div>
                </div>
                <div className="icon-actions">
                  <IconButton
                    icon="edit"
                    title={t("common.edit")}
                    onClick={() => {
                      setEditParentId(p.id);
                      setParentForm({
                        name_bg: p.name_bg,
                        uic: p.uic ?? "",
                        name_latin: p.name_latin ?? "",
                        country: p.country || "BG",
                      });
                      setShowParent(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    title={t("common.delete")}
                    danger
                    onClick={() => delParent(p.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="card card-pad" style={{ maxWidth: 760 }}>
          <DocumentSeriesTab
            companyId={activeId}
            series={series}
            onChange={reloadRelated}
            onError={setErr}
          />
        </div>
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}
