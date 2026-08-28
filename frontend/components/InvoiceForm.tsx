"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ListResponse, getActiveCompany } from "../lib/api";
import {
  CURRENCIES,
  Invoice,
  InvoiceLine,
  PAY_METHODS,
  VAT_RATES,
  applyDiscountToLines,
  calcLine,
  calcTotals,
  docTypeRequiresOriginal,
  docTypesFor,
  emptyLine,
  num,
  round2,
  todayIso,
} from "../lib/invoice";
import { useI18n } from "./I18nProvider";
import { UnitPicker } from "./UnitPicker";
import { UnitOfMeasure, unitLabel } from "../lib/units";
import { VatExemption, filterVatex, vatexLabel } from "../lib/vatExemptions";

interface Counterpart {
  id: number;
  name: string;
  eik: string;
  vat_number: string;
  address: string;
  city: string;
  counterpart_type?: string;
}

interface Product {
  id: number;
  name: string;
  code: string;
  unit: string;
  price: string;
  vat_rate: string;
}

interface Props {
  mode: "create" | "edit";
  invoiceId?: number;
}

export function InvoiceForm({ mode, invoiceId }: Props) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(mode === "edit");

  const [direction, setDirection] = useState("out");
  const [documentType, setDocumentType] = useState<string>("01");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [taxEventDate, setTaxEventDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [currencyRate, setCurrencyRate] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("банков превод");
  const [notes, setNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [vatExemption, setVatExemption] = useState("");
  const [originalInvoiceId, setOriginalInvoiceId] = useState("");
  const [pricesIncludeVat, setPricesIncludeVat] = useState(false);

  const [counterpartId, setCounterpartId] = useState("");
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [cpQuery, setCpQuery] = useState("");
  const [cpOpen, setCpOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [exemptions, setExemptions] = useState<VatExemption[]>([]);
  const [exQ, setExQ] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [itemOpenFor, setItemOpenFor] = useState<number | null>(null);
  const [itemQuery, setItemQuery] = useState("");

  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);

  const loadLookups = useCallback(async () => {
    try {
      const [cp, pr, inv, un, ex, co] = await Promise.all([
        api.get<ListResponse<Counterpart>>("/v1/counterparts"),
        api.get<ListResponse<Product>>("/v1/products"),
        api.get<ListResponse<Invoice>>("/v1/invoices"),
        api.get<ListResponse<UnitOfMeasure>>("/v1/units"),
        api.get<ListResponse<VatExemption>>("/v1/vat-exemptions"),
        getActiveCompany(),
      ]);
      setCounterparts(cp.items ?? []);
      setProducts(pr.items ?? []);
      setInvoices(inv.items ?? []);
      setUnits(un.items ?? []);
      setExemptions(ex.items ?? []);
      setVatRegistered(Number((co as { is_vat_registered?: number }).is_vat_registered ?? 1) === 1);
    } catch {
      /* lookup failure is non-fatal */
    }
  }, []);

  const loadNumber = useCallback(
    async (dt: string, dir: string) => {
      try {
        const data = await api.get<{ number: string }>(
          `/v1/invoices/next-number?document_type=${encodeURIComponent(dt)}&direction=${encodeURIComponent(dir)}`
        );
        setNumber(data.number);
      } catch {
        /* keep current */
      }
    },
    []
  );

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!docTypesFor(direction).includes(documentType)) {
      setDocumentType("01");
    }
  }, [direction, documentType]);

  useEffect(() => {
    if (mode === "create") loadNumber(documentType, direction);
  }, [mode, documentType, direction, loadNumber]);

  useEffect(() => {
    if (mode !== "edit" || !invoiceId) return;
    let cancelled = false;
    (async () => {
      try {
        const inv = await api.get<Invoice>(`/v1/invoices/${invoiceId}`);
        if (cancelled) return;
        setDirection(inv.direction || "out");
        setDocumentType(inv.document_type || "01");
        setNumber(inv.number);
        setIssueDate(inv.issue_date);
        setTaxEventDate(inv.tax_event_date || inv.issue_date);
        setDueDate(inv.due_date || "");
        setCurrency(inv.currency || "EUR");
        setCurrencyRate(inv.currency_rate || "1");
        setPaymentMethod(inv.payment_method || "");
        setNotes(inv.notes || "");
        setDiscountPercent(inv.discount_percent || "0");
        setVatExemption(inv.vat_exemption_reason || "");
        setOriginalInvoiceId(
          inv.original_invoice_id ? String(inv.original_invoice_id) : ""
        );
        setCounterpartId(inv.counterpart_id ? String(inv.counterpart_id) : "");
        const ls = (inv.lines ?? []).map((l) => ({
          ...emptyLine(),
          ...l,
          code: l.code || "",
          unit: l.unit || "C62",
        }));
        setLines(ls.length ? ls : [emptyLine()]);
      } catch (e) {
        if (!cancelled) setFormError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, invoiceId]);

  const selectedCp = counterparts.find((c) => String(c.id) === counterpartId);

  const pricedLines = useMemo(
    () => lines.map((l) => calcLine(l, pricesIncludeVat)),
    [lines, pricesIncludeVat]
  );
  const totals = useMemo(
    () => calcTotals(pricedLines, discountPercent),
    [pricedLines, discountPercent]
  );
  const hasZeroVat = pricedLines.some((l) => num(l.vat_rate) === 0);

  useEffect(() => {
    if (hasZeroVat && !vatRegistered && !vatExemption) {
      setVatExemption("VATEX-EU-SM");
    }
  }, [hasZeroVat, vatRegistered, vatExemption]);

  const filteredCp = counterparts.filter((c) => {
    const q = cpQuery.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.eik || "").includes(q) ||
      (c.vat_number || "").toLowerCase().includes(q)
    );
  });

  const filteredProducts = products.filter((p) => {
    const q = itemQuery.toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code || "").toLowerCase().includes(q)
    );
  });

  const setLine = (i: number, patch: Partial<InvoiceLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickProduct = (i: number, p: Product) => {
    setLine(i, {
      product_id: p.id,
      code: p.code || "",
      description: p.name,
      unit: p.unit || "C62",
      unit_price: p.price || "0",
      vat_rate: p.vat_rate || "20",
    });
    setItemOpenFor(null);
    setItemQuery("");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (!counterpartId) {
        setFormError(t("invoices.pick_counterpart"));
        setSaving(false);
        return;
      }
      if (docTypeRequiresOriginal(documentType) && !originalInvoiceId) {
        setFormError(t("invoices.need_original"));
        setSaving(false);
        return;
      }
      if (hasZeroVat && !vatExemption) {
        setFormError(t("invoices.vat_exemption_pick"));
        setSaving(false);
        return;
      }
      const computed = pricedLines.map((l) => calcLine(l, pricesIncludeVat));
      const payloadLines = applyDiscountToLines(computed, discountPercent).map(
        (l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: round2(num(l.unit_price)),
          vat_rate: l.vat_rate,
          net_amount: l.net_amount,
          vat_amount: l.vat_amount,
          total_amount: l.total_amount,
        })
      );
      const payload = {
        direction,
        document_type: documentType,
        number,
        issue_date: issueDate,
        tax_event_date: taxEventDate || issueDate,
        due_date: dueDate,
        accounting_month: issueDate.slice(0, 7),
        counterpart_id: Number(counterpartId),
        currency,
        currency_rate: currency === "EUR" ? "1" : currencyRate,
        payment_method: paymentMethod,
        notes,
        discount_percent: discountPercent || "0",
        discount_amount: totals.discount,
        vat_exemption_reason: vatExemption,
        original_invoice_id: originalInvoiceId ? Number(originalInvoiceId) : 0,
        lines: payloadLines,
      };
      if (mode === "edit" && invoiceId) {
        await api.patch(`/v1/invoices/${invoiceId}`, payload);
        router.push(`/invoices/${invoiceId}`);
      } else {
        const created = await api.post<Invoice>("/v1/invoices", payload);
        router.push(`/invoices/${created.id}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="muted">{t("common.loading")}</div>;
  }

  return (
    <form className="invoice-form" onSubmit={handleSave}>
      <section className="card invoice-section">
        <h2 className="invoice-section-title">{t("invoices.header")}</h2>
        <div className="form-grid">
          <div className="field">
            <label className="label">{t("invoices.document_type")}</label>
            <select
              className="select"
              name="document_type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              {docTypesFor(direction).map((dt) => (
                <option key={dt} value={dt}>
                  {dt === "proforma" ? "" : `${dt} — `}
                  {t(`invoices.document_type.${dt}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
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
            <label className="label">{t("invoices.number")}</label>
            <input
              className="input"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">{t("invoices.issue_date")} *</label>
            <input
              className="input"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">{t("invoices.tax_event_date")}</label>
            <input
              className="input"
              type="date"
              value={taxEventDate}
              onChange={(e) => setTaxEventDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">{t("invoices.due_date")}</label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">{t("invoices.currency")}</label>
            <select
              className="select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {currency !== "EUR" && (
            <div className="field">
              <label className="label">{t("invoices.currency_rate")}</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="input"
                  value={currencyRate}
                  onChange={(e) => setCurrencyRate(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  title={t("invoices.currency_rate_fetch_hint")}
                  onClick={async () => {
                    try {
                      const r = await api.get<{ rate: string; date: string }>(
                        `/v1/exchange-rates/rate?currency=${encodeURIComponent(currency)}&date=${encodeURIComponent(issueDate)}`
                      );
                      setCurrencyRate(r.rate);
                    } catch (err) {
                      setFormError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  {t("invoices.currency_rate_fetch")}
                </button>
              </div>
            </div>
          )}
        </div>
        {docTypeRequiresOriginal(documentType) && (
          <div className="field">
            <label className="label">{t("invoices.original_invoice")} *</label>
            <select
              className="select"
              value={originalInvoiceId}
              onChange={(e) => setOriginalInvoiceId(e.target.value)}
              required
            >
              <option value="">—</option>
              {invoices
                .filter((i) => i.document_type === "01" || i.document_type === "11")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · {i.issue_date} · {i.total_amount}
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      <section className="card invoice-section">
        <h2 className="invoice-section-title">
          {direction === "in" ? t("invoices.supplier") : t("invoices.recipient")}
        </h2>
        <button
          type="button"
          className={`btn picker-trigger${selectedCp ? "" : " picker-empty"}`}
          onClick={() => setCpOpen(true)}
        >
          {selectedCp
            ? `${selectedCp.eik ? `${selectedCp.eik} — ` : ""}${selectedCp.name}`
            : t("invoices.pick_counterpart")}
        </button>
        {selectedCp && (
          <div className="party-preview">
            <div>
              {t("counterparts.name")}: {selectedCp.name}
            </div>
            <div>
              {t("counterparts.eik")}: {selectedCp.eik || "—"}
            </div>
            <div>
              {t("counterparts.vat_number")}: {selectedCp.vat_number || "—"}
            </div>
            <div>
              {t("companies.address")}: {selectedCp.address} {selectedCp.city}
            </div>
          </div>
        )}
      </section>

      <section className="card invoice-section">
        <div className="invoice-section-head">
          <h2 className="invoice-section-title">{t("invoices.lines")}</h2>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={pricesIncludeVat}
              onChange={(e) => setPricesIncludeVat(e.target.checked)}
            />
            {t("invoices.prices_include_vat")}
          </label>
        </div>
        <div className="lines-wrap">
          <table className="table lines-table">
            <thead>
              <tr>
                <th>{t("invoices.item")}</th>
                <th>{t("invoices.qty")}</th>
                <th>{t("products.unit")}</th>
                <th>
                  {pricesIncludeVat
                    ? t("invoices.price_with_vat")
                    : t("invoices.unit_price")}
                </th>
                <th>{t("products.vat_rate")}</th>
                <th>{t("invoices.line_total")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pricedLines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <button
                      type="button"
                      className={`btn picker-trigger${l.description ? "" : " picker-empty"}`}
                      onClick={() => {
                        setItemOpenFor(i);
                        setItemQuery("");
                      }}
                    >
                      {l.description
                        ? `${l.code ? `${l.code} — ` : ""}${l.description}`
                        : t("invoices.pick_item")}
                    </button>
                    <input
                      className="input"
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                      placeholder={t("journal.description")}
                    />
                    {num(l.vat_rate) === 0 && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {t("invoices.zero_vat_hint")}
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      className="input"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                    />
                  </td>
                  <td>
                    <UnitPicker
                      compact
                      value={l.unit || "C62"}
                      onChange={(unit) => setLine(i, { unit })}
                      units={units}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={l.unit_price}
                      onChange={(e) => setLine(i, { unit_price: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="select"
                      value={l.vat_rate}
                      onChange={(e) => setLine(i, { vat_rate: e.target.value })}
                    >
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">{l.net_amount}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        setLines((prev) =>
                          prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev
                        )
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          + {t("invoices.add_line")}
        </button>
      </section>

      <section className="card invoice-section">
        <h2 className="invoice-section-title">{t("invoices.totals_section")}</h2>
        <div className="form-grid">
          <div className="field">
            <label className="label">{t("invoices.payment_method")}</label>
            <select
              className="select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">{t("invoices.discount_percent")}</label>
            <input
              className="input"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label">{t("invoices.notes")}</label>
            <textarea
              className="textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {hasZeroVat && (
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("invoices.vat_exemption")} *</label>
              <input
                className="input"
                value={exQ}
                onChange={(e) => setExQ(e.target.value)}
                placeholder={t("invoices.vat_exemption_search")}
              />
              <select
                className="select"
                value={vatExemption}
                onChange={(e) => setVatExemption(e.target.value)}
                required
                style={{ marginTop: 6 }}
                size={6}
              >
                <option value="">{t("invoices.vat_exemption_pick")}</option>
                {filterVatex(exemptions, exQ).map((e) => (
                  <option key={e.code} value={e.code}>
                    {vatexLabel(e, lang)}
                  </option>
                ))}
                {vatExemption &&
                  !exemptions.some((e) => e.code === vatExemption) && (
                    <option value={vatExemption}>{vatExemption}</option>
                  )}
              </select>
            </div>
          )}
        </div>
        <div className="totals-box">
          <div>
            <span>{t("invoices.subtotal")}</span>
            <b>
              {totals.subtotal} {currency}
            </b>
          </div>
          <div>
            <span>{t("invoices.discount")}</span>
            <b>
              {totals.discount} {currency}
            </b>
          </div>
          <div>
            <span>{t("invoices.taxable")}</span>
            <b>
              {totals.taxable} {currency}
            </b>
          </div>
          <div>
            <span>{t("invoices.vat")}</span>
            <b>
              {totals.vat} {currency}
            </b>
          </div>
          <div className="totals-grand">
            <span>{t("invoices.amount_due")}</span>
            <b>
              {totals.total} {currency}
            </b>
          </div>
        </div>
      </section>

      {formError && <div className="error-text">{formError}</div>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={() => router.push("/invoices")}>
          {t("common.cancel")}
        </button>
        <button className="btn btn-primary" disabled={saving}>
          {t("common.save")}
        </button>
      </div>

      {cpOpen && (
        <div className="modal-backdrop" onClick={() => setCpOpen(false)}>
          <div className="card modal picker-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t("invoices.pick_counterpart")}</h2>
            <input
              className="input"
              autoFocus
              value={cpQuery}
              onChange={(e) => setCpQuery(e.target.value)}
              placeholder={t("invoices.search")}
            />
            <div className="picker-list">
              {filteredCp.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="picker-item"
                  onClick={() => {
                    setCounterpartId(String(c.id));
                    setCpOpen(false);
                    setCpQuery("");
                  }}
                >
                  <b>{c.name}</b>
                  <span className="muted">
                    {c.eik} {c.vat_number}
                  </span>
                </button>
              ))}
              {filteredCp.length === 0 && (
                <div className="muted">{t("common.empty")}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {itemOpenFor !== null && (
        <div className="modal-backdrop" onClick={() => setItemOpenFor(null)}>
          <div className="card modal picker-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t("invoices.pick_item")}</h2>
            <input
              className="input"
              autoFocus
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder={t("invoices.search")}
            />
            <div className="picker-list">
              {filteredProducts.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="picker-item"
                  onClick={() => pickProduct(itemOpenFor, p)}
                >
                  <b>
                    {p.code ? `${p.code} — ` : ""}
                    {p.name}
                  </b>
                  <span className="muted">
                    {p.price} / {unitLabel(p.unit || "C62", units)} · ДДС {p.vat_rate}%
                  </span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="muted">{t("common.empty")}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
