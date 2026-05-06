import "server-only";

import { z } from "zod";
import type { BillingPeriod, Category, PaymentItem, PaymentType, VendorSuggestion } from "@/lib/types";
import { openRouterJson } from "./openrouter";

export const aiDraftItemSchema = z.object({
  action: z.enum(["create", "edit", "pay"]).default("create"),
  targetItemId: z.number().nullable().default(null),
  name: z.string().min(1),
  categoryId: z.number().nullable(),
  paymentType: z.enum(["single", "recurring"]),
  amount: z.number().nonnegative(),
  amountSource: z.enum(["explicit", "derived", "unknown"]).default("unknown"),
  currency: z.string().min(1).default("USD"),
  billingStartAt: z.string().nullable(),
  billingEndAt: z.string().nullable(),
  period: z.enum(["7d", "1m", "3m", "1y", "custom"]).nullable(),
  customPeriodDays: z.number().nullable(),
  vendorName: z.string().default(""),
  vendorUrl: z.string().default(""),
  accountName: z.string().default(""),
  notes: z.string().default(""),
  customFields: z.record(z.string(), z.unknown()).default({}),
  shiftDates: z.boolean().default(true),
  shiftPaymentPeriod: z.boolean().default(false),
  confidence: z.string().default(""),
});

export type AiDraftItem = z.infer<typeof aiDraftItemSchema>;

export const aiQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  field: z.string().default(""),
  itemName: z.string().default(""),
  suggestions: z.array(z.string()).default([]),
});

export type AiQuestion = z.infer<typeof aiQuestionSchema>;

const aiImportResultSchema = z.object({
  questions: z.array(aiQuestionSchema),
  items: z.array(aiDraftItemSchema),
  summary: z.string().default(""),
});

export type AiImportResult = z.infer<typeof aiImportResultSchema>;

const responseSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          field: { type: "string" },
          itemName: { type: "string" },
          suggestions: { type: "array", items: { type: "string" } },
        },
        required: ["id", "question", "field", "itemName", "suggestions"],
        additionalProperties: false,
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "edit", "pay"] },
          targetItemId: { type: ["number", "null"] },
          name: { type: "string" },
          categoryId: { type: ["number", "null"] },
          paymentType: { type: "string", enum: ["single", "recurring"] },
          amount: { type: "number" },
          amountSource: { type: "string", enum: ["explicit", "derived", "unknown"] },
          currency: { type: "string" },
          billingStartAt: { type: ["string", "null"], description: "ISO date as YYYY-MM-DD, or null if unknown." },
          billingEndAt: { type: ["string", "null"], description: "ISO date as YYYY-MM-DD, or null if unknown." },
          period: { type: ["string", "null"], enum: ["7d", "1m", "3m", "1y", "custom", null] },
          customPeriodDays: { type: ["number", "null"] },
          vendorName: { type: "string" },
          vendorUrl: { type: "string" },
          accountName: { type: "string" },
          notes: { type: "string" },
          customFields: { type: "object", additionalProperties: true },
          shiftDates: { type: "boolean" },
          shiftPaymentPeriod: { type: "boolean" },
          confidence: { type: "string" },
        },
        required: [
          "action",
          "targetItemId",
          "name",
          "categoryId",
          "paymentType",
          "amount",
          "amountSource",
          "currency",
          "billingStartAt",
          "billingEndAt",
          "period",
          "customPeriodDays",
          "vendorName",
          "vendorUrl",
          "accountName",
          "notes",
          "customFields",
          "shiftDates",
          "shiftPaymentPeriod",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["questions", "items", "summary"],
  additionalProperties: false,
};

function categoryContext(categories: Category[]) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    fields: category.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options || [],
    })),
  }));
}

function vendorContext(vendors: VendorSuggestion[]) {
  return vendors
    .filter((vendor) => vendor.vendorName || vendor.vendorUrl)
    .slice(0, 80)
    .map((vendor) => ({
      vendorName: vendor.vendorName,
      vendorUrl: vendor.vendorUrl,
      accountName: vendor.accountName,
      note: "Memory only. Use this exact vendorName/vendorUrl/accountName only when the user clearly refers to this existing vendor/account. Do not suggest it when the user named a new vendor or account.",
    }));
}

function entryContext(entries: PaymentItem[]) {
  return entries.slice(0, 200).map((item) => ({
    id: item.id,
    name: item.name,
    paymentType: item.paymentType,
    amount: item.amount,
    currency: item.currency,
    period: item.period,
    customPeriodDays: item.customPeriodDays,
    billingStartAt: item.billingStartAt,
    billingEndAt: item.billingEndAt,
    vendorName: item.vendorName,
    vendorUrl: item.vendorUrl,
    accountName: item.accountName,
  }));
}

function comparableLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function looksLikeTypo(value: string, candidates: string[]) {
  const normalizedValue = comparableLabel(value);
  if (!normalizedValue) return false;

  return candidates.some((candidate) => {
    const normalizedCandidate = comparableLabel(candidate);
    if (!normalizedCandidate || normalizedCandidate === normalizedValue) return false;

    const valueNumber = normalizedValue.match(/\d+$/)?.[0];
    const candidateNumber = normalizedCandidate.match(/\d+$/)?.[0];
    if (valueNumber && candidateNumber && valueNumber !== candidateNumber) return false;

    return editDistance(normalizedValue, normalizedCandidate) <= 1;
  });
}

function explicitAccountFromInput(input: string) {
  const accountMatch = input.match(/\b(?:account|acct)\s+([a-z0-9][a-z0-9._-]*)\b/i);
  if (!accountMatch?.[1]) return null;

  const beforeAccount = input.slice(0, accountMatch.index).trim();
  const providerMatch = beforeAccount.match(/([a-z0-9][a-z0-9._-]*)\s*$/i);

  return {
    accountName: accountMatch[1],
    providerName: providerMatch?.[1] || "",
  };
}

function splitVendorName(vendorName: string) {
  const [providerLabel, ...accountParts] = vendorName.split(/\s+-\s+/);
  return {
    providerLabel: providerLabel?.trim() || "",
    accountLabel: accountParts.join(" - ").trim(),
  };
}

function hostnameOrRaw(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).hostname;
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname;
    } catch {
      return trimmed;
    }
  }
}

function asActualUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed) || !trimmed.includes(".")) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function findProviderVendor(providerName: string, draft: AiDraftItem, vendors: VendorSuggestion[]) {
  const providerCandidates = [providerName, draft.vendorUrl, draft.vendorName].map(hostnameOrRaw).map(comparableLabel).filter(Boolean);
  if (!providerCandidates.length) return null;

  return (
    vendors.find((vendor) => {
      const { providerLabel } = splitVendorName(vendor.vendorName);
      const vendorCandidates = [providerLabel, vendor.vendorName, vendor.vendorUrl].map(hostnameOrRaw).map(comparableLabel).filter(Boolean);
      return providerCandidates.some((candidate) => vendorCandidates.includes(candidate));
    }) || null
  );
}

function accountLabelsFromVendors(vendors: VendorSuggestion[]) {
  return vendors.flatMap((vendor) => {
    const { accountLabel } = splitVendorName(vendor.vendorName);
    return [vendor.vendorName, vendor.vendorUrl, vendor.accountName, accountLabel].filter(Boolean);
  });
}

function applyExplicitAccount(draft: AiDraftItem, input: string, vendors: VendorSuggestion[]) {
  if (draft.action === "pay") return draft;
  const explicitAccount = explicitAccountFromInput(input);
  if (!explicitAccount) return draft;

  const knownAccountNames = accountLabelsFromVendors(vendors);
  const normalizedAccount = comparableLabel(explicitAccount.accountName);
  const accountExists = knownAccountNames.some((vendorName) => comparableLabel(vendorName) === normalizedAccount);
  if (accountExists || looksLikeTypo(explicitAccount.accountName, knownAccountNames)) return draft;

  const providerVendor = findProviderVendor(explicitAccount.providerName, draft, vendors);
  const providerLabel =
    splitVendorName(providerVendor?.vendorName || "").providerLabel || explicitAccount.providerName || splitVendorName(draft.vendorName).providerLabel;
  const vendorUrl = providerVendor?.vendorUrl || asActualUrl(draft.vendorUrl) || asActualUrl(explicitAccount.providerName) || draft.vendorUrl;

  return {
    ...draft,
    vendorName: providerLabel || draft.vendorName,
    vendorUrl,
    accountName: explicitAccount.accountName,
  };
}

function normalizeCurrency(value: string) {
  const raw = value.trim();
  const normalized = raw.toUpperCase();
  if (!raw) return "USD";
  if (raw === "$") return "USD";
  if (raw === "€") return "EUR";
  if (raw === "£") return "GBP";
  if (raw === "₽") return "RUB";
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  return "USD";
}

function periodMonths(period: BillingPeriod | null, customDays?: number | null) {
  if (period === "7d") return 7 / 30;
  if (period === "3m") return 3;
  if (period === "1y") return 12;
  if (period === "custom") return (customDays && customDays > 0 ? customDays : 30) / 30;
  return 1;
}

function normalizePayDraftAmount(draft: AiDraftItem, entries: PaymentItem[]) {
  if (draft.action !== "pay" || !draft.targetItemId || draft.amountSource === "explicit") return draft;

  const entry = entries.find((item) => item.id === draft.targetItemId);
  if (!entry || entry.paymentType !== "recurring" || !entry.period) return draft;

  const invoiceMonths = periodMonths(draft.period, draft.customPeriodDays);
  const entryMonths = periodMonths(entry.period, entry.customPeriodDays);
  const multiplier = entryMonths > 0 ? invoiceMonths / entryMonths : 1;

  return {
    ...draft,
    amount: Math.round(entry.amount * multiplier * 100) / 100,
    amountSource: "derived" as const,
    currency: entry.currency,
    vendorName: draft.vendorName || entry.vendorName,
    vendorUrl: draft.vendorUrl || entry.vendorUrl,
    accountName: draft.accountName || entry.accountName,
    categoryId: draft.categoryId ?? entry.categoryId,
  };
}

function normalizeDateOnly(value: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function deriveAnnualStartFromExpiry(draft: AiDraftItem) {
  if (draft.action !== "create") return draft;
  if (draft.paymentType !== "recurring" || draft.period !== "1y") return draft;
  if (String(draft.billingStartAt || "").trim() || !draft.billingEndAt) return draft;

  const normalizedEnd = normalizeDateOnly(draft.billingEndAt);
  if (!normalizedEnd) return draft;

  const endDate = new Date(`${normalizedEnd}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) return draft;

  endDate.setUTCFullYear(endDate.getUTCFullYear() - 1);
  return {
    ...draft,
    billingStartAt: endDate.toISOString().slice(0, 10),
  };
}

export function normalizeAiDraft(draft: AiDraftItem): AiDraftItem {
  const paymentType = draft.paymentType as PaymentType;
  const action = draft.action || "create";
  const period = paymentType === "recurring" ? (draft.period as BillingPeriod | null) || "1m" : null;
  return {
    ...draft,
    action,
    name: draft.name.trim(),
    amountSource: draft.amountSource || "unknown",
    currency: normalizeCurrency(draft.currency),
    paymentType,
    period,
    targetItemId: draft.targetItemId || null,
    customPeriodDays: period === "custom" ? draft.customPeriodDays || 30 : null,
    vendorName: draft.vendorName.trim(),
    vendorUrl: draft.vendorUrl.trim(),
    accountName: draft.accountName.trim(),
    notes: draft.notes.trim(),
    shiftDates: draft.shiftDates !== false,
    shiftPaymentPeriod: draft.shiftPaymentPeriod === true,
  };
}

function periodSummary(item: AiDraftItem) {
  if (item.paymentType !== "recurring") return "one-time";
  if (item.period === "1y") return "annually";
  if (item.period === "3m") return "quarterly";
  if (item.period === "1m") return "monthly";
  if (item.period === "7d") return "weekly";
  if (item.period === "custom" && item.customPeriodDays) return `every ${item.customPeriodDays} days`;
  return "recurring";
}

function ensureUniqueQuestionIds(questions: AiQuestion[]) {
  const seen = new Map<string, number>();
  return questions.map((question) => {
    const baseId = question.id.trim() || "question";
    const count = seen.get(baseId) || 0;
    seen.set(baseId, count + 1);
    if (count === 0) return { ...question, id: baseId };
    return { ...question, id: `${baseId}_${count + 1}` };
  });
}

function isVendorQuestion(question: AiQuestion) {
  return /vendor/i.test(question.id) || /vendor/i.test(question.field) || /vendor/i.test(question.question);
}

function filterRedundantVendorQuestions(questions: AiQuestion[], items: AiDraftItem[]) {
  return questions.filter((question) => {
    if (!isVendorQuestion(question)) return true;

    const normalizedItemName = comparableLabel(question.itemName);
    if (!normalizedItemName) {
      return !items.length || items.some((item) => !item.vendorName.trim());
    }

    const linked = items.find((item) => comparableLabel(item.name) === normalizedItemName);
    return !linked || !linked.vendorName.trim();
  });
}

function importSummary(items: AiDraftItem[], fallback: string) {
  if (items.length !== 1) return fallback;

  const item = items[0];
  const vendor = item.vendorName ? ` The vendor is ${item.vendorName}${item.vendorUrl ? ` (${item.vendorUrl})` : ""}.` : "";
  const start = item.billingStartAt ? `, starting on ${item.billingStartAt}` : "";
  const renewal = item.paymentType === "recurring" ? ` and renewing ${periodSummary(item)}` : "";
  return `Successfully processed a ${item.paymentType} payment for ${item.name} for ${item.amount} ${item.currency}${start}${renewal}.${vendor}`;
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
}) {
  const maxChars = Number(process.env.AI_IMPORT_MAX_INPUT_CHARS || 20000);
  const rawInput = input.trim();
  if (!rawInput) throw new Error("Paste some text first.");
  if (rawInput.length > maxChars) throw new Error(`AI import input is too large. Limit is ${maxChars} characters.`);

  const today = new Date().toISOString().slice(0, 10);
  const result = await openRouterJson<AiImportResult>({
    schemaName: "payment_import_result",
    schema: responseSchema,
    messages: [
      {
        role: "system",
        content:
          [
            "You convert user text into tracker actions and return only JSON matching the schema.",
            "Before creating questions, read the entire user input and resolve shared context.",
            "Priority order: explicit user text beats answers, answers beat existing entries, existing entries beat vendor memory. Vendor memory is only a helper for preserving exact names/URLs when the user clearly refers to an existing vendor; it must not override a new vendor/provider named by the user.",
            "If the user says they are creating new entries, default to action=create even when item names resemble existing services. Shared or repeated service names are normal because users may track multiple instances.",
            "Treat pasted inventory/billing rows as item proposals even if the user never says create. A shared vendor/provider header (for example `vendor X, URL: ...`) can apply to the following rows unless a row overrides it.",
            "When a row contains server-like identifiers (IP address, hostname, VPS/server label, account/login plus billing columns), infer the Servers category when available and preserve IP/account/provider details in structured fields.",
            "When a row contains a domain name, registrar/provider, or expiry date, infer the Domains category when available and preserve domain/registrar details in structured fields.",
            "If the user defines a category, use it for the relevant items. If not, infer domain/server/other known category from the item data and available category definitions. Ask only if category cannot be inferred.",
            "If the user defines a vendor/provider anywhere as shared context, use that exact new or existing vendor for every relevant item that does not define its own vendor. Parse account/login/account name separately into accountName; do not merge account into vendorName. Do not ask a vendor or account question and do not suggest vendorMemory alternatives when the user supplied that value.",
            "Only ask for vendor when no vendor/provider is present in user input, vendor conflicts between user-provided sources, or it is genuinely unclear which user-provided vendor applies.",
            "Choose action=create for new entries, action=edit for metadata changes to existing entries, and action=pay for completed billing or renewal events on existing entries.",
            "For row-based billing data, if two dates are present in order treat them as billingStartAt then billingEndAt. If a domain row has only an expiry date, default to recurring period=1y, set billingEndAt to expiry, and set billingStartAt to one year before expiry.",
            "If a billing row ends with a bare numeric value, treat it as amount. Use provided currency when present; if currency is missing, keep default currency and mention the assumption in confidence instead of dropping the item.",
            "For category-specific fields, use exact field ids in customFields. If a selected category has required fields, fill them from the user text when present; ask only for required fields that are actually missing.",
            "Do not invent required facts such as category, target id, amount, dates, period, vendor, URL, or custom field values.",
            "Normalize recognizable dates to YYYY-MM-DD and use the provided today value for relative date words.",
            "Use explicit amount/currency/period values when present; if a value is missing or unclear, ask instead of guessing.",
          ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          today,
          allowedPeriods: ["7d", "1m", "3m", "1y", "custom"],
          categories: categoryContext(categories),
          existingEntries: entryContext(entries),
          vendorMemory: vendorContext(vendors),
          answers,
          input: rawInput,
        }),
      },
    ],
  });

  const parsed = aiImportResultSchema.parse(result);
  const items = parsed.items.map((item) =>
    normalizeAiDraft(deriveAnnualStartFromExpiry(normalizePayDraftAmount(applyExplicitAccount(item, rawInput, vendors), entries))),
  );
  const questions = filterRedundantVendorQuestions(ensureUniqueQuestionIds(parsed.questions), items);
  return {
    ...parsed,
    questions,
    summary: explicitAccountFromInput(rawInput) ? importSummary(items, parsed.summary) : parsed.summary,
    items,
  };
}
