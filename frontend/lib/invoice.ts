// Споделени типове и изчисления за фактури.

export const DOC_TYPES = ["invoice", "proforma", "debit_note", "credit_note"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const UNITS = ["бр.", "кг", "л", "м", "м2", "м3", "час", "ден", "компл.", "опак.", "услуга"];
export const VAT_RATES = ["20", "9", "0"];
export const PAY_METHODS = ["банков превод", "в брой", "карта", "компенсация", "друго"];
export const CURRENCIES = ["BGN", "EUR"];

export interface InvoiceLine {
  id?: number;
  product_id?: number;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate: string;
  net_amount: string;
  vat_amount: string;
  total_amount: string;
}

export interface InvoiceParty {
  id?: number;
  name?: string;
  eik?: string;
  vat_number?: string;
  address?: string;
  city?: string;
  mol?: string;
  iban?: string;
  bic?: string;
  contact_person?: string;
}

export interface Invoice {
  id: number;
  direction: string;
  document_type: string;
  number: string;
  issue_date: string;
  due_date?: string;
  tax_event_date?: string;
  accounting_month?: string;
  counterpart_id: number;
  currency: string;
  currency_rate?: string;
  net_amount: string;
  vat_amount: string;
  total_amount: string;
  status: string;
  payment_method?: string;
  notes?: string;
  discount_percent?: string;
  discount_amount?: string;
  vat_exemption_reason?: string;
  original_invoice_id?: number;
  journal_entry_id?: number;
  lines?: InvoiceLine[];
  counterpart?: InvoiceParty;
  company?: InvoiceParty;
}

export function emptyLine(): InvoiceLine {
  return {
    code: "",
    description: "",
    quantity: "1",
    unit: "бр.",
    unit_price: "0",
    vat_rate: "20",
    net_amount: "0.00",
    vat_amount: "0.00",
    total_amount: "0.00",
  };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function num(s: string): number {
  return parseFloat(String(s).replace(",", ".")) || 0;
}

export function calcLine(l: InvoiceLine, pricesIncludeVat: boolean): InvoiceLine {
  const q = num(l.quantity);
  const rate = num(l.vat_rate) / 100;
  let priceNet = num(l.unit_price);
  if (pricesIncludeVat) {
    priceNet = rate > 0 ? priceNet / (1 + rate) : priceNet;
  }
  const net = q * priceNet;
  const vat = net * rate;
  return {
    ...l,
    net_amount: round2(net),
    vat_amount: round2(vat),
    total_amount: round2(net + vat),
  };
}

export function calcTotals(lines: InvoiceLine[], discountPercent: string) {
  const subtotal = lines.reduce((s, l) => s + num(l.net_amount), 0);
  const discPct = num(discountPercent);
  const discount = (subtotal * discPct) / 100;
  const taxable = subtotal - discount;
  const factor = subtotal === 0 ? 0 : taxable / subtotal;
  const vat = lines.reduce((s, l) => s + num(l.vat_amount) * factor, 0);
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxable: round2(taxable),
    vat: round2(vat),
    total: round2(taxable + vat),
  };
}

export function applyDiscountToLines(lines: InvoiceLine[], discountPercent: string): InvoiceLine[] {
  const discPct = num(discountPercent);
  if (discPct === 0) return lines;
  const factor = 1 - discPct / 100;
  return lines.map((l) => {
    const net = num(l.net_amount) * factor;
    const vat = num(l.vat_amount) * factor;
    return {
      ...l,
      net_amount: round2(net),
      vat_amount: round2(vat),
      total_amount: round2(net + vat),
    };
  });
}

export function docTypeTitle(t: string): string {
  switch (t) {
    case "credit_note":
      return "КРЕДИТНО ИЗВЕСТИЕ";
    case "debit_note":
      return "ДЕБИТНО ИЗВЕСТИЕ";
    case "proforma":
      return "ПРОФОРМА ФАКТУРА";
    default:
      return "ФАКТУРА";
  }
}

export function docTypePrefix(t: string): string {
  switch (t) {
    case "credit_note":
      return "КИ-";
    case "debit_note":
      return "ДИ-";
    case "proforma":
      return "ПФ-";
    default:
      return "";
  }
}
