import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { blankImportRow, entrySignature, type ImportRow } from "@/lib/import/rows";
import type { BillingPeriod, Category, PaymentType, VendorSuggestion } from "@/lib/types";
import { slugify } from "@/lib/utils";

/**
 * Quick Capture line syntax. One line is one entry. Every token is explicit
 * syntax (a prefix, a symbol or a key), so nothing here guesses intent from
 * words; free text that needs understanding goes to the AI parser, which
 * answers with lines in this same format.
 *
 *   hz-fsn-01 #servers @Hetzner/ops €4.51/mo 2026-11-12 ip:95.217.10.4 // spare box
 *
 *   name words      everything that is not a token
 *   #category       category, matched by name (prefix is enough)
 *   @vendor/account vendor (quote names with spaces: @"Digital Ocean"), optional account
 *   €4.51/mo        price with currency (symbol or ISO code) and optional period
 *   /mo /yr /w /q /90d /once   period on its own
 *   12.10.2026      billing start (also 12/10/26, 2026-10-12); renewal follows from the period;
 *                   a range 2026-10-12..2026-11-12 or renews:2026-11-12 sets the end explicitly
 *   !attr:value     custom field of the category (by label, fuzzy prefix; "!domain: x" works too)
 *   key:value       same, plus built-ins account:, url:, start:, renews:
 *   https://…       vendor / panel URL
 *   1.2.3.4         IP, stored in the category's IP field when it has one
 *   // text         notes until the end of the line
 *   edit:12 pay:12  change or record a payment for existing entry #12
 */

export type TokenKind =
  | "name"
  | "category"
  | "vendor"
  | "money"
  | "period"
  | "date"
  | "field"
  | "ip"
  | "url"
  | "notes"
  | "action";

export type Token = {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
  /** false when the token is syntax we recognise but whose value did not resolve (unknown category, unknown field). */
  ok: boolean;
  hint?: string;
};

export type CaptureEntryRef = {
  id: number;
  name: string;
  vendorName: string;
  vendorUrl: string;
  accountName: string;
  categoryId: number | null;
  paymentType: PaymentType;
  amount: number;
  currency: string;
  period: BillingPeriod | null;
  customPeriodDays: number | null;
  billingStartAt: string | null;
  billingEndAt: string | null;
  notes: string;
  customFields: Record<string, unknown>;
};

/** The capture row an existing entry corresponds to (used for edit lines and "Edit as text"). */
export function rowFromEntry(entry: CaptureEntryRef, rowKey = `entry-${entry.id}`): ImportRow {
  const row = blankImportRow(rowKey, "csv", entry.categoryId);
  return {
    ...row,
    name: entry.name,
    paymentType: entry.paymentType,
    amountInput: String(entry.amount ?? ""),
    currency: entry.currency || "USD",
    billingStartAt: entry.billingStartAt?.slice(0, 10) || "",
    billingEndAt: entry.billingEndAt?.slice(0, 10) || "",
    period: entry.paymentType === "recurring" ? entry.period || "1m" : null,
    customPeriodDaysInput: String(entry.customPeriodDays || 30),
    vendorName: entry.vendorName || "",
    vendorUrl: entry.vendorUrl || "",
    accountName: entry.accountName || "",
    notes: entry.notes || "",
    customFields: { ...(entry.customFields || {}) },
  };
}

export type CaptureContext = {
  categories: Category[];
  vendors: VendorSuggestion[];
  entries: CaptureEntryRef[];
  defaultCategoryId: number | null;
  defaultCurrency: string;
  today?: string;
};

export type ParsedLine = {
  index: number;
  text: string;
  tokens: Token[];
  row: ImportRow;
  /** Fields the parser filled in itself (shown faintly so the user knows they were assumed). */
  assumed: Set<"amount" | "dates" | "category" | "currency">;
  duplicateOf: CaptureEntryRef | null;
  target: CaptureEntryRef | null;
};

const CURRENCY_CODES = new Set<string>(SUPPORTED_CURRENCIES.map((currency) => currency.code));
const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₽": "RUB", "¥": "JPY", "₸": "KZT", "₹": "INR", "zł": "PLN" };
const SYMBOL_FOR: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", RUB: "₽" };

const PERIOD_ALIASES: Array<[RegExp, BillingPeriod | "once"]> = [
  [/^(w|wk|week|weekly|7d|нед|неделя|еженедельно)$/i, "7d"],
  [/^(m|mo|mon|month|monthly|1m|1mo|мес|месяц|ежемесячно)$/i, "1m"],
  [/^(q|3m|3mo|quarter|quarterly|кв|квартал)$/i, "3m"],
  [/^(y|yr|year|yearly|annual|annually|1y|12m|12mo|г|год|ежегодно)$/i, "1y"],
  [/^(once|one|1x|single|разово)$/i, "once"],
];

const FIELD_KEYS: Record<string, "accountName" | "vendorUrl" | "billingStartAt" | "billingEndAt" | "currency" | "vendorName" | "notes"> = {
  acc: "accountName",
  account: "accountName",
  login: "accountName",
  user: "accountName",
  url: "vendorUrl",
  panel: "vendorUrl",
  link: "vendorUrl",
  start: "billingStartAt",
  from: "billingStartAt",
  started: "billingStartAt",
  end: "billingEndAt",
  until: "billingEndAt",
  renews: "billingEndAt",
  expires: "billingEndAt",
  due: "billingEndAt",
  cur: "currency",
  currency: "currency",
  vendor: "vendorName",
  note: "notes",
  notes: "notes",
};

function unquote(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) return trimmed.slice(1, trimmed.endsWith('"') && trimmed.length > 1 ? -1 : undefined);
  return trimmed;
}

function quoteIfNeeded(value: string) {
  const clean = value.replace(/"/g, "'").replace(/\s+/g, " ").trim();
  return /\s/.test(clean) || clean === "" ? `"${clean}"` : clean;
}

/** Splits a line into raw tokens, keeping quoted parts together and treating `//` (not inside a URL) as the start of notes. */
function scan(line: string) {
  const raw: Array<{ start: number; end: number; text: string; notes?: boolean }> = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i += 1;
    if (i >= line.length) break;
    if (line.startsWith("//", i)) {
      raw.push({ start: i, end: line.length, text: line.slice(i), notes: true });
      break;
    }
    const start = i;
    let quoted = false;
    while (i < line.length && (quoted || !/\s/.test(line[i]))) {
      if (line[i] === '"') quoted = !quoted;
      i += 1;
    }
    raw.push({ start, end: i, text: line.slice(start, i) });
  }
  return mergeMoney(raw);
}

const NUMBER_PART = /^\d+(?:[.,]\d{1,2})?k?$/i;
const SYMBOL_PART = /^([$€£₽¥₸₹]|zł)$/;

function isCurrencyPart(value: string) {
  const [head] = splitOnce(value, "/");
  return SYMBOL_PART.test(head) || CURRENCY_CODES.has(head.toUpperCase());
}

/** Joins "25 USD", "2500 rub/mo", "$ 25" into one money token so any common spelling works. */
function mergeMoney(raw: Array<{ start: number; end: number; text: string; notes?: boolean }>) {
  const merged: typeof raw = [];
  for (let i = 0; i < raw.length; i += 1) {
    const current = raw[i];
    const next = raw[i + 1];
    if (next && !current.notes && !next.notes) {
      const numberThenCurrency = NUMBER_PART.test(current.text) && isCurrencyPart(next.text);
      const symbolThenNumber = SYMBOL_PART.test(current.text) && /^\d+(?:[.,]\d{1,2})?k?(\/.*)?$/i.test(next.text);
      const keyThenValue = /^!?[\p{L}_][\p{L}\p{N}_-]*:$/u.test(current.text) && !/^(https?|\/\/)/i.test(next.text);
      if (keyThenValue) {
        merged.push({ start: current.start, end: next.end, text: `${current.text}${next.text}` });
        i += 1;
        continue;
      }
      if (numberThenCurrency || symbolThenNumber) {
        merged.push({ start: current.start, end: next.end, text: `${current.text}${next.text}` });
        i += 1;
        continue;
      }
    }
    merged.push(current);
  }
  return merged;
}

export function parsePeriod(value: string): { period: BillingPeriod | null; paymentType: PaymentType; customDays?: number } | null {
  const clean = value.replace(/^\//, "").trim();
  const days = clean.match(/^(\d{1,4})\s*(d|days?|дн)$/i);
  if (days) {
    const count = Number(days[1]);
    if (count === 7) return { period: "7d", paymentType: "recurring" };
    return { period: "custom", paymentType: "recurring", customDays: count };
  }
  const months = clean.match(/^(\d{1,2})\s*(m|mo|months?)$/i);
  if (months) {
    const count = Number(months[1]);
    if (count === 1) return { period: "1m", paymentType: "recurring" };
    if (count === 3) return { period: "3m", paymentType: "recurring" };
    if (count === 12) return { period: "1y", paymentType: "recurring" };
    return { period: "custom", paymentType: "recurring", customDays: Math.round(count * 30.4) };
  }
  const match = PERIOD_ALIASES.find(([pattern]) => pattern.test(clean));
  if (!match) return null;
  return match[1] === "once" ? { period: null, paymentType: "single" } : { period: match[1], paymentType: "recurring" };
}

function parseMoney(text: string) {
  const [moneyPart, periodPart] = splitOnce(text, "/");
  const match = moneyPart.match(/^([$€£₽¥₸₹]|zł)?(\d+(?:[.,]\d{1,2})?)(k)?([$€£₽¥₸₹]|zł|[a-zA-Z]{3})?$/);
  if (!match) return null;
  const [, prefix, number, thousands, suffix] = match;
  let currency: string | null = null;
  if (prefix) currency = SYMBOLS[prefix];
  if (suffix) {
    const code = SYMBOLS[suffix] || suffix.toUpperCase();
    if (!SYMBOLS[suffix] && !CURRENCY_CODES.has(code)) return null;
    currency = code;
  }
  const period = periodPart !== undefined ? parsePeriod(periodPart) : null;
  // A bare number is part of the name ("server 2"); money needs a currency or a period.
  if (!currency && !period) return null;
  if (periodPart !== undefined && !period) return null;
  const amount = Number(number.replace(",", ".")) * (thousands ? 1000 : 1);
  return { amount, currency, period };
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  return index < 0 ? [value, undefined] : [value.slice(0, index), value.slice(index + separator.length)];
}

export function parseDate(value: string): string | null {
  const clean = value.trim();
  let year: number;
  let month: number;
  let day: number;
  const iso = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  const dotted = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dotted) [day, month, year] = [Number(dotted[1]), Number(dotted[2]), Number(dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3])];
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseDateRange(text: string) {
  const parts = text.split(/\.\.|→|–/);
  if (parts.length === 1) {
    // A lone date is when billing starts; the renewal follows from the period.
    const start = parseDate(parts[0]);
    return start ? { start, end: null as string | null } : null;
  }
  if (parts.length !== 2) return null;
  const start = parseDate(parts[0]);
  const end = parts[1] ? parseDate(parts[1]) : null;
  if (!start || (parts[1] && !end)) return null;
  return { start, end };
}

export function matchCategory(query: string, categories: Category[]) {
  const key = slugify(unquote(query));
  if (!key) return null;
  return (
    categories.find((category) => slugify(category.name) === key) ||
    categories.find((category) => slugify(category.name).startsWith(key)) ||
    categories.find((category) => slugify(category.name).includes(key)) ||
    null
  );
}

export function fieldKey(field: { id: string; label: string }) {
  return slugify(field.label) || slugify(field.id) || field.id;
}

function matchField(key: string, category: Category | undefined) {
  if (!category) return null;
  const slug = slugify(key);
  return (
    category.fields.find((field) => fieldKey(field) === slug || field.id === key) ||
    category.fields.find((field) => slug.length >= 2 && fieldKey(field).startsWith(slug)) ||
    null
  );
}

function ipField(category: Category | undefined) {
  return category?.fields.find((field) => /(^|_)ip(_|$)|ipv4|address/.test(fieldKey(field))) || null;
}

const IP_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d{1,5})?$/;

/** Moves a YYYY-MM-DD date by one billing period (negative direction for the start). */
export function shiftByPeriod(date: string, period: BillingPeriod | null, customDays: number, direction: 1 | -1) {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (period === "7d") value.setUTCDate(value.getUTCDate() + 7 * direction);
  else if (period === "3m") value.setUTCMonth(value.getUTCMonth() + 3 * direction);
  else if (period === "1y") value.setUTCFullYear(value.getUTCFullYear() + direction);
  else if (period === "custom") value.setUTCDate(value.getUTCDate() + (customDays || 30) * direction);
  else value.setUTCMonth(value.getUTCMonth() + direction);
  return value.toISOString().slice(0, 10);
}

export function parseLine(text: string, index: number, context: CaptureContext): ParsedLine {
  const today = context.today || new Date().toISOString().slice(0, 10);
  const row = blankImportRow(`capture-${index}`, "csv", null);
  row.amountInput = "";
  row.currency = "";
  const tokens: Token[] = [];
  const names: string[] = [];
  const notes: string[] = [];
  const pendingFields: Array<{ token: Token; key: string; value: string }> = [];
  const pendingIps: Token[] = [];
  let categoryToken: Token | null = null;
  let periodSet = false;

  for (const raw of scan(text)) {
    const token: Token = { kind: "name", start: raw.start, end: raw.end, text: raw.text, ok: true };
    tokens.push(token);
    const value = raw.text;

    if (raw.notes) {
      token.kind = "notes";
      const note = value.replace(/^\/\/\s?/, "").trim();
      if (note) notes.push(note);
      continue;
    }
    if (value.length > 1 && value.startsWith("#")) {
      token.kind = "category";
      const category = matchCategory(value.slice(1), context.categories);
      categoryToken = token;
      if (category) row.categoryId = category.id;
      else {
        token.ok = false;
        token.hint = "unknown category";
      }
      continue;
    }
    if (value.length > 1 && value.startsWith("@")) {
      token.kind = "vendor";
      const body = value.slice(1);
      const slash = body.startsWith('"') ? body.indexOf('"/', 1) + 1 : body.indexOf("/");
      const vendor = unquote(slash > 0 ? body.slice(0, slash) : body);
      const account = slash > 0 ? unquote(body.slice(slash + 1)) : "";
      const known = context.vendors.find((candidate) => candidate.vendorName.toLowerCase() === vendor.toLowerCase());
      row.vendorName = known?.vendorName || vendor;
      if (account) row.accountName = account;
      if (known && !row.vendorUrl) row.vendorUrl = known.vendorUrl;
      continue;
    }
    const action = value.match(/^(edit|pay):#?(\d+)$/i);
    if (action) {
      token.kind = "action";
      const target = context.entries.find((entry) => entry.id === Number(action[2]));
      row.action = action[1].toLowerCase() as "edit" | "pay";
      row.targetItemId = target?.id ?? null;
      if (!target) {
        token.ok = false;
        token.hint = "no entry with this id";
      }
      continue;
    }
    if (/^https?:\/\//i.test(value)) {
      token.kind = "url";
      row.vendorUrl = value;
      continue;
    }
    const money = parseMoney(value);
    if (money) {
      token.kind = "money";
      row.amountInput = String(money.amount);
      if (money.currency) row.currency = money.currency;
      if (money.period) {
        periodSet = true;
        row.paymentType = money.period.paymentType;
        row.period = money.period.period;
        if (money.period.customDays) row.customPeriodDaysInput = String(money.period.customDays);
      }
      continue;
    }
    if ((value.startsWith("/") && value.length > 1) || /^(monthly|yearly|annually|annual|weekly|quarterly|ежемесячно|ежегодно|еженедельно)$/i.test(value)) {
      const period = parsePeriod(value);
      if (period) {
        token.kind = "period";
        periodSet = true;
        row.paymentType = period.paymentType;
        row.period = period.period;
        if (period.customDays) row.customPeriodDaysInput = String(period.customDays);
        continue;
      }
    }
    const range = parseDateRange(value);
    if (range) {
      token.kind = "date";
      if (range.start) row.billingStartAt = range.start;
      if (range.end) row.billingEndAt = range.end;
      continue;
    }
    if (IP_PATTERN.test(value) && value.split(/[.:]/).slice(0, 4).every((part) => Number(part) <= 255)) {
      token.kind = "ip";
      pendingIps.push(token);
      continue;
    }
    const attribute = value.match(/^!([\p{L}_][\p{L}\p{N}_-]*):?(.*)$/u);
    if (attribute) {
      // !attr:value is always a field of the chosen category.
      token.kind = "field";
      if (attribute[2]) pendingFields.push({ token, key: attribute[1], value: unquote(attribute[2]) });
      else {
        token.ok = false;
        token.hint = "add :value";
      }
      continue;
    }
    const keyValue = value.match(/^([\p{L}_][\p{L}\p{N}_-]*):(.+)$/u);
    if (keyValue) {
      token.kind = "field";
      const key = keyValue[1].toLowerCase();
      const fieldValue = unquote(keyValue[2]);
      const builtIn = FIELD_KEYS[key];
      if (builtIn === "billingStartAt" || builtIn === "billingEndAt") {
        const date = parseDate(fieldValue);
        if (date) row[builtIn] = date;
        else {
          token.ok = false;
          token.hint = "use YYYY-MM-DD";
        }
      } else if (builtIn === "currency") {
        const code = SYMBOLS[fieldValue] || fieldValue.toUpperCase();
        if (CURRENCY_CODES.has(code)) row.currency = code;
        else {
          token.ok = false;
          token.hint = "unknown currency";
        }
      } else if (builtIn === "notes") {
        notes.push(fieldValue);
      } else if (builtIn) {
        row[builtIn] = fieldValue;
      } else {
        pendingFields.push({ token, key: keyValue[1], value: fieldValue });
      }
      continue;
    }
    names.push(unquote(value));
  }

  const target = row.targetItemId ? context.entries.find((entry) => entry.id === row.targetItemId) || null : null;
  if (!categoryToken && row.categoryId === null && row.action === "create" && context.defaultCategoryId) {
    row.categoryId = context.defaultCategoryId;
  }
  const category = context.categories.find((candidate) => candidate.id === (row.categoryId ?? target?.categoryId ?? null));

  for (const { token, key, value } of pendingFields) {
    const field = matchField(key, category);
    if (field) {
      row.customFields[field.id] = field.type === "checkbox" ? /^(true|yes|1|on|да)$/i.test(value) : field.type === "date" ? parseDate(value) || value : value;
    } else {
      token.ok = false;
      token.hint = category ? `no “${key}” field in ${category.name}` : "pick a category to use fields";
      notes.push(`${key}: ${value}`);
    }
  }
  const ip = ipField(category);
  for (const token of pendingIps) {
    if (ip && !row.customFields[ip.id]) row.customFields[ip.id] = token.text;
    else notes.push(token.text);
  }
  row.name = names.join(" ").trim();
  row.notes = notes.join("\n");
  // "#domains !domain: sample.com" needs no separate name: the first filled field names it.
  if (!row.name && row.action === "create" && category) {
    const first = category.fields.find((field) => typeof row.customFields[field.id] === "string" && String(row.customFields[field.id]).trim());
    if (first) row.name = String(row.customFields[first.id]).trim();
  }

  const assumed = new Set<"amount" | "dates" | "category" | "currency">();
  if (row.action === "edit" && target) {
    // An edit line only changes what it mentions; everything else stays as it is.
    const base = rowFromEntry(target, row.rowKey);
    const merged: ImportRow = {
      ...base,
      action: "edit",
      targetItemId: target.id,
      name: row.name || base.name,
      categoryId: categoryToken && row.categoryId ? row.categoryId : base.categoryId,
      vendorName: row.vendorName || base.vendorName,
      accountName: row.accountName || base.accountName,
      vendorUrl: row.vendorUrl || base.vendorUrl,
      amountInput: row.amountInput || base.amountInput,
      currency: row.currency || base.currency,
      paymentType: periodSet ? row.paymentType : base.paymentType,
      period: periodSet ? row.period : base.period,
      customPeriodDaysInput: periodSet ? row.customPeriodDaysInput : base.customPeriodDaysInput,
      notes: row.notes || base.notes,
      customFields: { ...base.customFields, ...row.customFields },
    };
    if (row.billingStartAt || row.billingEndAt) {
      merged.billingStartAt = row.billingStartAt;
      merged.billingEndAt = row.billingEndAt;
    }
    Object.assign(row, merged);
  } else if (row.action === "pay" && target) {
    // A payment defaults to the entry's price and period; a lone date is the payment date.
    if (!row.amountInput) {
      row.amountInput = String(target.amount);
      assumed.add("amount");
    }
    if (!row.currency) row.currency = target.currency;
    if (!periodSet) {
      row.paymentType = target.paymentType;
      row.period = target.period;
      row.customPeriodDaysInput = String(target.customPeriodDays || 30);
    }
    if (!row.billingStartAt) {
      row.billingStartAt = row.billingEndAt || today;
      row.billingEndAt = "";
      if (!row.billingStartAt || row.billingStartAt === today) assumed.add("dates");
    }
    row.categoryId = row.categoryId ?? target.categoryId;
    row.name = row.name || target.name;
  }

  if (!categoryToken && row.categoryId && row.action === "create") assumed.add("category");
  if (!row.currency) {
    row.currency = context.defaultCurrency || "USD";
    assumed.add("currency");
  }
  if (!row.amountInput) assumed.add("amount");

  // Dates: a lone end date means "renews on"; the start is one period earlier.
  // No dates at all means it starts today.
  const customDays = Number(row.customPeriodDaysInput) || 30;
  if (row.action !== "pay") {
    if (row.paymentType === "recurring") {
      if (!row.billingStartAt && row.billingEndAt) row.billingStartAt = shiftByPeriod(row.billingEndAt, row.period, customDays, -1);
      if (row.billingStartAt && !row.billingEndAt) row.billingEndAt = shiftByPeriod(row.billingStartAt, row.period, customDays, 1);
      if (!row.billingStartAt && !row.billingEndAt) {
        row.billingStartAt = today;
        row.billingEndAt = shiftByPeriod(today, row.period, customDays, 1);
        assumed.add("dates");
      }
    } else if (!row.billingStartAt) {
      row.billingStartAt = row.billingEndAt || today;
      if (!row.billingEndAt) assumed.add("dates");
    }
  }

  const signature = entrySignature({ name: row.name, vendorName: row.vendorName, accountName: row.accountName });
  const duplicateOf = row.action === "create" && row.name
    ? context.entries.find((entry) => entrySignature(entry) === signature) ||
      context.entries.find((entry) => entry.name.trim().toLowerCase() === row.name.trim().toLowerCase()) ||
      null
    : null;

  return { index, text, tokens, row, assumed, duplicateOf, target };
}

export function parseCapture(text: string, context: CaptureContext) {
  const lines = text.split("\n");
  return lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim())
    .map(({ line, index }) => parseLine(line, index, context));
}

/** Quotes a name word that would otherwise be read as a token. */
function safeNameWord(word: string) {
  const clean = word.replace(/"/g, "'");
  const looksLikeToken = /^[#@/]|:|^\d{1,4}[-./]\d|^[$€£₽¥]|^\d+(?:[.,]\d+)?(?:[$€£₽¥]|[a-z]{3})(?:\/|$)|^https?:/i.test(clean);
  return looksLikeToken ? `"${clean}"` : clean;
}

function formatAmount(amount: string, currency: string) {
  const value = Number(amount);
  const number = Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "0";
  const symbol = SYMBOL_FOR[currency];
  return symbol ? `${symbol}${number}` : `${number}${currency}`;
}

export function periodToken(row: Pick<ImportRow, "paymentType" | "period" | "customPeriodDaysInput">) {
  if (row.paymentType === "single") return "/once";
  if (row.period === "7d") return "/w";
  if (row.period === "3m") return "/q";
  if (row.period === "1y") return "/yr";
  if (row.period === "custom") return `/${Number(row.customPeriodDaysInput) || 30}d`;
  return "/mo";
}

/**
 * Writes a row back as one capture line. Used after a card chip is edited and to
 * show AI or CSV results in the same format the user types.
 */
export function rowToLine(row: ImportRow, context: Pick<CaptureContext, "categories" | "defaultCategoryId">, options: { keepDates?: boolean } = {}) {
  const parts: string[] = [];
  const category = context.categories.find((candidate) => candidate.id === row.categoryId);
  if (row.action === "pay" && row.targetItemId) {
    parts.push(`pay:${row.targetItemId}`);
    if (row.amountInput.trim()) parts.push(`${formatAmount(row.amountInput, row.currency)}${periodToken(row)}`);
    if (row.billingStartAt) parts.push(row.billingStartAt);
    const payNotes = row.notes.replace(/\s+/g, " ").trim();
    if (payNotes) parts.push(`// ${payNotes}`);
    return parts.join(" ");
  }
  if (row.action === "edit" && row.targetItemId) parts.push(`edit:${row.targetItemId}`);
  if (row.name.trim()) parts.push(...row.name.trim().split(/\s+/).map(safeNameWord));
  if (category) parts.push(`#${slugify(category.name) || category.id}`);
  if (row.vendorName.trim() || row.accountName.trim()) {
    const vendor = row.vendorName.trim() ? quoteIfNeeded(row.vendorName) : '""';
    parts.push(`@${vendor}${row.accountName.trim() ? `/${quoteIfNeeded(row.accountName)}` : ""}`);
  }
  if (row.amountInput.trim()) parts.push(`${formatAmount(row.amountInput, row.currency)}${periodToken(row)}`);
  else {
    parts.push(periodToken(row));
    if (row.currency && row.currency !== "USD") parts.push(`cur:${row.currency}`);
  }
  const customDays = Number(row.customPeriodDaysInput) || 30;
  if (row.billingEndAt || row.billingStartAt) {
    const derivedEnd = row.billingStartAt && row.paymentType === "recurring" ? shiftByPeriod(row.billingStartAt, row.period, customDays, 1) : null;
    if (row.billingStartAt && (!row.billingEndAt || row.billingEndAt === derivedEnd || row.paymentType !== "recurring") && !options.keepDates) parts.push(row.billingStartAt);
    else if (row.billingStartAt && row.billingEndAt) parts.push(`${row.billingStartAt}..${row.billingEndAt}`);
    else if (row.billingEndAt) parts.push(`renews:${row.billingEndAt}`);
  }
  if (row.vendorUrl.trim()) parts.push(row.vendorUrl.trim().replace(/\s/g, "%20"));
  if (category) {
    category.fields.forEach((field) => {
      const value = row.customFields[field.id];
      if (value === undefined || value === null || value === "" || value === false) return;
      parts.push(`!${fieldKey(field)}:${quoteIfNeeded(value === true ? "yes" : String(value))}`);
    });
  }
  const notes = row.notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (notes) parts.push(`// ${notes}`);
  return parts.join(" ");
}

export const CAPTURE_EXAMPLES = [
  "hz-fsn-01 #servers @Hetzner €4.51/mo !ip: 95.217.10.4",
  "acme.dev #domains @Cloudflare 10.44 USD/yr 05.01.2026",
  "Figma @Figma/design@acme $15/mo // 1 editor seat",
];
