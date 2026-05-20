import { z } from "zod";

export const EXPORT_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const billingPeriodSchema = z.enum(["7d", "1m", "3m", "1y", "custom"]);
const paymentTypeSchema = z.enum(["single", "recurring"]);
const fieldTypeSchema = z.enum(["text", "url", "number", "date", "checkbox", "select", "textarea"]);

export const exportSectionSchema = z.enum(["workspace", "categories", "entries", "folders", "invoices", "websiteNotifications"]);
export type ExportSection = z.infer<typeof exportSectionSchema>;

export const exportWorkspaceOptionsSchema = z.object({
  includeWorkspace: z.boolean().default(true),
  includeCategories: z.boolean().default(true),
  includeEntries: z.boolean().default(true),
  includeFolders: z.boolean().default(true),
  includeInvoices: z.boolean().default(false),
  includeWebsiteNotifications: z.boolean().default(false),
});
export type ExportWorkspaceOptions = z.infer<typeof exportWorkspaceOptionsSchema>;

export const portableCategoryFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeSchema,
  required: z.boolean(),
  bold: z.boolean(),
  color: z.string().default(""),
  showInTable: z.boolean(),
  copyable: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export const portableCategorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().default("Sparkles"),
  color: z.string().default("#8b5cf6"),
  sortOrder: z.number().int().nonnegative().default(0),
  fields: z.array(portableCategoryFieldSchema).default([]),
});
export type PortableCategory = z.infer<typeof portableCategorySchema>;

export const portableEntrySchema = z.object({
  name: z.string().min(1),
  categoryName: z.string().default(""),
  paymentType: paymentTypeSchema,
  amount: z.number().finite(),
  currency: z.string().min(1).max(12).default("USD"),
  billingStartAt: z.string().nullable().default(null),
  billingEndAt: z.string().nullable().default(null),
  period: billingPeriodSchema.nullable().default(null),
  customPeriodDays: z.number().int().positive().nullable().default(null),
  vendorName: z.string().default(""),
  vendorUrl: z.string().default(""),
  accountName: z.string().default(""),
  notes: z.string().default(""),
  customFields: z.record(z.string(), z.unknown()).default({}),
});
export type PortableEntry = z.infer<typeof portableEntrySchema>;

export const portableFolderSchema = z.object({
  name: z.string().min(1),
  entryNames: z.array(z.string()).default([]),
  categoryNames: z.array(z.string()).default([]),
});
export type PortableFolder = z.infer<typeof portableFolderSchema>;

export const portableInvoiceSchema = z.object({
  itemName: z.string().default(""),
  categoryName: z.string().default(""),
  vendorName: z.string().default(""),
  vendorUrl: z.string().default(""),
  accountName: z.string().default(""),
  amount: z.number().finite(),
  currency: z.string().min(1).max(12).default("USD"),
  paymentDate: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  period: billingPeriodSchema.nullable().default(null),
  customPeriodDays: z.number().int().positive().nullable().default(null),
  shiftDates: z.boolean().default(false),
  shiftPaymentPeriod: z.boolean().default(false),
});
export type PortableInvoice = z.infer<typeof portableInvoiceSchema>;

export const portableWebsiteNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(""),
  itemName: z.string().default(""),
  categoryName: z.string().default(""),
  createdAt: z.string().default(""),
});
export type PortableWebsiteNotification = z.infer<typeof portableWebsiteNotificationSchema>;

export const workspaceExportPayloadSchema = z.object({
  app: z.literal("mc-tracker"),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  source: z.object({
    workspaceName: z.string(),
    workspaceEmoji: z.string(),
  }),
  sections: z.array(exportSectionSchema),
  workspace: z
    .object({
      name: z.string().min(1),
      emoji: z.string().min(1),
    })
    .optional(),
  categories: z.array(portableCategorySchema).default([]),
  entries: z.array(portableEntrySchema).default([]),
  folders: z.array(portableFolderSchema).default([]),
  invoices: z.array(portableInvoiceSchema).default([]),
  websiteNotifications: z.array(portableWebsiteNotificationSchema).default([]),
});
export type WorkspaceExportPayload = z.infer<typeof workspaceExportPayloadSchema>;

export const selectedEntriesExportPayloadSchema = z.object({
  app: z.literal("mc-tracker"),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  source: z.object({
    workspaceName: z.string(),
    workspaceEmoji: z.string(),
  }),
  sections: z.tuple([z.literal("categories"), z.literal("entries")]),
  categories: z.array(portableCategorySchema),
  entries: z.array(portableEntrySchema).min(1),
});
export type SelectedEntriesExportPayload = z.infer<typeof selectedEntriesExportPayloadSchema>;

export const anyExportPayloadSchema = z.union([workspaceExportPayloadSchema, selectedEntriesExportPayloadSchema]);
export type AnyExportPayload = z.infer<typeof anyExportPayloadSchema>;

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
}

export function categoryKey(name: string) {
  return normalizeCategoryName(name);
}

export function buildEntrySignature(entry: PortableEntry) {
  function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = canonicalize(obj[key]);
          return acc;
        }, {});
    }
    return value ?? null;
  }

  const normalizedCustomFields = JSON.stringify(canonicalize(entry.customFields || {}));
  return [
    entry.name.trim().toLowerCase(),
    categoryKey(entry.categoryName || ""),
    entry.vendorName.trim().toLowerCase(),
    entry.vendorUrl.trim().toLowerCase(),
    entry.accountName.trim().toLowerCase(),
    Number(entry.amount || 0).toFixed(6),
    (entry.currency || "USD").trim().toUpperCase(),
    entry.paymentType,
    entry.billingStartAt || "",
    entry.billingEndAt || "",
    entry.period || "",
    entry.customPeriodDays === null ? "" : String(entry.customPeriodDays),
    entry.notes.trim(),
    normalizedCustomFields,
  ].join("\u001f");
}

export function parseImportPayload(rawJson: string) {
  if (!rawJson.trim()) throw new Error("Import file is empty.");
  if (rawJson.length > MAX_IMPORT_BYTES) throw new Error("Import file is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Import file is not valid JSON.");
  }
  return anyExportPayloadSchema.parse(parsed);
}
