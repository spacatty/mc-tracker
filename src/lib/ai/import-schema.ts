import { z } from "zod";

/**
 * Contract between the import parser and the model. This schema is the single
 * source of truth: it is converted to JSON Schema for the provider's structured
 * output mode and used to validate whatever comes back. Every field is required
 * (nullable when unknown) because strict structured-output modes reject optional
 * properties, and an explicit null is easier for the model than omission.
 */

const isoDate = z
  .string()
  .nullable()
  .describe("Calendar date as YYYY-MM-DD, or null when the input does not state it.");

export const aiOutputItemSchema = z
  .object({
    action: z
      .enum(["create", "edit", "pay"])
      .describe("create = new entry; edit = change metadata of an existing entry; pay = record a completed payment/renewal of an existing entry."),
    targetItemId: z
      .number()
      .int()
      .nullable()
      .describe("id from existingEntries for edit/pay, otherwise null. Never invent ids."),
    name: z.string().describe("Short entry name, e.g. the domain, server label or service name."),
    categoryId: z.number().int().nullable().describe("id from categories, or null when no category fits."),
    paymentType: z.enum(["single", "recurring"]),
    amount: z.number().nullable().describe("Price for one billing period. null when the input has no amount."),
    amountSource: z
      .enum(["explicit", "derived", "unknown"])
      .describe("explicit = amount written in the input; derived = computed from other input values; unknown = not given."),
    currency: z.string().nullable().describe("ISO 4217 code such as USD or EUR, or null when not stated."),
    billingStartAt: isoDate,
    billingEndAt: isoDate.describe("Expiry / next renewal / paid-until date as YYYY-MM-DD, or null."),
    period: z
      .enum(["7d", "1m", "3m", "1y", "custom"])
      .nullable()
      .describe("Billing period for recurring entries; null for single payments."),
    customPeriodDays: z.number().int().nullable().describe("Days per period when period is custom, otherwise null."),
    vendorName: z.string().describe("Provider, registrar or host. Empty string when unknown."),
    vendorUrl: z.string().describe("Vendor or panel URL. Empty string when unknown."),
    accountName: z.string().describe("Login / account / username at the vendor, kept separate from vendorName. Empty string when unknown."),
    notes: z.string().describe("Useful leftover details from the input that have no field. Empty string when none."),
    customFields: z
      .array(
        z
          .object({
            fieldId: z.string().describe("id of a field in the chosen category."),
            value: z.string(),
          })
          .strict(),
      )
      .describe("Values for the chosen category's custom fields. Only use field ids listed for that category."),
    confidence: z.string().describe("One short sentence naming any assumption made for this row, or empty string."),
  })
  .strict();

export const aiOutputQuestionSchema = z
  .object({
    id: z.string().describe("Stable snake_case id for the question."),
    question: z.string(),
    itemName: z.string().describe("Name of the row the question is about, or empty string if it applies to all."),
    suggestions: z.array(z.string()).describe("Up to 4 short candidate answers."),
  })
  .strict();

export const aiImportOutputSchema = z
  .object({
    items: z.array(aiOutputItemSchema),
    questions: z.array(aiOutputQuestionSchema).describe("Only for facts that block a correct import. Empty when the rows are usable."),
    summary: z.string().describe("One sentence describing what was found."),
  })
  .strict();

export type AiImportOutput = z.infer<typeof aiImportOutputSchema>;
export type AiOutputItem = z.infer<typeof aiOutputItemSchema>;

/** Normalized row handed to the review grid after server-side validation. */
export type AiDraftItem = {
  action: "create" | "edit" | "pay";
  targetItemId: number | null;
  name: string;
  categoryId: number | null;
  paymentType: "single" | "recurring";
  amount: number;
  amountSource: "explicit" | "derived" | "unknown";
  currency: string;
  billingStartAt: string | null;
  billingEndAt: string | null;
  period: "7d" | "1m" | "3m" | "1y" | "custom" | null;
  customPeriodDays: number | null;
  vendorName: string;
  vendorUrl: string;
  accountName: string;
  notes: string;
  customFields: Record<string, unknown>;
  shiftDates: boolean;
  shiftPaymentPeriod: boolean;
  confidence: string;
};

export type AiQuestion = z.infer<typeof aiOutputQuestionSchema>;

export type AiImportResult = {
  items: AiDraftItem[];
  questions: AiQuestion[];
  summary: string;
  model: string;
};
