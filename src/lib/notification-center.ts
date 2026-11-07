import "server-only";
import { z } from "zod";
import { getDb, listCategoriesForWorkspace, listItemsForWorkspace, listNotificationChannelsForWorkspace, listWorkspacesForUser, requireWorkspaceEditor, sendTelegramMessage } from "./db";
import { composeUnitMessage, dueDays, entryMessageValues, entryScheduleSlot, renderMessage, sampleMessageValues, scheduleSlot, selectedEntries, validateTemplate, zonedClock, type MessageTemplate, type NotificationUnit } from "./notification-config";

function database() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notification_units (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_json TEXT NOT NULL, last_error TEXT, last_sent_at TEXT);
    CREATE TABLE IF NOT EXISTS notification_unit_deliveries (
    unit_id INTEGER NOT NULL REFERENCES notification_units(id) ON DELETE CASCADE,
    delivery_key TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY (unit_id, delivery_key));`);
  return db;
}

const ids = z.array(z.number().int().positive()).max(10000);
const date = z.string().refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, "Invalid calendar date");
const unitSchema = z.object({
  id: z.number().int().nonnegative(), name: z.string().trim().min(1).max(100), enabled: z.boolean(),
  scope: z.enum(["selected", "global"]), workspaceIds: ids, categoryIds: ids, entryIds: ids, excludedIds: ids, autoInclude: z.boolean(),
  mode: z.enum(["reminder", "summary"]), beforeDays: z.number().int().min(0).max(3650), overdueDays: z.number().int().min(0).max(3650), repeat: z.boolean(),
  interval: z.number().int().min(1).max(365), intervalUnit: z.enum(["days", "hours"]), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().max(100).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone"),
  startDate: date, endDate: date, templateId: z.number().int().positive().nullable(), channelIds: ids, website: z.boolean(),
});

export function listMessageTemplates(userId: number): MessageTemplate[] {
  return database().prepare("SELECT id, name, body FROM message_templates WHERE user_id = ? ORDER BY name").all(userId) as MessageTemplate[];
}

export function saveMessageTemplate(userId: number, input: unknown) {
  const template = z.object({ id: z.number().int().nonnegative(), name: z.string().trim().min(1).max(100), body: z.string() }).parse(input);
  validateTemplate(template.body);
  const db = database();
  if (template.id) {
    if (!db.prepare("UPDATE message_templates SET name = ?, body = ? WHERE id = ? AND user_id = ?").run(template.name, template.body, template.id, userId).changes) throw new Error("Template not found.");
    return template.id;
  }
  return Number(db.prepare("INSERT INTO message_templates (user_id, name, body) VALUES (?, ?, ?)").run(userId, template.name, template.body).lastInsertRowid);
}

export function deleteMessageTemplate(userId: number, id: number) {
  const db = database();
  if (listNotificationUnits(userId).some((unit) => unit.templateId === id)) throw new Error("This template is used by a notification unit. Choose another template there first.");
  db.prepare("DELETE FROM message_templates WHERE id = ? AND user_id = ?").run(id, userId);
}

export type StoredNotificationUnit = NotificationUnit & { lastError: string | null; lastSentAt: string | null };
export function listNotificationUnits(userId: number): StoredNotificationUnit[] {
  const rows = database().prepare("SELECT * FROM notification_units WHERE user_id = ? ORDER BY id DESC").all(userId) as { id: number; config_json: string; last_error: string | null; last_sent_at: string | null }[];
  return rows.map((row) => ({ ...JSON.parse(row.config_json), id: row.id, lastError: row.last_error, lastSentAt: row.last_sent_at }));
}

export function notificationCenterData(userId: number) {
  const workspaces = listWorkspacesForUser(userId);
  return {
    workspaces: workspaces.map(({ id, name, accessRole }) => ({ id, name, accessRole })),
    categories: workspaces.flatMap((workspace) => listCategoriesForWorkspace(workspace.id, userId)),
    // Only notification-relevant public entry fields cross the client boundary.
    entries: workspaces.flatMap((workspace) => listItemsForWorkspace(workspace.id, userId).map((entry) => ({ ...entry, notes: "", customFields: {} }))),
    channels: workspaces.filter((workspace) => workspace.accessRole !== "viewer").flatMap((workspace) => listNotificationChannelsForWorkspace(workspace.id, userId).filter((channel) => channel.type === "telegram").map(({ id, title, workspaceId }) => ({ id, title, workspaceId }))),
    templates: listMessageTemplates(userId), units: listNotificationUnits(userId),
  };
}
export type NotificationCenterData = ReturnType<typeof notificationCenterData>;

export function saveNotificationUnit(userId: number, input: unknown) {
  const unit = unitSchema.parse(input);
  const db = database();
  const data = notificationCenterData(userId);
  if (unit.id && !data.units.some((existing) => existing.id === unit.id)) throw new Error("Notification unit not found.");
  if (unit.startDate && unit.endDate && unit.endDate < unit.startDate) throw new Error("End date must follow start date.");
  if (unit.scope === "selected" && !unit.workspaceIds.length) throw new Error("Select at least one workspace.");
  const allowed = new Set(data.workspaces.map((workspace) => workspace.id));
  if (unit.workspaceIds.some((id) => !allowed.has(id))) throw new Error("Workspace access denied.");
  const sources = new Set(unit.scope === "global" ? [...allowed] : unit.workspaceIds);
  if (unit.categoryIds.some((id) => !data.categories.some((category) => category.id === id && category.workspaceId && sources.has(category.workspaceId)))) throw new Error("Category is outside the selected workspaces.");
  if ([...unit.entryIds, ...unit.excludedIds].some((id) => !data.entries.some((entry) => entry.id === id && entry.workspaceId && sources.has(entry.workspaceId)))) throw new Error("Entry is outside the selected workspaces.");
  if (!selectedEntries(unit, data.entries).length && !unit.categoryIds.length) throw new Error("Select categories or entries for this unit.");
  if (!unit.website && !unit.channelIds.length) throw new Error("Choose at least one destination.");
  if (unit.channelIds.some((id) => !data.channels.some((channel) => channel.id === id))) throw new Error("Destination access denied.");
  if (unit.website) for (const id of sources) requireWorkspaceEditor(id, userId);
  if (unit.templateId && !data.templates.some((template) => template.id === unit.templateId)) throw new Error("Template not found.");
  if (!unit.startDate) unit.startDate = zonedClock(new Date(), unit.timezone).date;
  if (!unit.autoInclude) {
    unit.entryIds = [...new Set(unit.entryIds)];
    // Categories are UI selection context only when the snapshot switch is off.
  }
  const json = JSON.stringify(unit);
  if (unit.id) db.prepare("UPDATE notification_units SET config_json = ?, last_error = NULL WHERE id = ? AND user_id = ?").run(json, unit.id, userId);
  else unit.id = Number(db.prepare("INSERT INTO notification_units (user_id, config_json) VALUES (?, ?)").run(userId, json).lastInsertRowid);
  return unit.id;
}

export function deleteNotificationUnit(userId: number, id: number) {
  database().prepare("DELETE FROM notification_units WHERE id = ? AND user_id = ?").run(id, userId);
}

export async function testMessageTemplate(userId: number, input: unknown) {
  const test = z.object({ body: z.string(), channelId: z.number().int().positive(), entryId: z.number().int().positive().nullable() }).parse(input);
  validateTemplate(test.body);
  const data = notificationCenterData(userId);
  const channel = data.channels.find((candidate) => candidate.id === test.channelId);
  if (!channel?.workspaceId) throw new Error("Choose an accessible Telegram route.");
  const route = listNotificationChannelsForWorkspace(channel.workspaceId, userId).find((candidate) => candidate.id === channel.id)!;
  const entry = test.entryId ? data.entries.find((candidate) => candidate.id === test.entryId) : null;
  if (test.entryId && !entry) throw new Error("Entry access denied.");
  const values = entry ? entryMessageValues(entry, data.workspaces.find((workspace) => workspace.id === entry.workspaceId)?.name || "", "Test notification", zonedClock(new Date(), "UTC").date) : sampleMessageValues();
  values["summary.entries"] = `${values["entry.name"]} · ${values["entry.amount"]} ${values["entry.currency"]} · ${values["due.status"]}`;
  await sendTelegramMessage(route, renderMessage(test.body, values));
}

export async function runNotificationCenter(now = new Date()) {
  const db = database();
  const owners = db.prepare("SELECT DISTINCT user_id FROM notification_units").all() as { user_id: number }[];
  let sent = 0;
  let skipped = 0;
  for (const { user_id: userId } of owners) {
    const data = notificationCenterData(userId);
    for (const unit of data.units) {
      if (!unit.enabled) continue;
      try {
        const slot = unit.mode === "summary" ? scheduleSlot(unit, now) : "per-entry";
        if (!slot) continue;
        const clock = zonedClock(now, unit.timezone);
        const matching = selectedEntries(unit, data.entries).filter((entry) => {
          const days = dueDays(entry, clock.date);
          return days !== null && days <= unit.beforeDays && days >= -unit.overdueDays && (unit.mode === "summary" || entryScheduleSlot(unit, entry, now) !== null);
        }).sort((a, b) => (a.billingEndAt || "").localeCompare(b.billingEndAt || ""));
        if (!matching.length) continue;
        const template = unit.templateId ? data.templates.find((candidate) => candidate.id === unit.templateId)?.body : null;
        if (unit.templateId && !template) throw new Error("Message template was removed.");
        const bodyFor = (group: typeof matching) => {
          const entry = group[0];
          const values = entryMessageValues(entry, data.workspaces.find((workspace) => workspace.id === entry.workspaceId)?.name || "", unit.name, clock.date);
          values["summary.count"] = group.length;
          values["summary.entries"] = group.map((item) => {
            const itemValues = entryMessageValues(item, data.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name || "", unit.name, clock.date);
            return `${item.name} ? ${item.amount} ${item.currency} ? ${itemValues["due.status"]} ? ${itemValues["workspace.name"]}`;
          }).join("\n");
          return composeUnitMessage(unit.mode, template || null, values);
        };
        const groups: (typeof matching)[] = [];
        for (const entry of matching) {
          const previous = groups.at(-1);
          if (unit.mode === "summary" && previous && bodyFor([...previous, entry]).length <= 4000) previous.push(entry);
          else groups.push([entry]);
        }
        const errors: string[] = [];
        const routes = unit.channelIds.map((id) => {
          const destination = data.channels.find((candidate) => candidate.id === id);
          if (!destination?.workspaceId) { errors.push("A Telegram destination is no longer accessible."); return null; }
          return listNotificationChannelsForWorkspace(destination.workspaceId, userId).find((channel) => channel.id === id)!;
        });
        for (const [index, group] of groups.entries()) {
          const entry = group[0];
          const values = entryMessageValues(entry, "", unit.name, clock.date);
          const body = bodyFor(group);
          if (body.length > 4000) throw new Error("An entry's message exceeds Telegram's limit. Use a shorter template.");
          const identity = unit.mode === "summary" ? `summary:${index}` : `${entry.id}:${entry.billingEndAt?.slice(0, 10)}`;
          const deliverySlot = unit.repeat ? unit.mode === "summary" ? slot : entryScheduleSlot(unit, entry, now)! : "once";
          const deliver = async (destination: string, send: () => Promise<void> | void) => {
            const key = `${identity}:${deliverySlot}:${destination}`;
            // A short lease prevents concurrent cron runs from duplicating an in-flight delivery.
            db.prepare("DELETE FROM notification_unit_deliveries WHERE unit_id = ? AND delivery_key = ? AND state = 'pending' AND created_at < ?").run(unit.id, key, new Date(now.getTime() - 300000).toISOString());
            const claimed = db.prepare("INSERT OR IGNORE INTO notification_unit_deliveries VALUES (?, ?, 'pending', ?)").run(unit.id, key, now.toISOString()).changes;
            if (!claimed) { skipped++; return; }
            try {
              await send();
              db.prepare("UPDATE notification_unit_deliveries SET state = 'sent' WHERE unit_id = ? AND delivery_key = ?").run(unit.id, key);
              db.prepare("UPDATE notification_units SET last_sent_at = ?, last_error = NULL WHERE id = ?").run(now.toISOString(), unit.id);
              sent++;
            } catch (error) {
              db.prepare("DELETE FROM notification_unit_deliveries WHERE unit_id = ? AND delivery_key = ?").run(unit.id, key);
              errors.push(error instanceof Error ? error.message : "Delivery failed");
            }
          };
          if (unit.website) {
            const workspaceIds = [...new Set(group.map((item) => item.workspaceId!))];
            for (const workspaceId of workspaceIds) {
              await deliver(`website:${workspaceId}`, () => {
                requireWorkspaceEditor(workspaceId, userId);
                const workspaceBody = bodyFor(group.filter((item) => item.workspaceId === workspaceId));
                const text = workspaceBody.replace(/<\/?(?:b|i|u|s|code|pre)>/g, "").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
                db.prepare("INSERT INTO notifications (workspace_id, title, body, item_id, category_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(workspaceId, unit.mode === "summary" ? unit.name : `${entry.name} · ${values["due.status"]}`, text, unit.mode === "summary" ? null : entry.id, unit.mode === "summary" ? null : entry.categoryId, now.toISOString());
              });
            }
          }
          for (const route of routes) if (route) await deliver(`telegram:${route.id}`, () => sendTelegramMessage(route, body));
        }
        db.prepare("UPDATE notification_units SET last_error = ? WHERE id = ?").run(errors.length ? [...new Set(errors)].join("; ") : null, unit.id);
      } catch (error) {
        db.prepare("UPDATE notification_units SET last_error = ? WHERE id = ?").run(error instanceof Error ? error.message : "Delivery failed", unit.id);
      }
    }
  }
  return { sent, skipped };
}
