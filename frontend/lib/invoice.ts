// Споделени типове и изчисления за фактури.

// Видове данъчни документи — кодове по ППДДС. Проформата не е данъчен документ.
export const DOC_TYPES_COMMON = [
  "01",
  "02",
  "03",
  "07",
  "09",
  "11",
  "12",
  "13",
] as const;
export const DOC_TYPES_OUT = [
  ...DOC_TYPES_COMMON,
  "04",
  "81",
  "82",
  "23",
  "29",
  "50",
  "83",
  "84",
  "85",
  "91",
  "93",
  "94",
  "95",
] as const;
export const DOC_TYPES_IN = [
  ...DOC_TYPES_COMMON,
  "05",
  "23",
  "91",
  "92",
  "93",
  "94",
] as const;
export const DOC_TYPE_PROFORMA = "proforma";

export function docTypesFor(direction: string): string[] {
  const base = direction === "in" ? [...DOC_TYPES_IN] : [...DOC_TYPES_OUT];
  return [DOC_TYPE_PROFORMA, ...base];
}

export function docTypeRequiresOriginal(t: string): boolean {
  return t === "02" || t === "03" || t === "12" || t === "13" || t === "23";
}

export function docTypeIsProforma(t: string): boolean {
  return t === DOC_TYPE_PROFORMA;
}

export const UNITS = ["бр.", "кг", "л", "м", "м2", "м3", "час", "ден", "компл.", "опак.", "услуга"];
export const VAT_RATES = ["20", "9", "0"];
export const PAY_METHODS = ["банков превод", "в брой", "карта", "компенсация", "друго"];
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "BGN", "RON", "PLN", "TRY", "JPY", "CNY"];

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
    case "02":
      return "ДЕБИТНО ИЗВЕСТИЕ";
    case "03":
      return "КРЕДИТНО ИЗВЕСТИЕ";
    case "04":
    case "05":
      return "РЕГИСТЪР НА СТОКИ ПОД РЕЖИМ СКЛАДИРАНЕ ДО ПОИСКВАНЕ";
    case "07":
      return "МИТНИЧЕСКА ДЕКЛАРАЦИЯ";
    case "09":
      return "ПРОТОКОЛ";
    case "11":
      return "ФАКТУРА - КАСОВА ОТЧЕТНОСТ";
    case "12":
      return "ДЕБИТНО ИЗВЕСТИЕ - КАСОВА ОТЧЕТНОСТ";
    case "13":
      return "КРЕДИТНО ИЗВЕСТИЕ - КАСОВА ОТЧЕТНОСТ";
    case "23":
      return "КРЕДИТНО ИЗВЕСТИЕ ПО ЧЛ. 126Б, АЛ. 1 ОТ ЗДДС";
    case "29":
      return "ПРОТОКОЛ ПО ЧЛ. 126Б, АЛ. 2 И 7 ОТ ЗДДС";
    case "81":
    case "83":
    case "84":
    case "85":
      return "ОТЧЕТ ЗА ИЗВЪРШЕНИТЕ ПРОДАЖБИ";
    case "82":
      return "ОТЧЕТ ЗА ПРОДАЖБИ ПРИ СПЕЦИАЛЕН РЕД НА ОБЛАГАНЕ";
    case "proforma":
      return "ПРОФОРМА ФАКТУРА";
    default:
      return "ФАКТУРА";
  }
}

export function docTypePrefix(t: string): string {
  switch (t) {
    case "02":
    case "12":
      return "ДИ-";
    case "03":
    case "13":
    case "23":
      return "КИ-";
    case "proforma":
      return "ПФ-";
    default:
      return "";
  }
}
