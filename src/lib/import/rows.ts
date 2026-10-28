import type { BillingPeriod, Category, PaymentType } from "@/lib/types";

export type ImportAction = "create" | "edit" | "pay";
export type ImportSource = "csv" | "json" | "ai";

/**
 * One reviewable row in the bulk import grid. Numbers stay as strings while the
 * user edits so half-typed values ("12.") do not get coerced away.
 */
export type ImportRow = {
  rowKey: string;
  source: ImportSource;
  action: ImportAction;
  targetItemId: number | null;
  name: string;
  categoryId: number | null;
  paymentType: PaymentType;
  amountInput: string;
  currency: string;
  billingStartAt: string;
  billingEndAt: string;
  period: BillingPeriod | null;
  customPeriodDaysInput: string;
  vendorName: string;
  vendorUrl: string;
  accountName: string;
  notes: string;
  customFields: Record<string, unknown>;
  shiftDates: boolean;
  shiftPaymentPeriod: boolean;
  hint: string;
};

export type TabularParseResult = {
  format: "csv" | "tsv" | "json";
  rows: ImportRow[];
  mappedColumns: Record<string, string>;
  unmappedColumns: string[];
};

const PERIODS: BillingPeriod[] = ["7d", "1m", "3m", "1y", "custom"];

export function blankImportRow(rowKey: string, source: ImportSource, categoryId: number | null = null): ImportRow {
  return {
    rowKey,
    source,
    action: "create",
    targetItemId: null,
    name: "",
    categoryId,
    paymentType: "recurring",
    amountInput: "",
    currency: "USD",
    billingStartAt: "",
    billingEndAt: "",
    period: "1m",
    customPeriodDaysInput: "30",
    vendorName: "",
    vendorUrl: "",
    accountName: "",
    notes: "",
    customFields: {},
    shiftDates: true,
    shiftPaymentPeriod: false,
    hint: "",
  };
}

// Column header aliases. Headers are compared after lowercasing and stripping
// everything except letters and digits, so "Billing End", "billing_end_at" and
// "billingEndAt" all collapse to the same key.
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "title", "item", "entry", "service", "resource", "domain", "server", "hostname", "host", "subscription", "product", "description"],
  amount: ["amount", "price", "cost", "total", "sum", "fee", "value", "monthly", "charge"],
  currency: ["currency", "curr", "ccy"],
  paymentType: ["paymenttype", "type", "billingtype", "recurring"],
  period: ["period", "billingperiod", "interval", "cycle", "billingcycle", "frequency", "renewal", "term"],
  customPeriodDays: ["customperioddays", "perioddays", "days"],
  billingStartAt: ["billingstartat", "start", "startdate", "startedat", "purchased", "purchasedate", "registered", "registrationdate", "created", "paidat", "paymentdate", "from"],
  billingEndAt: ["billingendat", "end", "enddate", "expiry", "expires", "expiresat", "expiration", "expirationdate", "renewaldate", "nextpayment", "due", "duedate", "until", "to", "paiduntil"],
  vendorName: ["vendorname", "vendor", "provider", "registrar", "host", "hosting", "supplier", "company", "merchant"],
  vendorUrl: ["vendorurl", "url", "link", "website", "site", "panel", "loginurl"],
  accountName: ["accountname", "account", "login", "username", "user", "email"],
  category: ["category", "categoryname", "group", "kind"],
  notes: ["notes", "note", "comment", "comments", "memo", "remarks"],
};

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapHeaders(headers: string[], categories: Category[]) {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  const customFieldIds = new Map<string, string>();
  categories.forEach((category) => category.fields.forEach((field) => {
    customFieldIds.set(headerKey(field.id), field.id);
    customFieldIds.set(headerKey(field.label), field.id);
  }));

  // Exact alias matches win before custom fields so "url" maps to vendorUrl, but
  // a header like "IP address" can still land in a category's custom field.
  headers.forEach((header) => {
    const key = headerKey(header);
    const target = Object.entries(COLUMN_ALIASES).find(([field, aliases]) => !used.has(field) && aliases.includes(key))?.[0];
    if (target) {
      mapping[header] = target;
      used.add(target);
    }
  });
  headers.forEach((header) => {
    if (mapping[header]) return;
    const fieldId = customFieldIds.get(headerKey(header));
    if (fieldId) mapping[header] = `customFields.${fieldId}`;
  });
  return mapping;
}

/** Splits delimited text, honouring double-quoted cells with embedded delimiters, quotes and newlines. */
export function splitDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && !cell.trim()) {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 6).join("\n");
  for (const delimiter of ["\t", ";", ",", "|"]) {
    // Quote-aware split so "$12,50" style cells do not skew the column count.
    const counts = splitDelimited(sample, delimiter).map((cells) => cells.length);
    if (counts.length >= 2 && counts[0] > 1 && counts.every((count) => count === counts[0])) return delimiter;
  }
  return null;
}

function normalizeDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // Day-first is the common format for this app's users (dates render en-GB).
  const dayFirst = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirst) {
    const [, a, b, year] = dayFirst;
    const [day, month] = Number(a) > 12 || Number(b) <= 12 ? [a, b] : [b, a];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function parseAmount(value: unknown) {
  if (typeof value === "number") return { amount: String(value), currency: "" };
  const raw = String(value ?? "").trim();
  if (!raw) return { amount: "", currency: "" };
  const symbol = raw.match(/[$€£₽]/)?.[0];
  // Only treat three letters as a currency code when they sit next to a number ("4.5 EUR", "USD 10").
  const codeMatch = raw.match(/\d\s*([A-Za-z]{3})\b/) || raw.match(/\b([A-Za-z]{3})\s*\d/);
  const code = codeMatch?.[1]?.toUpperCase() || "";
  const symbolCurrency = symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : symbol === "₽" ? "RUB" : "";
  let numeric = raw.replace(/[^\d.,-]/g, "");
  // "1.234,56" or "12,50": treat the last comma as a decimal separator.
  if (numeric.includes(",") && (!numeric.includes(".") || numeric.lastIndexOf(",") > numeric.lastIndexOf("."))) {
    numeric = numeric.replace(/\./g, "").replace(",", ".");
  } else {
    numeric = numeric.replace(/,/g, "");
  }
  return { amount: numeric, currency: code || symbolCurrency };
}

function parsePeriod(value: unknown): { period: BillingPeriod | null; days: string; recurring: boolean | null } {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return { period: null, days: "", recurring: null };
  if (PERIODS.includes(raw as BillingPeriod)) return { period: raw as BillingPeriod, days: "", recurring: true };
  if (/(one[- ]?time|single|once|lifetime|разов)/.test(raw)) return { period: null, days: "", recurring: false };
  if (/(week|7 ?d|нед)/.test(raw)) return { period: "7d", days: "", recurring: true };
  if (/(quarter|3 ?m|квартал)/.test(raw)) return { period: "3m", days: "", recurring: true };
  if (/(year|annual|12 ?m|1 ?y|год)/.test(raw)) return { period: "1y", days: "", recurring: true };
  if (/(month|1 ?m|мес)/.test(raw)) return { period: "1m", days: "", recurring: true };
  const days = raw.match(/(\d+)\s*(d|day|дн)/)?.[1];
  if (days) return { period: "custom", days, recurring: true };
  return { period: null, days: "", recurring: null };
}

function findCategoryId(value: unknown, categories: Category[]) {
  const key = headerKey(String(value ?? ""));
  if (!key) return null;
  return categories.find((category) => headerKey(category.name) === key)?.id ?? null;
}

function rowFromRecord(record: Record<string, unknown>, mapping: Record<string, string>, categories: Category[], rowKey: string, source: ImportSource, defaultCategoryId: number | null) {
  const row = blankImportRow(rowKey, source, defaultCategoryId);
  const extra: string[] = [];
  let periodValue: unknown;
  let typeValue: unknown;

  Object.entries(record).forEach(([column, value]) => {
    const target = mapping[column];
    const text = typeof value === "string" ? value.trim() : value;
    if (text === "" || text === null || text === undefined) return;
    if (!target) {
      extra.push(`${column}: ${String(text)}`);
      return;
    }
    if (target.startsWith("customFields.")) {
      row.customFields[target.slice("customFields.".length)] = text;
      return;
    }
    switch (target) {
      case "amount": {
        const parsed = parseAmount(text);
        row.amountInput = parsed.amount;
        if (parsed.currency && !Object.values(mapping).includes("currency")) row.currency = parsed.currency;
        break;
      }
      case "currency":
        row.currency = String(text).trim().toUpperCase().slice(0, 3) || "USD";
        break;
      case "period":
        periodValue = text;
        break;
      case "paymentType":
        typeValue = text;
        break;
      case "customPeriodDays":
        row.customPeriodDaysInput = String(text);
        break;
      case "billingStartAt":
      case "billingEndAt":
        row[target] = normalizeDate(text);
        break;
      case "category": {
        const categoryId = findCategoryId(text, categories);
        if (categoryId) row.categoryId = categoryId;
        else extra.push(`${column}: ${String(text)}`);
        break;
      }
      case "name":
      case "vendorName":
      case "vendorUrl":
      case "accountName":
      case "notes":
        row[target] = String(text);
        break;
    }
  });

  const period = parsePeriod(periodValue);
  const typeText = String(typeValue ?? "").toLowerCase();
  const recurring = /single|one|разов|false|no/.test(typeText) ? false : /recur|true|yes|регул/.test(typeText) ? true : period.recurring;
  if (recurring === false) {
    row.paymentType = "single";
    row.period = null;
  } else {
    row.paymentType = "recurring";
    row.period = period.period || "1m";
    if (period.days) row.customPeriodDaysInput = period.days;
  }
  if (row.vendorUrl && !/^https?:\/\//i.test(row.vendorUrl) && row.vendorUrl.includes(".")) {
    row.vendorUrl = `https://${row.vendorUrl}`;
  }
  if (extra.length) row.notes = [row.notes, ...extra].filter(Boolean).join("\n");
  return row;
}

type JsonEntry = Record<string, unknown>;

// Bookkeeping keys from this app's own exports that should not land in notes.
const JSON_SYSTEM_KEYS = new Set(["id", "categoryId", "categoryIcon", "categoryColor", "workspaceId", "ownerId", "archivedAt", "createdAt", "updatedAt", "customFields"]);

function jsonRecords(value: unknown): JsonEntry[] | null {
  if (Array.isArray(value)) return value.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) ? (value as JsonEntry[]) : null;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    // Workspace exports and common wrappers ({ entries: [...] }, { items: [...] }, { data: [...] }).
    for (const key of ["entries", "items", "data", "rows", "records"]) {
      if (Array.isArray(object[key])) return jsonRecords(object[key]);
    }
    return [object];
  }
  return null;
}

/**
 * Deterministically parses CSV/TSV/JSON input into import rows. Returns null when
 * the text is not tabular, in which case the caller should fall back to the AI parser.
 */
export function parseTabularInput(text: string, categories: Category[], defaultCategoryId: number | null = null): TabularParseResult | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const records = jsonRecords(JSON.parse(trimmed));
      if (!records?.length) return null;
      const headers = [...new Set(records.flatMap((record) => Object.keys(record)))].filter((key) => !JSON_SYSTEM_KEYS.has(key));
      const mapping = mapHeaders(headers, categories);
      // JSON objects from this app's export put custom fields under customFields.
      const rows = records.map((record, index) => {
        const rest = Object.fromEntries(Object.entries(record).filter(([key]) => !JSON_SYSTEM_KEYS.has(key)));
        const customFields = record.customFields as Record<string, unknown> | undefined;
        const row = rowFromRecord(rest, mapping, categories, `json-${index + 1}`, "json", defaultCategoryId);
        if (customFields && typeof customFields === "object") row.customFields = { ...row.customFields, ...customFields };
        if (typeof record.categoryId === "number" && categories.some((category) => category.id === record.categoryId)) row.categoryId = record.categoryId;
        return row;
      });
      if (!Object.values(mapping).includes("name")) return null;
      return {
        format: "json",
        rows,
        mappedColumns: mapping,
        unmappedColumns: headers.filter((header) => !mapping[header]),
      };
    } catch {
      return null;
    }
  }

  const delimiter = detectDelimiter(trimmed);
  if (!delimiter) return null;
  const [headers, ...body] = splitDelimited(trimmed, delimiter);
  if (!headers || !body.length) return null;
  const mapping = mapHeaders(headers, categories);
  const mappedTargets = Object.values(mapping);
  // Require a recognisable header row with a name and at least one other field;
  // headerless pastes go to the AI parser which can infer columns from content.
  if (!mappedTargets.includes("name") || mappedTargets.length < 2) return null;

  const rows = body.map((cells, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, cells[column] ?? ""]));
    return rowFromRecord(record, mapping, categories, `csv-${index + 1}`, "csv", defaultCategoryId);
  });
  return {
    format: delimiter === "\t" ? "tsv" : "csv",
    rows,
    mappedColumns: mapping,
    unmappedColumns: headers.filter((header) => !mapping[header]),
  };
}

export type ImportRowErrors = Record<string, string>;

function validHttpUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateImportRow(row: ImportRow, categories: Category[], currencyCodes: string[], ru = false): ImportRowErrors {
  const tx = (en: string, ruText: string) => (ru ? ruText : en);
  const errors: ImportRowErrors = {};
  const category = categories.find((candidate) => candidate.id === row.categoryId);
  const amount = Number(row.amountInput);

  if (row.action !== "pay" && !row.name.trim()) errors.name = tx("Name is required.", "Укажите название.");
  if (!row.amountInput.trim() || !Number.isFinite(amount) || amount < 0) errors.amount = tx("Enter a valid amount.", "Введите корректную сумму.");
  if (!currencyCodes.includes(row.currency)) errors.currency = tx("Unsupported currency.", "Валюта не поддерживается.");
  if (row.categoryId && !category) errors.categoryId = tx("Unknown category.", "Неизвестная категория.");
  if (row.action !== "create" && !row.targetItemId) errors.id = tx("Pick the existing entry.", "Выберите существующую запись.");
  if (row.paymentType === "recurring" && row.period === "custom") {
    const days = Number(row.customPeriodDaysInput);
    if (!Number.isInteger(days) || days < 1) errors.customPeriodDays = tx("Enter whole days.", "Введите число дней.");
  }
  for (const key of ["billingStartAt", "billingEndAt"] as const) {
    if (row[key] && !/^\d{4}-\d{2}-\d{2}$/.test(row[key])) errors[key] = tx("Use YYYY-MM-DD.", "Формат ГГГГ-ММ-ДД.");
  }
  if (!errors.billingEndAt && row.billingStartAt && row.billingEndAt && row.billingEndAt < row.billingStartAt) {
    errors.billingEndAt = tx("Ends before it starts.", "Окончание раньше начала.");
  }
  if (!validHttpUrl(row.vendorUrl)) errors.vendorUrl = tx("Enter a valid http(s) URL.", "Введите корректный URL.");
  if (row.action !== "pay") {
    category?.fields.forEach((field) => {
      const value = row.customFields[field.id];
      if (field.required && (field.type === "checkbox" ? value !== true : String(value ?? "").trim() === "")) {
        errors[`customFields.${field.id}`] = tx(`${field.label} is required.`, `Поле «${field.label}» обязательно.`);
      }
    });
  }
  return errors;
}

/** Shape sent to applyImportRowsAction. */
export function importRowPayload(row: ImportRow) {
  const recurring = row.paymentType === "recurring";
  const period = recurring ? row.period || "1m" : null;
  return {
    rowKey: row.rowKey,
    action: row.action,
    targetItemId: row.action === "create" ? null : row.targetItemId,
    name: row.name.trim() || row.rowKey,
    categoryId: row.categoryId,
    paymentType: row.paymentType,
    amount: Number(row.amountInput),
    currency: row.currency,
    billingStartAt: row.billingStartAt || null,
    billingEndAt: row.billingEndAt || null,
    period,
    customPeriodDays: period === "custom" ? Number(row.customPeriodDaysInput) : null,
    vendorName: row.vendorName,
    vendorUrl: row.vendorUrl,
    accountName: row.accountName,
    notes: row.notes,
    customFields: row.customFields,
    shiftDates: row.shiftDates,
    shiftPaymentPeriod: row.shiftPaymentPeriod,
  };
}

function signaturePart(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

/** Loose signature used to flag likely duplicates of existing entries in the review grid. */
export function entrySignature(entry: { name: string; vendorName?: string | null; accountName?: string | null }) {
  return [entry.name, entry.vendorName, entry.accountName].map(signaturePart).join("|");
}
