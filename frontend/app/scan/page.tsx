"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../components/RequireAuth";
import { useI18n } from "../../components/I18nProvider";
import { IconButton } from "../../components/IconButton";
import { api, ListResponse } from "../../lib/api";
import {
  CURRENCIES,
  Invoice,
  InvoiceLine,
  VAT_RATES,
  calcLine,
  calcTotals,
  docTypesFor,
  emptyLine,
  num,
  round2,
  todayIso,
} from "../../lib/invoice";

interface Counterpart {
  id: number;
  name: string;
  eik: string;
  vat_number: string;
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

interface ScanLine {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate: string;
  net_amount: string;
  vat_amount: string;
  total_amount: string;
  product_id?: number;
}

interface ScanExtract {
  direction: string;
  filename: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  document_type: string;
  counterpart_name: string;
  counterpart_eik: string;
  counterpart_vat_number: string;
  currency: string;
  total_net_amount: string;
  total_vat_amount: string;
  total_amount: string;
  lines: ScanLine[];
  counterpart_id?: number;
  counterpart?: Counterpart;
}

interface ViesLookup {
  valid: boolean | number;
  name: string;
  address: string;
}

interface QueuedFile {
  id: string;
  file: File;
}

const MAX_BYTES = 8 * 1024 * 1024;

function monthNow(): string {
  return todayIso().slice(0, 7);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function lineFromScan(s: ScanLine): InvoiceLine {
  const base: InvoiceLine = {
    ...emptyLine(),
    description: s.description || "",
    quantity: s.quantity || "1",
    unit: s.unit || "C62",
    unit_price: s.unit_price || "0",
    vat_rate: s.vat_rate || "20",
    product_id: s.product_id,
  };
  if (s.net_amount && s.vat_amount && s.total_amount) {
    return {
      ...base,
      net_amount: s.net_amount,
      vat_amount: s.vat_amount,
      total_amount: s.total_amount,
    };
  }
  return calcLine(base, false);
}

function ScanInner() {
  const { t } = useI18n();
  const router = useRouter();
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [period, setPeriod] = useState(monthNow);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<0 | 1>(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [activeName, setActiveName] = useState("");

  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState("");
  const [documentType, setDocumentType] = useState("01");
  const [currency, setCurrency] = useState("EUR");
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [counterpartId, setCounterpartId] = useState("");
  const [ocrName, setOcrName] = useState("");
  const [ocrEik, setOcrEik] = useState("");
  const [ocrVat, setOcrVat] = useState("");
  const [vies, setVies] = useState<ViesLookup | null>(null);
  const [itemOpenFor, setItemOpenFor] = useState<number | null>(null);
  const [itemQuery, setItemQuery] = useState("");

  const loadLookups = useCallback(async () => {
    try {
      const [cp, pr] = await Promise.all([
        api.get<ListResponse<Counterpart>>("/v1/counterparts"),
        api.get<ListResponse<Product>>("/v1/products"),
      ]);
      setCounterparts(cp.items ?? []);
      setProducts(pr.items ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const addFiles = (list: FileList | File[]) => {
    const next: QueuedFile[] = [];
    for (const file of Array.from(list)) {
      const name = file.name.toLowerCase();
      const ok =
        name.endsWith(".pdf") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png") ||
        file.type === "application/pdf" ||
        file.type.startsWith("image/");
      if (!ok) {
        setError(t("scan.need_file"));
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(t("scan.too_big"));
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file });
    }
    if (next.length) {
      setQueue((prev) => {
        const seen = new Set(prev.map((q) => q.id));
        return [...prev, ...next.filter((n) => !seen.has(n.id))];
      });
      setError("");
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const productById = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const priced = useMemo(
    () => lines.map((l) => calcLine(l, false)),
    [lines]
  );
  const totals = useMemo(() => calcTotals(priced, "0"), [priced]);

  const filteredProducts = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q)
    );
  }, [products, itemQuery]);

  const setLine = (i: number, patch: Partial<InvoiceLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const openProductPicker = (i: number) => {
    const scanned = lines[i]?.description || "";
    setItemOpenFor(i);
    setItemQuery(scanned);
  };

  const pickProduct = (i: number, p: Product) => {
    setLine(i, {
      product_id: p.id,
      code: p.code || "",
      unit: p.unit || "C62",
      vat_rate: p.vat_rate || "20",
    });
    setItemOpenFor(null);
    setItemQuery("");
  };

  const clearProduct = (i: number) => {
    setLine(i, { product_id: undefined, code: "" });
  };

  const runExtract = async (item: QueuedFile) => {
    setBusy(t("scan.running"));
    setError("");
    setActiveName(item.file.name);
    try {
      const content_base64 = await fileToBase64(item.file);
      const data = await api.post<ScanExtract>("/v1/scans/extract", {
        filename: item.file.name,
        mime: item.file.type || "",
        content_base64,
        direction,
      });
      setNumber(data.invoice_number || "");
      setIssueDate(data.issue_date || todayIso());
      setDueDate(data.due_date || "");
      setDocumentType(data.document_type || "01");
      setCurrency(data.currency || "EUR");
      setOcrName(data.counterpart_name || "");
      setOcrEik(data.counterpart_eik || "");
      setOcrVat(data.counterpart_vat_number || "");
      setCounterpartId(data.counterpart_id ? String(data.counterpart_id) : "");
      const mapped = (data.lines ?? []).map(lineFromScan);
      setLines(mapped.length ? mapped : [emptyLine()]);
      setVies(null);
      const vat = (data.counterpart_vat_number || "").replace(/\s/g, "");
      if (vat.length >= 4) {
        try {
          const v = await api.get<ViesLookup>(
            `/v1/counterparts/vies-lookup?vat=${encodeURIComponent(vat)}`
          );
          setVies(v);
        } catch {
          setVies(null);
        }
      }
      setStage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const createCounterpart = async () => {
    setBusy(t("scan.saving"));
    setError("");
    try {
      const ctype = direction === "in" ? "supplier" : "customer";
      const vat = ocrVat.replace(/\s/g, "");
      let created: Counterpart;
      if (vat.length >= 4 && vies && (vies.valid === true || vies.valid === 1)) {
        created = await api.post<Counterpart>("/v1/counterparts/vies", {
          vat_number: vat,
          counterpart_type: ctype,
        });
      } else {
        created = await api.post<Counterpart>("/v1/counterparts", {
          name: ocrName || vat || ocrEik || t("scan.counterpart"),
          eik: ocrEik,
          vat_number: vat,
          counterpart_type: ctype,
        });
      }
      setCounterparts((prev) => [...prev, created]);
      setCounterpartId(String(created.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const saveDraft = async () => {
    if (!counterpartId) {
      setError(t("scan.need_counterpart"));
      return;
    }
    if (direction === "in" && !number.trim()) {
      setError(t("scan.need_number"));
      return;
    }
    const computed = priced;
    if (!computed.length) {
      setError(t("scan.no_lines"));
      return;
    }
    setBusy(t("scan.saving"));
    setError("");
    try {
      const payloadLines = computed.map((l) => ({
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: round2(num(l.unit_price)),
        vat_rate: l.vat_rate,
        net_amount: l.net_amount,
        vat_amount: l.vat_amount,
        total_amount: l.total_amount,
      }));
      const created = await api.post<Invoice>("/v1/invoices", {
        direction,
        document_type: documentType,
        number,
        issue_date: issueDate,
        tax_event_date: issueDate,
        due_date: dueDate,
        accounting_month: period || issueDate.slice(0, 7),
        counterpart_id: Number(counterpartId),
        currency,
        currency_rate: currency === "EUR" ? "1" : "1",
        payment_method: "банков превод",
        notes: activeName ? `${t("scan.scanned_from")}: ${activeName}` : "",
        discount_percent: "0",
        discount_amount: "0",
        vat_exemption_reason: "",
        original_invoice_id: 0,
        lines: payloadLines,
      });
      const mapItems = computed
        .filter((l) => l.product_id && l.description)
        .map((l) => ({
          scanned_name: l.description,
          product_id: l.product_id,
        }));
      if (mapItems.length) {
        await api.post("/v1/product-name-mappings", {
          counterpart_id: Number(counterpartId),
          items: mapItems,
        });
      }
      setQueue((prev) => prev.filter((q) => q.file.name !== activeName));
      router.push(`/invoices/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const found = counterparts.find((c) => String(c.id) === counterpartId);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{t("scan.title")}</h1>
        {stage === 1 && (
          <button
            className="btn"
            onClick={() => {
              setStage(0);
              setError("");
            }}
          >
            {t("scan.back_list")}
          </button>
        )}
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        {t("scan.hint")}
      </p>
      {error && <div className="flash-err">{error}</div>}
      {busy && (
        <div className="card content" style={{ textAlign: "center", padding: 40 }}>
          <p>{busy}</p>
        </div>
      )}

      {!busy && stage === 0 && (
        <div className="scan-grid">
          <section className="card" style={{ padding: 16 }}>
            <h2 className="invoice-section-title">{t("scan.upload")}</h2>
            <div className="field">
              <span className="label">{t("scan.type")}</span>
              <div className="scan-toggle">
                <button
                  className={`btn${direction === "in" ? " btn-primary" : ""}`}
                  onClick={() => setDirection("in")}
                >
                  {t("scan.purchases")}
                </button>
                <button
                  className={`btn${direction === "out" ? " btn-primary" : ""}`}
                  onClick={() => setDirection("out")}
                >
                  {t("scan.sales")}
                </button>
              </div>
            </div>
            <div className="field">
              <label className="label">{t("scan.period")}</label>
              <input
                className="input"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <label
              className={`drop-zone${dragging ? " drop-zone-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="drop-zone-icon">📁</div>
              <div>{t("scan.drop")}</div>
              <div className="muted">{t("scan.drop_or")}</div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                multiple
                hidden
                onChange={onInput}
              />
            </label>
          </section>
          <section className="card" style={{ padding: 16 }}>
            <h2 className="invoice-section-title">{t("scan.queue")}</h2>
            {queue.length === 0 ? (
              <p className="muted">{t("scan.empty_queue")}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("scan.file")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queue.map((q) => (
                    <tr key={q.id}>
                      <td>{q.file.name}</td>
                      <td className="icon-actions" style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => runExtract(q)}
                        >
                          {t("scan.run")}
                        </button>
                        <IconButton
                          icon="delete"
                          title={t("common.delete")}
                          danger
                          onClick={() =>
                            setQueue((prev) => prev.filter((x) => x.id !== q.id))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {!busy && stage === 1 && (
        <>
          <section className="card invoice-section">
            <h2 className="invoice-section-title">{t("scan.header")}</h2>
            <div className="form-grid">
              <div className="field">
                <label className="label">{t("invoices.document_type")}</label>
                <select
                  className="select"
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
              <div className="field">
                <label className="label">{t("scan.number")}</label>
                <input
                  className="input"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">{t("scan.date")}</label>
                <input
                  className="input"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">{t("scan.due")}</label>
                <input
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">{t("scan.currency")}</label>
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
            </div>
          </section>

          <section className="card invoice-section">
            <h2 className="invoice-section-title">{t("scan.counterpart")}</h2>
            <div className="form-grid">
              <div className="field">
                <label className="label">{t("scan.ocr_name")}</label>
                <input
                  className="input"
                  value={ocrName}
                  onChange={(e) => setOcrName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">{t("scan.eik")}</label>
                <input
                  className="input"
                  value={ocrEik}
                  onChange={(e) => setOcrEik(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">{t("scan.vat_no")}</label>
                <input
                  className="input"
                  value={ocrVat}
                  onChange={(e) => setOcrVat(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label">{t("scan.pick_existing")}</label>
                <select
                  className="select"
                  value={counterpartId}
                  onChange={(e) => setCounterpartId(e.target.value)}
                >
                  <option value="">{t("invoices.pick_counterpart")}</option>
                  {counterparts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.eik ? ` (${c.eik})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {found ? (
              <div className="flash-ok">
                {t("scan.found")}: {found.name}
              </div>
            ) : (
              <div className="flash-err" style={{ display: "block" }}>
                <div>{t("scan.not_found")}</div>
                <button className="btn btn-primary btn-sm" onClick={createCounterpart}>
                  {direction === "in" ? t("scan.add_supplier") : t("scan.add_customer")}
                </button>
              </div>
            )}
            {vies && (vies.valid === true || vies.valid === 1) && (
              <div className="flash-ok">
                {t("scan.vies_ok")}
                {vies.name ? ` — ${vies.name}` : ""}
              </div>
            )}
            {vies && vies.valid !== true && vies.valid !== 1 && (
              <div className="flash-err">{t("scan.vies_fail")}</div>
            )}
          </section>

          <section className="card invoice-section">
            <h2 className="invoice-section-title">{t("scan.lines")}</h2>
            <div className="lines-wrap">
              <table className="table lines-table">
                <thead>
                  <tr>
                    <th>{t("scan.scanned_name")}</th>
                    <th>{t("scan.our_product")}</th>
                    <th>{t("scan.qty")}</th>
                    <th>{t("scan.price")}</th>
                    <th>{t("scan.vat_rate")}</th>
                    <th>{t("scan.line_total")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {priced.map((l, i) => {
                    const mapped = l.product_id
                      ? productById.get(l.product_id)
                      : undefined;
                    return (
                      <tr key={i}>
                        <td>
                          <input
                            className="input"
                            value={l.description}
                            onChange={(e) =>
                              setLine(i, { description: e.target.value })
                            }
                          />
                        </td>
                        <td style={{ minWidth: 220 }}>
                          <button
                            type="button"
                            className={`btn picker-trigger${mapped ? "" : " picker-empty"}`}
                            onClick={() => openProductPicker(i)}
                          >
                            {mapped
                              ? `${mapped.code ? `${mapped.code} — ` : ""}${mapped.name}`
                              : t("scan.pick_product")}
                          </button>
                          {mapped && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => clearProduct(i)}
                            >
                              {t("scan.clear_product")}
                            </button>
                          )}
                        </td>
                        <td>
                          <input
                            className="input"
                            value={l.quantity}
                            onChange={(e) =>
                              setLine(i, { quantity: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={l.unit_price}
                            onChange={(e) =>
                              setLine(i, { unit_price: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="select"
                            value={l.vat_rate}
                            onChange={(e) =>
                              setLine(i, { vat_rate: e.target.value })
                            }
                          >
                            {VAT_RATES.map((r) => (
                              <option key={r} value={r}>
                                {r}%
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="num">
                          {l.total_amount} {currency}
                        </td>
                        <td>
                          <IconButton
                            icon="delete"
                            title={t("common.delete")}
                            danger
                            onClick={() =>
                              setLines((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              + {t("invoices.add_line")}
            </button>
            <p className="muted" style={{ marginTop: 12 }}>
              {t("invoices.total")}: {totals.total} {currency}
            </p>
          </section>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={saveDraft}>
              {t("scan.save_draft")}
            </button>
          </div>

          {itemOpenFor !== null && (
            <div
              className="modal-backdrop"
              onClick={() => {
                setItemOpenFor(null);
                setItemQuery("");
              }}
            >
              <div
                className="card modal picker-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="modal-title">{t("scan.our_product")}</h2>
                <p className="muted" style={{ marginTop: -8 }}>
                  {t("scan.pick_hint")}
                  {lines[itemOpenFor]?.description
                    ? ` — ${lines[itemOpenFor].description}`
                    : ""}
                </p>
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
                        {p.price} · ДДС {p.vat_rate}%
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
        </>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <RequireAuth>
      <ScanInner />
    </RequireAuth>
  );
}
