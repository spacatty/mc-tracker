import "server-only";

import { delimitedColumnValues } from "@/lib/import/rows";
import { createRedactor } from "@/lib/security/redact";
import type { BillingPeriod, Category, PaymentItem, VendorSuggestion } from "@/lib/types";
import { generateStructured } from "./client";
import {
  aiImportOutputSchema,
  type AiDraftItem,
  type AiImportResult,
  type AiOutputItem,
  type AiQuestion,
} from "./import-schema";

/**
 * Model instructions. Intent (create vs edit vs pay, which vendor applies, which
 * category fits) is decided here by the model, never by keyword matching in code;
 * see docs/ai-magic-agent-guidelines.md. Code below only validates and does
 * arithmetic on the structured fields the model returns.
 */
const SYSTEM_PROMPT = [
  "You turn pasted billing/inventory data into rows for a subscription and infrastructure tracker.",
  "The user message is a JSON object: `input` is the user's raw text; `categories`, `existingEntries` and `vendorMemory` describe their workspace; `answers` holds replies to questions you asked earlier; `today` anchors relative dates.",
  "Read the whole input first. Shared context such as a vendor/provider header, a currency note or a category applies to every following row unless a row overrides it.",
  "Produce one item per tracked thing (domain, server, subscription, licence). Pasted rows are proposals to create entries even if the user never says 'create'.",
  "action: create for new things; edit when the user changes details of an entry in existingEntries; pay when the user reports a completed payment or renewal of an existing entry. For edit/pay set targetItemId to that entry's id; never invent ids. When the user says they are adding new entries, use create even if names resemble existing ones.",
  "Priority of sources: the user's input, then answers, then existingEntries, then vendorMemory. vendorMemory only helps reuse exact spelling of a vendor the user clearly refers to; never let it replace a vendor the user named.",
  "vendorName is the provider/registrar/host; accountName is the login or account at that provider. Text like '<provider> account <name>' means vendorName=<provider>, accountName=<name>. Do not merge the two.",
  "Category: use the one the user names; otherwise infer from the data (domain names and registrars -> a domains category; IPs, hostnames, VPS/server labels -> a servers category) when such a category exists. Use null when nothing fits.",
  "customFields: fill the chosen category's fields from the input using the listed field ids. Put leftover useful details in notes. Placeholders like <<IP_1>>, <<DOMAIN_2>>, <<ACCOUNT_1>>, <<NAME_3>> or <<VENDOR_1>> stand for redacted values: copy them verbatim into the right field, and treat equal placeholders as the same value (an input <<NAME_3>> refers to the existing entry named <<NAME_3>>).",
  "Dates: output YYYY-MM-DD. If a row has two dates, they are start then end. A domain row with only an expiry date is recurring period=1y with billingEndAt=expiry and billingStartAt=null.",
  "Amounts: a bare trailing number on a billing row is the amount. Use the stated currency; if none is stated use null. Do not guess missing amounts, dates, periods or vendors: use null/empty and mention it in confidence.",
  "Ask a question only when a missing fact blocks a correct import for many rows (for example which existing entry a payment belongs to). Never ask about something already present in the input. Prefer importing with nulls over asking.",
].join("\n");

const ALLOWED_PERIODS: BillingPeriod[] = ["7d", "1m", "3m", "1y", "custom"];

function categoryContext(categories: Category[]) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    fields: category.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      ...(field.options?.length ? { options: field.options } : {}),
    })),
  }));
}

function vendorContext(vendors: VendorSuggestion[]) {
  return vendors
    .filter((vendor) => vendor.vendorName || vendor.vendorUrl)
    .slice(0, 80)
    .map((vendor) => ({ vendorName: vendor.vendorName, vendorUrl: vendor.vendorUrl, accountName: vendor.accountName }));
}

function entryContext(entries: PaymentItem[]) {
  return entries.slice(0, 200).map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    paymentType: item.paymentType,
    amount: item.amount,
    currency: item.currency,
    period: item.period,
    billingStartAt: item.billingStartAt?.slice(0, 10) || null,
    billingEndAt: item.billingEndAt?.slice(0, 10) || null,
    vendorName: item.vendorName,
    accountName: item.accountName,
  }));
}

function normalizeCurrency(value: string | null) {
  const raw = String(value || "").trim();
  const symbols: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₽": "RUB" };
  if (symbols[raw]) return symbols[raw];
  return /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : "USD";
}

function normalizeDateOnly(value: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function periodMonths(period: BillingPeriod | null, customDays?: number | null) {
  if (period === "7d") return 7 / 30;
  if (period === "3m") return 3;
  if (period === "1y") return 12;
  if (period === "custom") return (customDays && customDays > 0 ? customDays : 30) / 30;
  return 1;
}

/** A payment without an explicit amount costs the linked entry's price scaled to the paid period. */
function derivePayAmount(draft: AiDraftItem, entry: PaymentItem | undefined): AiDraftItem {
  if (draft.action !== "pay" || !entry || draft.amountSource === "explicit") return draft;
  const months = periodMonths(draft.period || entry.period, draft.customPeriodDays ?? entry.customPeriodDays);
  const entryMonths = periodMonths(entry.period, entry.customPeriodDays);
  const multiplier = entry.paymentType === "recurring" && entryMonths > 0 ? months / entryMonths : 1;
  return {
    ...draft,
    amount: Math.round(entry.amount * multiplier * 100) / 100,
    amountSource: "derived",
    currency: entry.currency,
    vendorName: draft.vendorName || entry.vendorName,
    vendorUrl: draft.vendorUrl || entry.vendorUrl,
    accountName: draft.accountName || entry.accountName,
    categoryId: draft.categoryId ?? entry.categoryId,
  };
}

/** Annual renewals with only an expiry date start one year before it. */
function deriveAnnualStart(draft: AiDraftItem): AiDraftItem {
  if (draft.action !== "create" || draft.paymentType !== "recurring" || draft.period !== "1y") return draft;
  if (draft.billingStartAt || !draft.billingEndAt) return draft;
  const start = new Date(`${draft.billingEndAt}T00:00:00.000Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return { ...draft, billingStartAt: start.toISOString().slice(0, 10) };
}

export function normalizeAiItem(item: AiOutputItem, categories: Category[], entries: PaymentItem[]): AiDraftItem {
  const category = categories.find((candidate) => candidate.id === item.categoryId);
  const entry = entries.find((candidate) => candidate.id === item.targetItemId);
  const fieldIds = new Set(category?.fields.map((field) => field.id) || []);
  const recurring = item.paymentType === "recurring";
  const period = recurring ? (item.period && ALLOWED_PERIODS.includes(item.period) ? item.period : "1m") : null;
  const notes = [item.notes.trim(), ...item.customFields.filter((field) => !fieldIds.has(field.fieldId)).map((field) => `${field.fieldId}: ${field.value}`)]
    .filter(Boolean)
    .join("\n");

  const draft: AiDraftItem = {
    action: item.action,
    // Ids the model made up are dropped; the grid then asks the user to pick the entry.
    targetItemId: entry ? entry.id : null,
    name: item.name.trim() || entry?.name || "",
    categoryId: category ? category.id : null,
    paymentType: item.paymentType,
    amount: item.amount ?? 0,
    amountSource: item.amount === null ? "unknown" : item.amountSource,
    currency: normalizeCurrency(item.currency),
    billingStartAt: normalizeDateOnly(item.billingStartAt),
    billingEndAt: normalizeDateOnly(item.billingEndAt),
    period,
    customPeriodDays: period === "custom" ? item.customPeriodDays || 30 : null,
    vendorName: item.vendorName.trim(),
    vendorUrl: item.vendorUrl.trim(),
    accountName: item.accountName.trim(),
    notes,
    customFields: Object.fromEntries(
      item.customFields
        .filter((field) => fieldIds.has(field.fieldId))
        .map((field) => {
          const definition = category?.fields.find((candidate) => candidate.id === field.fieldId);
          if (definition?.type === "checkbox") return [field.fieldId, /^(true|yes|1|on)$/i.test(field.value)];
          if (definition?.type === "date") return [field.fieldId, normalizeDateOnly(field.value) || field.value];
          return [field.fieldId, field.value];
        }),
    ),
    shiftDates: true,
    shiftPaymentPeriod: false,
    confidence: item.confidence.trim(),
  };
  return deriveAnnualStart(derivePayAmount(draft, entry));
}

function uniqueQuestions(questions: AiQuestion[]) {
  const seen = new Map<string, number>();
  return questions.map((question) => {
    const baseId = question.id.trim() || "question";
    const count = seen.get(baseId) || 0;
    seen.set(baseId, count + 1);
    return { ...question, id: count ? `${baseId}_${count + 1}` : baseId, suggestions: question.suggestions.slice(0, 4) };
  });
}

/** Builds the user message. Exported so the leak sanitizer can be applied to exactly what is sent. */
export function buildImportPayload({
  input,
  categories,
  entries,
  vendors,
  answers,
}: {
  input: string;
  categories: Category[];
  entries: PaymentItem[];
  vendors: VendorSuggestion[];
  answers: Record<string, string>;
}) {
  return {
    today: new Date().toISOString().slice(0, 10),
    categories: categoryContext(categories),
    existingEntries: entryContext(entries),
    vendorMemory: vendorContext(vendors),
    answers,
    input,
  };
}

export async function extractPaymentItems({
  input,
  categories,
  entries = [],
  vendors = [],
  answers = {},
}: {
  input: string;
  categories: Category[];
  entries?: PaymentItem[];
  vendors?: VendorSuggestion[];
  answers?: Record<string, string>;
}): Promise<AiImportResult> {
  const maxChars = Number(process.env.AI_IMPORT_MAX_INPUT_CHARS || 20000);
  const rawInput = input.trim();
  if (!rawInput) throw new Error("Paste some text first.");
  if (rawInput.length > maxChars) throw new Error(`AI import input is too large. Limit is ${maxChars} characters.`);

  // IPs, domains, emails, secrets and deny-listed terms are swapped for stable
  // placeholders before anything is sent; the model's answer is mapped back here.
  const redactor = createRedactor();
  // Known private values are masked literally, on top of the pattern detectors:
  // account logins, existing entry names, and optionally vendor names.
  redactor.addTerms("ACCOUNT", [
    ...entries.map((entry) => entry.accountName),
    ...vendors.map((vendor) => vendor.accountName),
    ...delimitedColumnValues(rawInput, "accountName"),
  ]);
  redactor.addTerms("NAME", entries.map((entry) => entry.name));
  if (process.env.AI_REDACT_VENDORS === "true") {
    redactor.addTerms("VENDOR", [...entries.map((entry) => entry.vendorName), ...vendors.map((vendor) => vendor.vendorName)]);
  }
  const payload = redactor.redactDeep(buildImportPayload({ input: rawInput, categories, entries, vendors, answers }));
  const { data: redacted, model } = await generateStructured({
    name: "tracker_import",
    schema: aiImportOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(payload),
  });
  const data = redactor.restoreDeep(redacted);

  return {
    items: data.items.map((item) => normalizeAiItem(item, categories, entries)),
    questions: uniqueQuestions(data.questions),
    summary: data.summary.trim(),
    model,
  };
}
