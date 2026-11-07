import type { PaymentItem } from "./types";

export type MessageTemplate = { id: number; name: string; body: string };
export type NotificationUnit = {
  id: number;
  name: string;
  enabled: boolean;
  scope: "selected" | "global";
  workspaceIds: number[];
  categoryIds: number[];
  entryIds: number[];
  excludedIds: number[];
  autoInclude: boolean;
  mode: "reminder" | "summary";
  beforeDays: number;
  overdueDays: number;
  repeat: boolean;
  interval: number;
  intervalUnit: "days" | "hours";
  time: string;
  timezone: string;
  startDate: string;
  endDate: string;
  templateId: number | null;
  channelIds: number[];
  website: boolean;
};

export const DEFAULT_TEMPLATE = "<b>{{entry.name}}</b> · {{entry.amount}} {{entry.currency}}\n{{due.status}} · {{due.date}}\n{{workspace.name}} / {{category.name}}\n{{entry.host}}";
export const DEFAULT_SUMMARY_TEMPLATE = "<b>{{unit.name}}</b> · {{summary.count}}\n{{summary.entries}}";
export const TEMPLATE_VARIABLES = ["entry.name", "entry.amount", "entry.currency", "entry.host", "entry.vendor", "entry.url", "entry.account", "due.date", "due.days", "due.status", "workspace.name", "category.name", "unit.name", "summary.count", "summary.entries"];

export function newNotificationUnit(timezone = "UTC"): NotificationUnit {
  return { id: 0, name: "", enabled: true, scope: "selected", workspaceIds: [], categoryIds: [], entryIds: [], excludedIds: [], autoInclude: true, mode: "reminder", beforeDays: 3, overdueDays: 0, repeat: true, interval: 1, intervalUnit: "days", time: "12:30", timezone, startDate: "", endDate: "", templateId: null, channelIds: [], website: true };
}

export function escapeMessage(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function validateTemplate(body: string) {
  if (!body.trim() || body.length > 3500) throw new Error("Use a message template between 1 and 3,500 characters.");
  for (const match of body.matchAll(/{{\s*([^{}]+?)\s*}}/g)) {
    if (!TEMPLATE_VARIABLES.includes(match[1].trim())) throw new Error(`Unknown variable: ${match[1]}`);
  }
  const withoutVariables = body.replace(/{{\s*[^{}]+?\s*}}/g, "");
  if (/[{}]/.test(withoutVariables)) throw new Error("Variables must use {{variable.name}}.");
  const stack: string[] = [];
  for (const match of withoutVariables.matchAll(/<([^>]*)>/g)) {
    if (!/^\/?(b|i|u|s|code|pre)$/.test(match[1])) throw new Error("Supported formatting: <b>, <i>, <u>, <s>, <code>, <pre>.");
    const tag = match[1];
    if (tag.startsWith("/")) {
      if (stack.pop() !== tag.slice(1)) throw new Error("Message formatting tags must be balanced.");
    } else stack.push(tag);
  }
  if (stack.length) throw new Error("Message formatting tags must be balanced.");
  if (/[<>]/.test(withoutVariables.replace(/<\/?(?:b|i|u|s|code|pre)>/g, ""))) throw new Error("Escape literal angle brackets with &lt; or &gt;.");
}

export function renderMessage(body: string, values: Record<string, string | number>): string {
  return body.replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, "&amp;").replace(/{{\s*([^{}]+?)\s*}}/g, (_, key: string) => escapeMessage(values[key.trim()] ?? ""))
    .split("\n").filter((line) => line.trim()).join("\n");
}

export function composeUnitMessage(mode: NotificationUnit["mode"], template: string | null, values: Record<string, string | number>) {
  const body = template || (mode === "summary" ? DEFAULT_SUMMARY_TEMPLATE : DEFAULT_TEMPLATE);
  const message = renderMessage(body, values);
  return mode === "summary" && template && !/{{\s*summary\.entries\s*}}/.test(template)
    ? `${message}\n\n${renderMessage("{{summary.entries}}", values)}` : message;
}

// Rendering is escaped first; only the supported, attribute-free formatting tags survive.
export function messagePreviewHtml(message: string) {
  return escapeMessage(message).replace(/&lt;(\/?(?:b|i|u|s|code|pre))&gt;/g, "<$1>")
    .replaceAll("&amp;lt;", "&lt;").replaceAll("&amp;gt;", "&gt;").replaceAll("&amp;quot;", "&quot;").replaceAll("&amp;#39;", "&#39;").replaceAll("&amp;amp;", "&amp;");
}

export function selectedEntries(unit: NotificationUnit, entries: PaymentItem[]) {
  return entries.filter((entry) => !entry.archivedAt && entry.workspaceId && (unit.scope === "global" || unit.workspaceIds.includes(entry.workspaceId)) && !unit.excludedIds.includes(entry.id) && (unit.entryIds.includes(entry.id) || (unit.autoInclude && entry.categoryId !== null && unit.categoryIds.includes(entry.categoryId))));
}

export function zonedClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (key: string) => parts.find((part) => part.type === key)!.value;
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const minute = Number(value("hour")) * 60 + Number(value("minute"));
  return { date, minute, day: Date.parse(`${date}T00:00:00Z`) / 86400000 };
}

export function dueDays(entry: Pick<PaymentItem, "billingEndAt">, localDate: string) {
  if (!entry.billingEndAt) return null;
  const due = Date.parse(`${entry.billingEndAt.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(due) ? Math.round((due - Date.parse(`${localDate}T00:00:00Z`)) / 86400000) : null;
}

/** A stable local-calendar slot catches up today's missed tick, without replaying old days. */
export function scheduleSlot(unit: NotificationUnit, now: Date): string | null {
  const clock = zonedClock(now, unit.timezone);
  if ((unit.startDate && clock.date < unit.startDate) || (unit.endDate && clock.date > unit.endDate)) return null;
  const [hour, minute] = unit.time.split(":").map(Number);
  const startMinute = hour * 60 + minute;
  const anchor = unit.startDate ? Date.parse(`${unit.startDate}T00:00:00Z`) / 86400000 : 0;
  if (!unit.repeat || unit.intervalUnit === "days") {
    if (clock.minute < startMinute) return null;
    if (unit.repeat && (clock.day - anchor) % unit.interval !== 0) return null;
    return clock.date;
  }
  const elapsed = (clock.day - anchor) * 1440 + clock.minute - startMinute;
  if (elapsed < 0) return null;
  return `${anchor}:${Math.floor(elapsed / (unit.interval * 60))}`;
}

export function entryScheduleSlot(unit: NotificationUnit, entry: Pick<PaymentItem, "billingEndAt">, now: Date) {
  if (!entry.billingEndAt) return null;
  const due = Date.parse(`${entry.billingEndAt.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(due)) return null;
  const threshold = new Date(due - unit.beforeDays * 86400000).toISOString().slice(0, 10);
  return scheduleSlot({ ...unit, startDate: unit.startDate > threshold ? unit.startDate : threshold }, now);
}

export function sampleMessageValues(now = new Date()): Record<string, string | number> {
  return { "entry.name": "Atlas · VPS", "entry.amount": "24.00", "entry.currency": "USD", "entry.host": "atlas.example.com", "entry.vendor": "Hetzner", "entry.url": "https://example.com", "entry.account": "Production", "due.date": new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10), "due.days": 3, "due.status": "Due in 3 days", "workspace.name": "Infrastructure", "category.name": "Servers", "unit.name": "Upcoming payments", "summary.count": 1, "summary.entries": "Atlas · VPS · 24.00 USD · Due in 3 days" };
}

export function entryMessageValues(entry: PaymentItem, workspace: string, unit: string, localDate: string): Record<string, string | number> {
  const days = dueDays(entry, localDate);
  return { "entry.name": entry.name, "entry.amount": entry.amount, "entry.currency": entry.currency, "entry.host": entry.host || "", "entry.vendor": entry.vendorName, "entry.url": entry.vendorUrl, "entry.account": entry.accountName, "due.date": entry.billingEndAt?.slice(0, 10) || "—", "due.days": days ?? "—", "due.status": days === null ? "No due date" : days < 0 ? `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}` : days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`, "workspace.name": workspace, "category.name": entry.categoryName || "Uncategorized", "unit.name": unit, "summary.count": 1, "summary.entries": "" };
}
