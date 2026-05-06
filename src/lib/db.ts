import "server-only";

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import mysql from "mysql2/promise";
import type {
  BillingPeriod,
  Category,
  CategoryField,
  DashboardStats,
  Folder,
  Invoice,
  NotificationChannel,
  PaymentItem,
  PaymentType,
  ShareRole,
  User,
  UserRole,
  VendorSuggestion,
  Workspace,
  WorkspaceRole,
  WebsiteNotification,
} from "./types";
import { ensureSupportedCurrency } from "./currencies";
import { addBillingPeriod, normalizeMonthlyAmount, nowIso, slugify } from "./utils";
import {
  buildEntrySignature,
  categoryKey,
  type AnyExportPayload,
  type ExportWorkspaceOptions,
  exportWorkspaceOptionsSchema,
  portableCategorySchema,
  portableEntrySchema,
  portableFolderSchema,
  portableInvoiceSchema,
  portableWebsiteNotificationSchema,
  selectedEntriesExportPayloadSchema,
  workspaceExportPayloadSchema,
} from "./workspace-export";

const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "mc-tracker.sqlite");

type DbRow = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function bool(value: unknown) {
  return value === 1 || value === true;
}

function columnExists(db: Database.Database, table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as DbRow[]).some((row) => row.name === column);
}

function normalizeDate(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Accept both date-only values (YYYY-MM-DD) and full ISO datetimes from AI imports.
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date format: ${raw}`);
  }
  return parsed.toISOString();
}

function dayStart(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.round((dayStart(end).getTime() - dayStart(start).getTime()) / 86_400_000);
}

function currentDueDate(item: Pick<PaymentItem, "billingEndAt">) {
  if (!item.billingEndAt) return null;
  const due = new Date(item.billingEndAt);
  if (Number.isNaN(due.getTime())) return null;
  return dayStart(due);
}

function nextForecastPaymentDate(item: Pick<PaymentItem, "billingEndAt" | "period" | "customPeriodDays">, from = new Date()) {
  if (!item.billingEndAt || !item.period) return null;
  const due = currentDueDate(item);
  if (!due) return null;
  let next = due;
  const today = dayStart(from);
  while (next < today) {
    next = dayStart(addBillingPeriod(next, item.period, item.customPeriodDays));
  }
  return next;
}

function mapUser(row: DbRow): User {
  return {
    id: Number(row.id),
    username: String(row.username),
    role: row.role as UserRole,
    totpEnabled: bool(row.totp_enabled),
    premium: bool(row.premium),
    displayCurrency: String(row.display_currency || "USD").trim().toUpperCase() || "USD",
    createdAt: String(row.created_at),
  };
}

function mapCategory(row: DbRow): Category {
  const fields = parseJson<CategoryField[]>(row.fields_json, []);
  return {
    id: Number(row.id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined ? null : Number(row.workspace_id),
    name: String(row.name),
    icon: String(row.icon || "Sparkles"),
    color: String(row.color || "#8b5cf6"),
    sortOrder: Number(row.sort_order || 0),
    fields: Array.isArray(fields) ? fields : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapItem(row: DbRow): PaymentItem {
  return {
    id: Number(row.id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined ? null : Number(row.workspace_id),
    name: String(row.name),
    categoryId: row.category_id === null ? null : Number(row.category_id),
    categoryName: row.category_name ? String(row.category_name) : undefined,
    categoryIcon: row.category_icon ? String(row.category_icon) : undefined,
    categoryColor: row.category_color ? String(row.category_color) : undefined,
    paymentType: row.payment_type as PaymentType,
    amount: Number(row.amount || 0),
    currency: String(row.currency || "USD"),
    billingStartAt: row.billing_start_at ? String(row.billing_start_at) : null,
    billingEndAt: row.billing_end_at ? String(row.billing_end_at) : null,
    period: row.period ? (row.period as BillingPeriod) : null,
    customPeriodDays: row.custom_period_days === null ? null : Number(row.custom_period_days),
    vendorName: String(row.vendor_name || ""),
    vendorUrl: String(row.vendor_url || ""),
    accountName: String(row.account_name || ""),
    notes: String(row.notes || ""),
    customFields: parseJson<Record<string, unknown>>(row.custom_fields_json, {}),
    ownerId: row.owner_id === null ? null : Number(row.owner_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFolder(row: DbRow): Folder {
  return {
    id: Number(row.id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined ? null : Number(row.workspace_id),
    name: String(row.name),
    ownerId: Number(row.owner_id),
    ownerUsername: row.owner_username ? String(row.owner_username) : undefined,
    accessRole: row.access_role ? (String(row.access_role) as Folder["accessRole"]) : undefined,
    createdAt: String(row.created_at),
    itemCount: Number(row.item_count || 0),
    categoryCount: Number(row.category_count || 0),
    memberCount: Number(row.member_count || 0),
  };
}

function mapNotificationChannel(row: DbRow): NotificationChannel {
  return {
    id: Number(row.id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined ? null : Number(row.workspace_id),
    type: row.type as NotificationChannel["type"],
    title: String(row.title),
    botToken: String(row.bot_token || ""),
    chatId: String(row.chat_id || ""),
    topicId: String(row.topic_id || ""),
    proxyUrl: String(row.proxy_url || ""),
    createdAt: String(row.created_at),
  };
}

function mapWebsiteNotification(row: DbRow): WebsiteNotification {
  return {
    id: Number(row.id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined ? null : Number(row.workspace_id),
    title: String(row.title),
    body: String(row.body),
    itemId: row.item_id === null ? null : Number(row.item_id),
    categoryId: row.category_id === null ? null : Number(row.category_id),
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
  };
}

function mapInvoice(row: DbRow): Invoice {
  return {
    id: Number(row.id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined ? null : Number(row.workspace_id),
    itemId: row.item_id === null ? null : Number(row.item_id),
    itemName: row.item_name ? String(row.item_name) : undefined,
    categoryId: row.category_id === null ? null : Number(row.category_id),
    categoryName: row.category_name ? String(row.category_name) : undefined,
    vendorName: String(row.vendor_name || ""),
    vendorUrl: String(row.vendor_url || ""),
    accountName: String(row.account_name || ""),
    amount: Number(row.amount || 0),
    currency: String(row.currency || "USD"),
    paymentDate: row.payment_date ? String(row.payment_date) : null,
    dueDate: row.due_date ? String(row.due_date) : null,
    period: row.period ? (row.period as BillingPeriod) : null,
    customPeriodDays: row.custom_period_days === null ? null : Number(row.custom_period_days),
    shiftDates: bool(row.shift_dates),
    shiftPaymentPeriod: bool(row.shift_payment_period),
    createdAt: String(row.created_at),
  };
}

function mapWorkspace(row: DbRow): Workspace {
  return {
    id: Number(row.id),
    name: String(row.name),
    emoji: String(row.emoji || "📦"),
    ownerId: Number(row.owner_id),
    ownerUsername: row.owner_username ? String(row.owner_username) : undefined,
    accessRole: (String(row.access_role || "viewer") as WorkspaceRole),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function bootstrapWorkspaces(db: Database.Database) {
  const users = db.prepare("SELECT id, username FROM users ORDER BY id ASC").all() as DbRow[];
  const insertWorkspace = db.prepare(
    "INSERT INTO workspaces (name, emoji, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const getOwnerWorkspace = db.prepare("SELECT id FROM workspaces WHERE owner_id = ? ORDER BY id ASC LIMIT 1");
  const insertMember = db.prepare(
    "INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
  );
  const setItemWorkspace = db.prepare("UPDATE items SET workspace_id = ? WHERE owner_id = ? AND workspace_id IS NULL");
  const setFolderWorkspace = db.prepare("UPDATE folders SET workspace_id = ? WHERE owner_id = ? AND workspace_id IS NULL");
  const setInvoiceWorkspaceFromItemOwner = db.prepare(
    "UPDATE invoices SET workspace_id = ? WHERE workspace_id IS NULL AND item_id IN (SELECT id FROM items WHERE owner_id = ?)",
  );
  const setNotificationWorkspaceFromItemOwner = db.prepare(
    "UPDATE notifications SET workspace_id = ? WHERE workspace_id IS NULL AND item_id IN (SELECT id FROM items WHERE owner_id = ?)",
  );

  users.forEach((user) => {
    const userId = Number(user.id);
    const username = String(user.username || "User");
    const now = nowIso();
    let workspaceRow = getOwnerWorkspace.get(userId) as DbRow | undefined;
    if (!workspaceRow) {
      const created = insertWorkspace.run(`${username}'s Workspace`, "🏠", userId, now, now);
      workspaceRow = { id: Number(created.lastInsertRowid) };
    }
    const workspaceId = Number(workspaceRow.id);
    insertMember.run(workspaceId, userId, now);
    setItemWorkspace.run(workspaceId, userId);
    setFolderWorkspace.run(workspaceId, userId);
    setInvoiceWorkspaceFromItemOwner.run(workspaceId, userId);
    setNotificationWorkspaceFromItemOwner.run(workspaceId, userId);
  });

  const workspaceIds = (db.prepare("SELECT id FROM workspaces ORDER BY id ASC").all() as DbRow[]).map((row) => Number(row.id));
  const firstWorkspace = workspaceIds[0] || null;

  // Clone legacy global categories for every workspace and re-link existing data.
  const legacyCategories = db.prepare("SELECT * FROM categories WHERE workspace_id IS NULL ORDER BY sort_order ASC, id ASC").all() as DbRow[];
  if (legacyCategories.length) {
    const insertCategory = db.prepare(
      `INSERT INTO categories (workspace_id, name, icon, color, sort_order, fields_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const mapChannelIds = db.prepare("SELECT channel_id FROM category_notification_channels WHERE category_id = ?");
    const insertCategoryChannel = db.prepare("INSERT OR IGNORE INTO category_notification_channels (category_id, channel_id) VALUES (?, ?)");
    const remapItemsCategory = db.prepare("UPDATE items SET category_id = ? WHERE workspace_id = ? AND category_id = ?");
    const remapInvoicesCategory = db.prepare("UPDATE invoices SET category_id = ? WHERE workspace_id = ? AND category_id = ?");
    const remapFolderCategories = db.prepare(
      "UPDATE OR IGNORE folder_categories SET category_id = ? WHERE category_id = ? AND folder_id IN (SELECT id FROM folders WHERE workspace_id = ?)",
    );

    if (firstWorkspace) {
      db.prepare("UPDATE categories SET workspace_id = ? WHERE workspace_id IS NULL").run(firstWorkspace);
    }

    const workspaceIdsToClone = firstWorkspace ? workspaceIds.filter((workspaceId) => workspaceId !== firstWorkspace) : workspaceIds;
    workspaceIdsToClone.forEach((workspaceId) => {
      legacyCategories.forEach((legacyCategory) => {
        const result = insertCategory.run(
          workspaceId,
          String(legacyCategory.name),
          String(legacyCategory.icon || "Sparkles"),
          String(legacyCategory.color || "#8b5cf6"),
          Number(legacyCategory.sort_order || 0),
          String(legacyCategory.fields_json || "[]"),
          String(legacyCategory.created_at || nowIso()),
          String(legacyCategory.updated_at || nowIso()),
        );
        const newCategoryId = Number(result.lastInsertRowid);
        const oldCategoryId = Number(legacyCategory.id);
        remapItemsCategory.run(newCategoryId, workspaceId, oldCategoryId);
        remapInvoicesCategory.run(newCategoryId, workspaceId, oldCategoryId);
        remapFolderCategories.run(newCategoryId, oldCategoryId, workspaceId);
        const channels = (mapChannelIds.all(oldCategoryId) as DbRow[]).map((row) => Number(row.channel_id));
        channels.forEach((channelId) => insertCategoryChannel.run(newCategoryId, channelId));
      });
    });
  }

  if (firstWorkspace) {
    db.prepare("UPDATE notification_channels SET workspace_id = ? WHERE workspace_id IS NULL").run(firstWorkspace);
    db.prepare("UPDATE invoices SET workspace_id = ? WHERE workspace_id IS NULL").run(firstWorkspace);
    db.prepare("UPDATE notifications SET workspace_id = ? WHERE workspace_id IS NULL").run(firstWorkspace);
    db.prepare("UPDATE folders SET workspace_id = ? WHERE workspace_id IS NULL").run(firstWorkspace);
  }

  const websiteCountStmt = db.prepare("SELECT COUNT(*) as count FROM notification_channels WHERE type = 'website' AND workspace_id = ?");
  const insertWebsiteStmt = db.prepare(
    "INSERT INTO notification_channels (workspace_id, type, title, created_at) VALUES (?, 'website', 'Website inbox', ?)",
  );
  workspaceIds.forEach((workspaceId) => {
    const count = Number((websiteCountStmt.get(workspaceId) as DbRow).count || 0);
    if (count === 0) {
      insertWebsiteStmt.run(workspaceId, nowIso());
    }
  });

  const countCategoriesStmt = db.prepare("SELECT COUNT(*) as count FROM categories WHERE workspace_id = ?");
  const insertCategoryStmt = db.prepare(
    "INSERT INTO categories (workspace_id, name, icon, color, sort_order, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  workspaceIds.forEach((workspaceId) => {
    const count = Number((countCategoriesStmt.get(workspaceId) as DbRow).count || 0);
    if (count > 0) return;
    const now = nowIso();
    insertCategoryStmt.run(workspaceId, "Domains", "Globe", "#38bdf8", 1, "[]", now, now);
    insertCategoryStmt.run(workspaceId, "Servers", "Server", "#f43f5e", 2, "[]", now, now);
    insertCategoryStmt.run(workspaceId, "General Services", "Boxes", "#8b5cf6", 3, "[]", now, now);
  });

  // One-time repair for already duplicated categories from previous migrations.
  const mergeCategoryReferences = db.prepare("UPDATE items SET category_id = ? WHERE workspace_id = ? AND category_id = ?");
  const mergeInvoiceReferences = db.prepare("UPDATE invoices SET category_id = ? WHERE workspace_id = ? AND category_id = ?");
  const mergeFolderCategoryReferences = db.prepare(
    "UPDATE OR IGNORE folder_categories SET category_id = ? WHERE category_id = ? AND folder_id IN (SELECT id FROM folders WHERE workspace_id = ?)",
  );
  const copyCategoryChannels = db.prepare(
    "INSERT OR IGNORE INTO category_notification_channels (category_id, channel_id) SELECT ?, channel_id FROM category_notification_channels WHERE category_id = ?",
  );
  const deleteCategoryChannels = db.prepare("DELETE FROM category_notification_channels WHERE category_id = ?");
  const deleteCategory = db.prepare("DELETE FROM categories WHERE id = ?");
  workspaceIds.forEach((workspaceId) => {
    const categories = db
      .prepare("SELECT id, name, icon, color, fields_json FROM categories WHERE workspace_id = ? ORDER BY id ASC")
      .all(workspaceId) as DbRow[];
    const bySignature = new Map<string, number>();
    categories.forEach((category) => {
      const id = Number(category.id);
      const signature = [
        String(category.name || "").toLowerCase(),
        String(category.icon || ""),
        String(category.color || ""),
        String(category.fields_json || "[]"),
      ].join("|");
      const keepId = bySignature.get(signature);
      if (!keepId) {
        bySignature.set(signature, id);
        return;
      }
      mergeCategoryReferences.run(keepId, workspaceId, id);
      mergeInvoiceReferences.run(keepId, workspaceId, id);
      mergeFolderCategoryReferences.run(keepId, id, workspaceId);
      copyCategoryChannels.run(keepId, id);
      deleteCategoryChannels.run(id);
      deleteCategory.run(id);
    });
  });
}

function getDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const globalForDb = globalThis as typeof globalThis & {
    mcTrackerDb?: Database.Database;
    mcTrackerWorkspaceBootstrapped?: boolean;
  };

  if (!globalForDb.mcTrackerDb) {
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.mcTrackerDb = db;
  }

  if (!globalForDb.mcTrackerWorkspaceBootstrapped) {
    bootstrapWorkspaces(globalForDb.mcTrackerDb);
    globalForDb.mcTrackerWorkspaceBootstrapped = true;
  }

  return globalForDb.mcTrackerDb;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin','admin','user')),
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      premium INTEGER NOT NULL DEFAULT 0,
      display_currency TEXT NOT NULL DEFAULT 'USD',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '📦',
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS workspace_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('editor','viewer')),
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Sparkles',
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      sort_order INTEGER NOT NULL DEFAULT 0,
      fields_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      payment_type TEXT NOT NULL CHECK(payment_type IN ('single','recurring')),
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      billing_start_at TEXT,
      billing_end_at TEXT,
      period TEXT,
      custom_period_days INTEGER,
      vendor_name TEXT,
      vendor_url TEXT,
      account_name TEXT,
      notes TEXT,
      custom_fields_json TEXT NOT NULL DEFAULT '{}',
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folder_items (
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      PRIMARY KEY (folder_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS folder_categories (
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (folder_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS folder_members (
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('viewer','editor')),
      PRIMARY KEY (folder_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invite_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('viewer','editor')),
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      base_currency TEXT NOT NULL,
      target_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (base_currency, target_currency)
    );

    CREATE TABLE IF NOT EXISTS notification_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('website','telegram')),
      title TEXT NOT NULL,
      bot_token TEXT,
      chat_id TEXT,
      topic_id TEXT,
      proxy_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_notification_channels (
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
      PRIMARY KEY (category_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
      reminder_days INTEGER NOT NULL,
      target_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(item_id, channel_id, reminder_days, target_date)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      vendor_name TEXT,
      vendor_url TEXT,
      account_name TEXT,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_date TEXT,
      due_date TEXT,
      period TEXT,
      custom_period_days INTEGER,
      shift_dates INTEGER NOT NULL DEFAULT 1,
      shift_payment_period INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  if (!columnExists(db, "users", "premium")) {
    db.prepare("ALTER TABLE users ADD COLUMN premium INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!columnExists(db, "users", "display_currency")) {
    db.prepare("ALTER TABLE users ADD COLUMN display_currency TEXT NOT NULL DEFAULT 'USD'").run();
  }
  if (!columnExists(db, "items", "account_name")) {
    db.prepare("ALTER TABLE items ADD COLUMN account_name TEXT").run();
  }
  if (!columnExists(db, "invoices", "account_name")) {
    db.prepare("ALTER TABLE invoices ADD COLUMN account_name TEXT").run();
  }
  if (!columnExists(db, "categories", "workspace_id")) {
    db.prepare("ALTER TABLE categories ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE").run();
  }
  if (!columnExists(db, "items", "workspace_id")) {
    db.prepare("ALTER TABLE items ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE").run();
  }
  if (!columnExists(db, "folders", "workspace_id")) {
    db.prepare("ALTER TABLE folders ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE").run();
  }
  if (!columnExists(db, "notification_channels", "workspace_id")) {
    db.prepare("ALTER TABLE notification_channels ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE").run();
  }
  if (!columnExists(db, "notification_channels", "proxy_url")) {
    db.prepare("ALTER TABLE notification_channels ADD COLUMN proxy_url TEXT").run();
  }
  if (!columnExists(db, "notifications", "workspace_id")) {
    db.prepare("ALTER TABLE notifications ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE").run();
  }
  if (!columnExists(db, "invoices", "workspace_id")) {
    db.prepare("ALTER TABLE invoices ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE").run();
  }

  const categoryCount = Number((db.prepare("SELECT COUNT(*) as count FROM categories").get() as DbRow).count || 0);
  if (categoryCount === 0) {
    const now = nowIso();
    const insert = db.prepare(
      "INSERT INTO categories (name, icon, color, sort_order, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    insert.run("Domains", "Globe", "#38bdf8", 1, "[]", now, now);
    insert.run("Servers", "Server", "#f43f5e", 2, "[]", now, now);
    insert.run("General Services", "Boxes", "#8b5cf6", 3, "[]", now, now);
  }

  db.prepare(
    `UPDATE categories
     SET fields_json = '[]', updated_at = ?
     WHERE name IN ('Domains', 'Servers', 'General Services')
       AND fields_json IN (?, ?, ?)`,
  ).run(
    nowIso(),
    JSON.stringify([
      { id: "domain_name", label: "Domain", type: "text", required: false, bold: true, color: "#38bdf8", showInTable: true },
      { id: "registrar", label: "Registrar", type: "text", required: false, bold: false, color: "#c4b5fd", showInTable: true },
    ]),
    JSON.stringify([
      { id: "ip", label: "IP", type: "text", required: false, bold: true, color: "#f87171", showInTable: true },
      { id: "location", label: "Location", type: "text", required: false, bold: false, color: "#a78bfa", showInTable: true },
    ]),
    JSON.stringify([{ id: "plan", label: "Plan", type: "text", required: false, bold: false, color: "#60a5fa", showInTable: true }]),
  );

}

export function isSetupComplete() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'").get() as DbRow;
  return Number(count.count || 0) > 0;
}

export async function createInitialSuperadmin(username: string, password: string) {
  if (isSetupComplete()) {
    throw new Error("Setup is already complete.");
  }

  const now = nowIso();
  const hash = await bcrypt.hash(password, 12);
  const db = getDb();
  const result = db
    .prepare("INSERT INTO users (username, password_hash, role, display_currency, created_at) VALUES (?, ?, 'superadmin', 'USD', ?)")
    .run(username.trim(), hash, now);
  const userId = Number(result.lastInsertRowid);
  const workspaceId = Number(
    db
      .prepare("INSERT INTO workspaces (name, emoji, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(`${username.trim()}'s Workspace`, "🏠", userId, now, now).lastInsertRowid,
  );
  db.prepare("INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run(
    workspaceId,
    userId,
    now,
  );
  db.prepare("INSERT INTO notification_channels (workspace_id, type, title, created_at) VALUES (?, 'website', 'Website inbox', ?)").run(
    workspaceId,
    now,
  );
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('setupComplete', 'true')").run();
  return userId;
}

export function getUserById(id: number) {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as DbRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserAuthByUsername(username: string) {
  return getDb()
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?)")
    .get(username.trim()) as (DbRow & { password_hash: string; totp_secret?: string }) | undefined;
}

export function listUsers() {
  return (getDb().prepare("SELECT * FROM users ORDER BY role, username").all() as DbRow[]).map(mapUser);
}

export async function createUser(username: string, password: string, role: UserRole) {
  const hash = await bcrypt.hash(password, 12);
  const db = getDb();
  const now = nowIso();
  const result = db
    .prepare("INSERT INTO users (username, password_hash, role, display_currency, created_at) VALUES (?, ?, ?, 'USD', ?)")
    .run(username.trim(), hash, role, now);
  const userId = Number(result.lastInsertRowid);
  const workspaceId = Number(
    db
      .prepare("INSERT INTO workspaces (name, emoji, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(`${username.trim()}'s Workspace`, "🏠", userId, now, now).lastInsertRowid,
  );
  db.prepare("INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run(
    workspaceId,
    userId,
    now,
  );
  db.prepare("INSERT INTO notification_channels (workspace_id, type, title, created_at) VALUES (?, 'website', 'Website inbox', ?)").run(
    workspaceId,
    now,
  );
}

export async function updateUserPassword(id: number, password: string) {
  const hash = await bcrypt.hash(password, 12);
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
}

export function updateUserRole(id: number, role: UserRole) {
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function updateUserPremium(id: number, premium: boolean) {
  getDb().prepare("UPDATE users SET premium = ? WHERE id = ?").run(premium ? 1 : 0, id);
}

export function updateUserDisplayCurrency(id: number, displayCurrency: string) {
  getDb().prepare("UPDATE users SET display_currency = ? WHERE id = ?").run(displayCurrency.trim().toUpperCase() || "USD", id);
}

export function setUserTotpSecret(id: number, secret: string, enabled: boolean) {
  getDb().prepare("UPDATE users SET totp_secret = ?, totp_enabled = ? WHERE id = ?").run(secret, enabled ? 1 : 0, id);
}

export function resetUserTotp(id: number) {
  getDb().prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(id);
}

export function listWorkspacesForUser(userId: number) {
  return (
    getDb()
      .prepare(
        `SELECT workspaces.*, users.username as owner_username, workspace_members.role as access_role
         FROM workspace_members
         JOIN workspaces ON workspaces.id = workspace_members.workspace_id
         JOIN users ON users.id = workspaces.owner_id
         WHERE workspace_members.user_id = ?
         ORDER BY workspaces.updated_at DESC, workspaces.id DESC`,
      )
      .all(userId) as DbRow[]
  ).map(mapWorkspace);
}

export function getWorkspaceByIdForUser(workspaceId: number, userId: number) {
  const row = getDb()
    .prepare(
      `SELECT workspaces.*, users.username as owner_username, workspace_members.role as access_role
       FROM workspace_members
       JOIN workspaces ON workspaces.id = workspace_members.workspace_id
       JOIN users ON users.id = workspaces.owner_id
       WHERE workspace_members.workspace_id = ? AND workspace_members.user_id = ?
       LIMIT 1`,
    )
    .get(workspaceId, userId) as DbRow | undefined;
  return row ? mapWorkspace(row) : null;
}

export function resolveWorkspaceForUser(userId: number, requestedWorkspaceId?: number | null) {
  if (requestedWorkspaceId) {
    const requested = getWorkspaceByIdForUser(requestedWorkspaceId, userId);
    if (requested) return requested;
  }
  const first = listWorkspacesForUser(userId)[0];
  if (!first) {
    throw new Error("No accessible workspace found.");
  }
  return first;
}

export function getWorkspaceRole(workspaceId: number, userId: number) {
  const row = getDb()
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .get(workspaceId, userId) as { role?: WorkspaceRole } | undefined;
  return row?.role || null;
}

export function requireWorkspaceViewer(workspaceId: number, userId: number) {
  const role = getWorkspaceRole(workspaceId, userId);
  if (!role) throw new Error("Workspace access denied.");
  return role;
}

export function requireWorkspaceEditor(workspaceId: number, userId: number) {
  const role = requireWorkspaceViewer(workspaceId, userId);
  if (role !== "owner" && role !== "editor") {
    throw new Error("You do not have edit permissions in this workspace.");
  }
  return role;
}

export function requireWorkspaceOwner(workspaceId: number, userId: number) {
  const role = requireWorkspaceViewer(workspaceId, userId);
  if (role !== "owner") {
    throw new Error("Only workspace owner can manage this setting.");
  }
  return role;
}

export function createWorkspaceForUser(userId: number, name: string, emoji = "📦") {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspace name is required.");
  const now = nowIso();
  const db = getDb();
  const result = db
    .prepare("INSERT INTO workspaces (name, emoji, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(trimmed, emoji || "📦", userId, now, now);
  const workspaceId = Number(result.lastInsertRowid);
  db.prepare("INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)")
    .run(workspaceId, userId, now);
  db.prepare("INSERT INTO notification_channels (workspace_id, type, title, created_at) VALUES (?, 'website', 'Website inbox', ?)")
    .run(workspaceId, now);
  return workspaceId;
}

export function updateWorkspaceForUser(workspaceId: number, userId: number, patch: { name?: string; emoji?: string }) {
  requireWorkspaceOwner(workspaceId, userId);
  const current = getDb().prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId) as DbRow | undefined;
  if (!current) throw new Error("Workspace not found.");
  const nextName = patch.name?.trim() || String(current.name);
  const nextEmoji = patch.emoji?.trim() || String(current.emoji || "📦");
  getDb()
    .prepare("UPDATE workspaces SET name = ?, emoji = ?, updated_at = ? WHERE id = ?")
    .run(nextName, nextEmoji, nowIso(), workspaceId);
}

export function deleteWorkspaceForUser(workspaceId: number, userId: number) {
  requireWorkspaceOwner(workspaceId, userId);
  const accessibleCount = listWorkspacesForUser(userId).length;
  if (accessibleCount <= 1) {
    throw new Error("At least one workspace must remain.");
  }
  getDb().prepare("DELETE FROM workspaces WHERE id = ?").run(workspaceId);
}

export function listWorkspaceMembers(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return (
    getDb()
      .prepare(
        `SELECT workspace_members.user_id, workspace_members.role, users.username, users.role as user_role
         FROM workspace_members
         JOIN users ON users.id = workspace_members.user_id
         WHERE workspace_members.workspace_id = ?
         ORDER BY CASE workspace_members.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, users.username`,
      )
      .all(workspaceId) as DbRow[]
  ).map((row) => ({
    userId: Number(row.user_id),
    username: String(row.username),
    role: String(row.role) as WorkspaceRole,
    userRole: String(row.user_role) as UserRole,
  }));
}

export function updateWorkspaceMemberRole(workspaceId: number, targetUserId: number, role: Exclude<WorkspaceRole, "owner">, actorId: number) {
  requireWorkspaceOwner(workspaceId, actorId);
  if (targetUserId === actorId) throw new Error("Owner role cannot be changed.");
  getDb()
    .prepare("UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?")
    .run(role, workspaceId, targetUserId);
}

export function removeWorkspaceMember(workspaceId: number, targetUserId: number, actorId: number) {
  requireWorkspaceOwner(workspaceId, actorId);
  if (targetUserId === actorId) throw new Error("Owner cannot remove themselves.");
  getDb()
    .prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .run(workspaceId, targetUserId);
}

export function addWorkspaceMemberByUsername(workspaceId: number, username: string, role: Exclude<WorkspaceRole, "owner">, actorId: number) {
  requireWorkspaceOwner(workspaceId, actorId);
  const user = getUserAuthByUsername(username);
  if (!user) throw new Error("User not found.");
  getDb()
    .prepare("INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
    .run(workspaceId, Number(user.id), role, nowIso());
}

export function listWorkspaceInvites(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return getDb()
    .prepare("SELECT token, role, created_at FROM workspace_invites WHERE workspace_id = ? AND revoked_at IS NULL ORDER BY created_at DESC")
    .all(workspaceId) as Array<{ token: string; role: Exclude<WorkspaceRole, "owner">; created_at: string }>;
}

export function createWorkspaceInvite(workspaceId: number, role: Exclude<WorkspaceRole, "owner">, actorId: number) {
  requireWorkspaceOwner(workspaceId, actorId);
  const token = crypto.randomUUID().replaceAll("-", "");
  getDb()
    .prepare("INSERT INTO workspace_invites (workspace_id, token, role, created_at) VALUES (?, ?, ?, ?)")
    .run(workspaceId, token, role, nowIso());
  return token;
}

export function revokeWorkspaceInvite(workspaceId: number, token: string, actorId: number) {
  requireWorkspaceOwner(workspaceId, actorId);
  getDb()
    .prepare("UPDATE workspace_invites SET revoked_at = ? WHERE workspace_id = ? AND token = ? AND revoked_at IS NULL")
    .run(nowIso(), workspaceId, token);
}

export function getWorkspaceInvite(token: string) {
  return getDb()
    .prepare(
      `SELECT workspace_invites.*, workspaces.name as workspace_name, workspaces.emoji as workspace_emoji
       FROM workspace_invites
       JOIN workspaces ON workspaces.id = workspace_invites.workspace_id
       WHERE workspace_invites.token = ? AND workspace_invites.revoked_at IS NULL`,
    )
    .get(token) as ({ workspace_id: number; workspace_name: string; workspace_emoji: string; role: Exclude<WorkspaceRole, "owner"> } & DbRow) | undefined;
}

export function acceptWorkspaceInvite(token: string, userId: number) {
  const invite = getWorkspaceInvite(token);
  if (!invite) throw new Error("Invite is invalid or revoked.");
  getDb()
    .prepare("INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
    .run(Number(invite.workspace_id), userId, invite.role, nowIso());
}

export function listCategories() {
  return (getDb().prepare("SELECT * FROM categories ORDER BY sort_order ASC, name ASC").all() as DbRow[]).map(mapCategory);
}

export function listCategoriesForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return (
    getDb()
      .prepare("SELECT * FROM categories WHERE workspace_id = ? ORDER BY sort_order ASC, name ASC")
      .all(workspaceId) as DbRow[]
  ).map(mapCategory);
}

export function getCategory(id: number) {
  const row = getDb().prepare("SELECT * FROM categories WHERE id = ?").get(id) as DbRow | undefined;
  return row ? mapCategory(row) : null;
}

export function getCategoryForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  const row = getDb()
    .prepare("SELECT * FROM categories WHERE id = ? AND workspace_id = ?")
    .get(id, workspaceId) as DbRow | undefined;
  return row ? mapCategory(row) : null;
}

export function upsertCategoryForWorkspace(formData: FormData, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const id = Number(formData.get("id") || 0);
  const current = id ? getCategoryForWorkspace(id, workspaceId, userId) : null;
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Category name is required.");

  const fields = buildFieldsFromForm(formData, current?.fields || []);
  const icon = String(formData.get("icon") || "Sparkles").trim();
  const color = String(formData.get("color") || "#8b5cf6");
  const now = nowIso();
  const db = getDb();

  if (id) {
    db.prepare("UPDATE categories SET name = ?, icon = ?, color = ?, fields_json = ?, updated_at = ? WHERE id = ? AND workspace_id = ?").run(
      name,
      icon,
      color,
      JSON.stringify(fields),
      now,
      id,
      workspaceId,
    );
    saveCategoryNotificationChannels(id, workspaceId, formData.getAll("notificationChannelIds").map(Number));
    return id;
  }

  const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as sort FROM categories WHERE workspace_id = ?").get(workspaceId) as DbRow;
  const result = db
    .prepare(
      "INSERT INTO categories (workspace_id, name, icon, color, sort_order, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(workspaceId, name, icon, color, Number(maxSort.sort || 0) + 1, JSON.stringify(fields), now, now);
  const categoryId = Number(result.lastInsertRowid);
  saveCategoryNotificationChannels(categoryId, workspaceId, formData.getAll("notificationChannelIds").map(Number));
  return categoryId;
}

function saveCategoryNotificationChannels(categoryId: number, workspaceId: number, channelIds: number[]) {
  const db = getDb();
  db.prepare("DELETE FROM category_notification_channels WHERE category_id = ?").run(categoryId);
  const validChannelIds = new Set(
    (db.prepare("SELECT id FROM notification_channels WHERE workspace_id = ?").all(workspaceId) as DbRow[]).map((row) => Number(row.id)),
  );
  const insert = db.prepare("INSERT OR IGNORE INTO category_notification_channels (category_id, channel_id) VALUES (?, ?)");
  channelIds.filter((channelId) => validChannelIds.has(channelId)).forEach((channelId) => insert.run(categoryId, channelId));
}

export function listCategoryNotificationChannelIds(categoryId: number) {
  return new Set(
    (getDb().prepare("SELECT channel_id FROM category_notification_channels WHERE category_id = ?").all(categoryId) as DbRow[]).map((row) =>
      Number(row.channel_id),
    ),
  );
}

export function listCategoryNotificationChannelIdsForWorkspace(categoryId: number, workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return new Set(
    (getDb()
      .prepare(
        `SELECT category_notification_channels.channel_id
         FROM category_notification_channels
         JOIN notification_channels ON notification_channels.id = category_notification_channels.channel_id
         WHERE category_notification_channels.category_id = ? AND notification_channels.workspace_id = ?`,
      )
      .all(categoryId, workspaceId) as DbRow[]).map((row) => Number(row.channel_id)),
  );
}

function buildFieldsFromForm(formData: FormData, existing: CategoryField[]) {
  const labels = formData.getAll("field_label").map((value) => String(value).trim());
  const ids = formData.getAll("field_id").map((value) => String(value).trim());
  const types = formData.getAll("field_type").map((value) => String(value));
  const colors = formData.getAll("field_color").map((value) => String(value || ""));
  const options = formData.getAll("field_options").map((value) => String(value || ""));
  const required = new Set(formData.getAll("field_required").map(String));
  const bold = new Set(formData.getAll("field_bold").map(String));
  const visible = new Set(formData.getAll("field_show").map(String));
  const copyable = new Set(formData.getAll("field_copyable").map(String));

  return labels
    .map((label, index) => {
      const fallback = existing[index];
      const id = ids[index] || fallback?.id || slugify(label);
      if (!label || !id) return null;
      return {
        id,
        label,
        type: (types[index] || "text") as CategoryField["type"],
        required: required.has(String(index)),
        bold: bold.has(String(index)),
        color: colors[index] || "",
        showInTable: visible.has(String(index)),
        copyable: copyable.has(String(index)),
        options: options[index]
          ? options[index]
              .split(",")
              .map((option) => option.trim())
              .filter(Boolean)
          : undefined,
      } satisfies CategoryField;
    })
    .filter(Boolean) as CategoryField[];
}

export function reorderCategories(ids: number[]) {
  const db = getDb();
  const update = db.prepare("UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?");
  const now = nowIso();
  ids.forEach((id, index) => update.run(index + 1, now, id));
}

export function reorderCategoriesForWorkspace(ids: number[], workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const db = getDb();
  const update = db.prepare("UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ? AND workspace_id = ?");
  const now = nowIso();
  ids.forEach((id, index) => update.run(index + 1, now, id, workspaceId));
}

export function listItems() {
  return (
    getDb()
      .prepare(
        `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
         FROM items
         LEFT JOIN categories ON categories.id = items.category_id
         ORDER BY items.created_at DESC, items.id DESC`,
      )
      .all() as DbRow[]
  ).map(mapItem);
}

export function listItemsForUser(userId: number) {
  return (
    getDb()
      .prepare(
        `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
         FROM items
         LEFT JOIN categories ON categories.id = items.category_id
         WHERE items.owner_id = ?
         ORDER BY items.created_at DESC, items.id DESC`,
      )
      .all(userId) as DbRow[]
  ).map(mapItem);
}

export function listItemsForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return (
    getDb()
      .prepare(
        `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
         FROM items
         LEFT JOIN categories ON categories.id = items.category_id
         WHERE items.workspace_id = ?
         ORDER BY items.created_at DESC, items.id DESC`,
      )
      .all(workspaceId) as DbRow[]
  ).map(mapItem);
}

export function listVendorSuggestions(): VendorSuggestion[] {
  const seen = new Set<string>();
  return (getDb()
    .prepare(
      `SELECT vendor_name, vendor_url, account_name
       FROM items
       WHERE COALESCE(vendor_name, '') <> '' OR COALESCE(vendor_url, '') <> '' OR COALESCE(account_name, '') <> ''
       ORDER BY updated_at DESC`,
    )
    .all() as DbRow[])
    .map((row) => ({
      vendorName: String(row.vendor_name || ""),
      vendorUrl: String(row.vendor_url || ""),
      accountName: String(row.account_name || ""),
    }))
    .filter((vendor) => {
      const key = `${vendor.vendorName}|${vendor.vendorUrl}|${vendor.accountName}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function listVendorSuggestionsForUser(userId: number): VendorSuggestion[] {
  const seen = new Set<string>();
  return (getDb()
    .prepare(
      `SELECT vendor_name, vendor_url, account_name
       FROM items
       WHERE owner_id = ? AND (COALESCE(vendor_name, '') <> '' OR COALESCE(vendor_url, '') <> '' OR COALESCE(account_name, '') <> '')
       ORDER BY updated_at DESC`,
    )
    .all(userId) as DbRow[])
    .map((row) => ({
      vendorName: String(row.vendor_name || ""),
      vendorUrl: String(row.vendor_url || ""),
      accountName: String(row.account_name || ""),
    }))
    .filter((vendor) => {
      const key = `${vendor.vendorName}|${vendor.vendorUrl}|${vendor.accountName}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function listVendorSuggestionsForWorkspace(workspaceId: number, userId: number): VendorSuggestion[] {
  requireWorkspaceViewer(workspaceId, userId);
  const seen = new Set<string>();
  return (getDb()
    .prepare(
      `SELECT vendor_name, vendor_url, account_name
       FROM items
       WHERE workspace_id = ? AND (COALESCE(vendor_name, '') <> '' OR COALESCE(vendor_url, '') <> '' OR COALESCE(account_name, '') <> '')
       ORDER BY updated_at DESC`,
    )
    .all(workspaceId) as DbRow[])
    .map((row) => ({
      vendorName: String(row.vendor_name || ""),
      vendorUrl: String(row.vendor_url || ""),
      accountName: String(row.account_name || ""),
    }))
    .filter((vendor) => {
      const key = `${vendor.vendorName}|${vendor.vendorUrl}|${vendor.accountName}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getItem(id: number) {
  const row = getDb()
    .prepare(
      `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
       FROM items
       LEFT JOIN categories ON categories.id = items.category_id
       WHERE items.id = ?`,
    )
    .get(id) as DbRow | undefined;
  return row ? mapItem(row) : null;
}

export function getItemForUser(id: number, userId: number) {
  const row = getDb()
    .prepare(
      `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
       FROM items
       LEFT JOIN categories ON categories.id = items.category_id
       WHERE items.id = ? AND items.owner_id = ?`,
    )
    .get(id, userId) as DbRow | undefined;
  return row ? mapItem(row) : null;
}

export function getItemForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  const row = getDb()
    .prepare(
      `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
       FROM items
       LEFT JOIN categories ON categories.id = items.category_id
       WHERE items.id = ? AND items.workspace_id = ?`,
    )
    .get(id, workspaceId) as DbRow | undefined;
  return row ? mapItem(row) : null;
}

export function upsertItemForWorkspace(formData: FormData, ownerId: number, workspaceId: number) {
  requireWorkspaceEditor(workspaceId, ownerId);
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required.");

  const categoryId = Number(formData.get("categoryId") || 0) || null;
  const category = categoryId ? getCategoryForWorkspace(categoryId, workspaceId, ownerId) : null;
  const paymentType = String(formData.get("paymentType") || "single") as PaymentType;
  const amount = Number(formData.get("amount") || 0);
  const currency = ensureSupportedCurrency(String(formData.get("currency") || "USD"));
  const period = paymentType === "recurring" ? (String(formData.get("period") || "1m") as BillingPeriod) : null;
  const customPeriodDays = period === "custom" ? Number(formData.get("customPeriodDays") || 30) : null;
  const customFields: Record<string, unknown> = {};

  category?.fields.forEach((field) => {
    const raw = formData.get(`custom_${field.id}`);
    customFields[field.id] = field.type === "checkbox" ? formData.get(`custom_${field.id}`) === "on" : String(raw || "");
  });

  const billingStartAt = normalizeDate(formData.get("billingStartAt"));
  const explicitEndAt = normalizeDate(formData.get("billingEndAt"));
  const billingEndAt =
    explicitEndAt ||
    (paymentType === "recurring" && billingStartAt ? addBillingPeriod(new Date(billingStartAt), period, customPeriodDays).toISOString() : null);

  const payload = {
    name,
    categoryId,
    paymentType,
    amount,
    currency,
    billingStartAt,
    billingEndAt,
    period,
    customPeriodDays,
    vendorName: String(formData.get("vendorName") || "").trim(),
    vendorUrl: String(formData.get("vendorUrl") || "").trim(),
    accountName: String(formData.get("accountName") || "").trim(),
    notes: String(formData.get("notes") || ""),
    customFieldsJson: JSON.stringify(customFields),
  };

  const now = nowIso();
  const db = getDb();
  if (id) {
    const previous = getItemForWorkspace(id, workspaceId, ownerId);
    if (!previous) {
      throw new Error("Entry not found in this workspace.");
    }
    db.prepare(
      `UPDATE items
       SET name = ?, category_id = ?, payment_type = ?, amount = ?, currency = ?, billing_start_at = ?,
           billing_end_at = ?, period = ?, custom_period_days = ?, vendor_name = ?, vendor_url = ?, account_name = ?,
           notes = ?, custom_fields_json = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
    ).run(
      payload.name,
      payload.categoryId,
      payload.paymentType,
      payload.amount,
      payload.currency,
      payload.billingStartAt,
      payload.billingEndAt,
      payload.period,
      payload.customPeriodDays,
      payload.vendorName,
      payload.vendorUrl,
      payload.accountName,
      payload.notes,
      payload.customFieldsJson,
      now,
      id,
      workspaceId,
    );
    if (previous && previous.amount !== payload.amount) {
      db.prepare("INSERT INTO price_events (item_id, amount, created_at) VALUES (?, ?, ?)").run(id, payload.amount, now);
    }
    return id;
  }

  const result = db
    .prepare(
      `INSERT INTO items
       (workspace_id, name, category_id, payment_type, amount, currency, billing_start_at, billing_end_at, period,
        custom_period_days, vendor_name, vendor_url, account_name, notes, custom_fields_json, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      workspaceId,
      payload.name,
      payload.categoryId,
      payload.paymentType,
      payload.amount,
      payload.currency,
      payload.billingStartAt,
      payload.billingEndAt,
      payload.period,
      payload.customPeriodDays,
      payload.vendorName,
      payload.vendorUrl,
      payload.accountName,
      payload.notes,
      payload.customFieldsJson,
      ownerId,
      now,
      now,
    );
  const itemId = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO price_events (item_id, amount, created_at) VALUES (?, ?, ?)").run(itemId, payload.amount, now);
  return itemId;
}

export function upsertItem(formData: FormData, ownerId: number) {
  const workspaceId = Number(formData.get("workspaceId") || 0);
  if (!workspaceId) throw new Error("Workspace is required.");
  return upsertItemForWorkspace(formData, ownerId, workspaceId);
}

export function deleteItem(id: number) {
  getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
}

export function deleteItemForUser(id: number, userId: number) {
  getDb().prepare("DELETE FROM items WHERE id = ? AND owner_id = ?").run(id, userId);
}

export function deleteItemForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  getDb().prepare("DELETE FROM items WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
}

export function deleteItemsForUser(ids: number[], userId: number) {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) return;

  const db = getDb();
  const deleteItem = db.prepare("DELETE FROM items WHERE id = ? AND owner_id = ?");
  const deleteMany = db.transaction((itemIds: number[]) => {
    itemIds.forEach((id) => deleteItem.run(id, userId));
  });
  deleteMany(uniqueIds);
}

export function deleteItemsForWorkspace(ids: number[], workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) return;
  const db = getDb();
  const deleteItem = db.prepare("DELETE FROM items WHERE id = ? AND workspace_id = ?");
  const deleteMany = db.transaction((itemIds: number[]) => {
    itemIds.forEach((id) => deleteItem.run(id, workspaceId));
  });
  deleteMany(uniqueIds);
}

export function transferWorkspaceEntriesForUser(
  sourceWorkspaceId: number,
  targetWorkspaceId: number,
  entryIds: number[],
  mode: "copy" | "move",
  userId: number,
) {
  if (sourceWorkspaceId === targetWorkspaceId) {
    throw new Error("Source and target workspaces must be different.");
  }
  requireWorkspaceViewer(sourceWorkspaceId, userId);
  requireWorkspaceEditor(targetWorkspaceId, userId);

  const ids = [...new Set(entryIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) throw new Error("Select at least one entry.");

  const db = getDb();
  const inClause = ids.map(() => "?").join(",");
  const sourceItems = db
    .prepare(
      `SELECT *
       FROM items
       WHERE workspace_id = ? AND id IN (${inClause})`,
    )
    .all(sourceWorkspaceId, ...ids) as DbRow[];
  if (!sourceItems.length) throw new Error("No selected entries found in source workspace.");

  const categoryCache = new Map<number, number>();
  const selectSourceCategory = db.prepare(
    "SELECT name, icon, color, fields_json, created_at, updated_at FROM categories WHERE id = ? AND workspace_id = ?",
  );
  const selectTargetCategoryByName = db.prepare(
    "SELECT id FROM categories WHERE workspace_id = ? AND lower(name) = lower(?) ORDER BY id ASC LIMIT 1",
  );
  const selectMaxTargetSort = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as sort FROM categories WHERE workspace_id = ?");
  const insertTargetCategory = db.prepare(
    "INSERT INTO categories (workspace_id, name, icon, color, sort_order, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertCopiedItem = db.prepare(
    `INSERT INTO items
     (workspace_id, name, category_id, payment_type, amount, currency, billing_start_at, billing_end_at, period, custom_period_days, vendor_name, vendor_url, account_name, notes, custom_fields_json, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPriceEvent = db.prepare("INSERT INTO price_events (item_id, amount, created_at) VALUES (?, ?, ?)");
  const moveItem = db.prepare(
    "UPDATE items SET workspace_id = ?, category_id = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
  );
  const moveItemInvoices = db.prepare("UPDATE invoices SET workspace_id = ?, category_id = ? WHERE item_id = ?");
  const moveItemNotifications = db.prepare("UPDATE notifications SET workspace_id = ?, category_id = ? WHERE item_id = ?");
  const clearFolderLinks = db.prepare("DELETE FROM folder_items WHERE item_id = ?");

  function ensureTargetCategoryId(sourceCategoryId: number | null) {
    if (!sourceCategoryId) return null;
    if (categoryCache.has(sourceCategoryId)) return categoryCache.get(sourceCategoryId) || null;
    const sourceCategory = selectSourceCategory.get(sourceCategoryId, sourceWorkspaceId) as DbRow | undefined;
    if (!sourceCategory) return null;
    const existing = selectTargetCategoryByName.get(targetWorkspaceId, String(sourceCategory.name || "")) as DbRow | undefined;
    if (existing) {
      const existingId = Number(existing.id);
      categoryCache.set(sourceCategoryId, existingId);
      return existingId;
    }
    const sort = Number((selectMaxTargetSort.get(targetWorkspaceId) as DbRow).sort || 0) + 1;
    const now = nowIso();
    const created = insertTargetCategory.run(
      targetWorkspaceId,
      String(sourceCategory.name || "Category"),
      String(sourceCategory.icon || "Sparkles"),
      String(sourceCategory.color || "#8b5cf6"),
      sort,
      String(sourceCategory.fields_json || "[]"),
      String(sourceCategory.created_at || now),
      String(sourceCategory.updated_at || now),
    );
    const createdId = Number(created.lastInsertRowid);
    categoryCache.set(sourceCategoryId, createdId);
    return createdId;
  }

  const tx = db.transaction(() => {
    sourceItems.forEach((row) => {
      const sourceItem = mapItem(row);
      const targetCategoryId = ensureTargetCategoryId(sourceItem.categoryId);
      const now = nowIso();
      if (mode === "copy") {
        const result = insertCopiedItem.run(
          targetWorkspaceId,
          sourceItem.name,
          targetCategoryId,
          sourceItem.paymentType,
          sourceItem.amount,
          sourceItem.currency,
          sourceItem.billingStartAt,
          sourceItem.billingEndAt,
          sourceItem.period,
          sourceItem.customPeriodDays,
          sourceItem.vendorName,
          sourceItem.vendorUrl,
          sourceItem.accountName,
          sourceItem.notes,
          JSON.stringify(sourceItem.customFields || {}),
          userId,
          now,
          now,
        );
        insertPriceEvent.run(Number(result.lastInsertRowid), sourceItem.amount, now);
        return;
      }

      moveItem.run(targetWorkspaceId, targetCategoryId, now, sourceItem.id, sourceWorkspaceId);
      moveItemInvoices.run(targetWorkspaceId, targetCategoryId, sourceItem.id);
      moveItemNotifications.run(targetWorkspaceId, targetCategoryId, sourceItem.id);
      clearFolderLinks.run(sourceItem.id);
    });
  });

  tx();
  return { processed: sourceItems.length };
}

function getWorkspaceIdentity(workspaceId: number) {
  const row = getDb().prepare("SELECT name, emoji FROM workspaces WHERE id = ?").get(workspaceId) as DbRow | undefined;
  if (!row) throw new Error("Workspace not found.");
  return {
    name: String(row.name || "Workspace"),
    emoji: String(row.emoji || "📦"),
  };
}

export type WorkspaceImportResult = {
  insertedCategories: number;
  skippedCategories: number;
  insertedEntries: number;
  skippedEntries: number;
  insertedFolders: number;
  skippedFolders: number;
  insertedInvoices: number;
  skippedInvoices: number;
  insertedWebsiteNotifications: number;
  skippedWebsiteNotifications: number;
  warnings: string[];
};

export function exportSelectedEntriesForWorkspace(workspaceId: number, entryIds: number[], userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  const ids = [...new Set(entryIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) throw new Error("Select at least one entry.");
  const db = getDb();
  const inClause = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
       FROM items
       LEFT JOIN categories ON categories.id = items.category_id
       WHERE items.workspace_id = ? AND items.id IN (${inClause})`,
    )
    .all(workspaceId, ...ids) as DbRow[];
  const entries = rows.map(mapItem);
  if (!entries.length) throw new Error("No selected entries found.");

  const categoriesById = new Map(listCategoriesForWorkspace(workspaceId, userId).map((category) => [category.id, category]));
  const selectedCategories = entries
    .map((entry) => (entry.categoryId ? categoriesById.get(entry.categoryId) : null))
    .filter((category): category is Category => Boolean(category))
    .map((category) => portableCategorySchema.parse({
      name: category.name,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder,
      fields: category.fields,
    }));
  const uniqueCategories = [...new Map(selectedCategories.map((category) => [categoryKey(category.name), category])).values()];
  const workspace = getWorkspaceIdentity(workspaceId);

  return selectedEntriesExportPayloadSchema.parse({
    app: "mc-tracker",
    schemaVersion: 1,
    exportedAt: nowIso(),
    source: {
      workspaceName: workspace.name,
      workspaceEmoji: workspace.emoji,
    },
    sections: ["categories", "entries"],
    categories: uniqueCategories,
    entries: entries.map((entry) => portableEntrySchema.parse({
      name: entry.name,
      categoryName: entry.categoryName || "",
      paymentType: entry.paymentType,
      amount: entry.amount,
      currency: entry.currency,
      billingStartAt: entry.billingStartAt,
      billingEndAt: entry.billingEndAt,
      period: entry.period,
      customPeriodDays: entry.customPeriodDays,
      vendorName: entry.vendorName,
      vendorUrl: entry.vendorUrl,
      accountName: entry.accountName,
      notes: entry.notes,
      customFields: entry.customFields,
    })),
  });
}

export function exportWorkspaceForUser(workspaceId: number, options: ExportWorkspaceOptions, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  const include = exportWorkspaceOptionsSchema.parse(options);
  const workspace = getWorkspaceIdentity(workspaceId);
  const sections: Array<"workspace" | "categories" | "entries" | "folders" | "invoices" | "websiteNotifications"> = [];
  const payload = {
    app: "mc-tracker" as const,
    schemaVersion: 1 as const,
    exportedAt: nowIso(),
    source: {
      workspaceName: workspace.name,
      workspaceEmoji: workspace.emoji,
    },
    sections,
    workspace: include.includeWorkspace ? { name: workspace.name, emoji: workspace.emoji } : undefined,
    categories: [] as ReturnType<typeof portableCategorySchema.parse>[],
    entries: [] as ReturnType<typeof portableEntrySchema.parse>[],
    folders: [] as ReturnType<typeof portableFolderSchema.parse>[],
    invoices: [] as ReturnType<typeof portableInvoiceSchema.parse>[],
    websiteNotifications: [] as ReturnType<typeof portableWebsiteNotificationSchema.parse>[],
  };
  if (include.includeWorkspace) sections.push("workspace");

  const categories = include.includeCategories || include.includeFolders ? listCategoriesForWorkspace(workspaceId, userId) : [];
  const items = include.includeEntries || include.includeFolders || include.includeInvoices || include.includeWebsiteNotifications
    ? listItemsForWorkspace(workspaceId, userId)
    : [];
  const itemNameById = new Map(items.map((item) => [item.id, item.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  if (include.includeCategories) {
    sections.push("categories");
    payload.categories = categories.map((category) => portableCategorySchema.parse({
      name: category.name,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder,
      fields: category.fields,
    }));
  }

  if (include.includeEntries) {
    sections.push("entries");
    payload.entries = items.map((entry) => portableEntrySchema.parse({
      name: entry.name,
      categoryName: entry.categoryName || "",
      paymentType: entry.paymentType,
      amount: entry.amount,
      currency: entry.currency,
      billingStartAt: entry.billingStartAt,
      billingEndAt: entry.billingEndAt,
      period: entry.period,
      customPeriodDays: entry.customPeriodDays,
      vendorName: entry.vendorName,
      vendorUrl: entry.vendorUrl,
      accountName: entry.accountName,
      notes: entry.notes,
      customFields: entry.customFields,
    }));
  }

  if (include.includeFolders) {
    sections.push("folders");
    const db = getDb();
    const folders = db
      .prepare("SELECT id, name FROM folders WHERE workspace_id = ? ORDER BY created_at DESC")
      .all(workspaceId) as DbRow[];
    payload.folders = folders.map((folder) => {
      const folderId = Number(folder.id);
      const entryNames = (db
        .prepare(
          `SELECT folder_items.item_id
           FROM folder_items
           JOIN items ON items.id = folder_items.item_id
           WHERE folder_items.folder_id = ? AND items.workspace_id = ?`,
        )
        .all(folderId, workspaceId) as DbRow[])
        .map((row) => itemNameById.get(Number(row.item_id)) || "")
        .filter(Boolean);
      const categoryNames = (db
        .prepare(
          `SELECT folder_categories.category_id
           FROM folder_categories
           JOIN categories ON categories.id = folder_categories.category_id
           WHERE folder_categories.folder_id = ? AND categories.workspace_id = ?`,
        )
        .all(folderId, workspaceId) as DbRow[])
        .map((row) => categoryNameById.get(Number(row.category_id)) || "")
        .filter(Boolean);
      return portableFolderSchema.parse({
        name: String(folder.name || ""),
        entryNames: [...new Set(entryNames)],
        categoryNames: [...new Set(categoryNames)],
      });
    });
  }

  if (include.includeInvoices) {
    sections.push("invoices");
    payload.invoices = listInvoicesForWorkspace(workspaceId, userId).map((invoice) => portableInvoiceSchema.parse({
      itemName: invoice.itemName || "",
      categoryName: invoice.categoryName || "",
      vendorName: invoice.vendorName,
      vendorUrl: invoice.vendorUrl,
      accountName: invoice.accountName,
      amount: invoice.amount,
      currency: invoice.currency,
      paymentDate: invoice.paymentDate,
      dueDate: invoice.dueDate,
      period: invoice.period,
      customPeriodDays: invoice.customPeriodDays,
      shiftDates: invoice.shiftDates,
      shiftPaymentPeriod: invoice.shiftPaymentPeriod,
    }));
  }

  if (include.includeWebsiteNotifications) {
    sections.push("websiteNotifications");
    payload.websiteNotifications = (getDb()
      .prepare(
        `SELECT notifications.*
         FROM notifications
         WHERE workspace_id = ?
         ORDER BY notifications.created_at DESC`,
      )
      .all(workspaceId) as DbRow[])
      .map(mapWebsiteNotification)
      .map((notification) => portableWebsiteNotificationSchema.parse({
        title: notification.title,
        body: notification.body,
        itemName: notification.itemId ? itemNameById.get(notification.itemId) || "" : "",
        categoryName: notification.categoryId ? categoryNameById.get(notification.categoryId) || "" : "",
        createdAt: notification.createdAt,
      }));
  }

  return workspaceExportPayloadSchema.parse(payload);
}

export function importWorkspaceDataForUser(workspaceId: number, payload: AnyExportPayload, userId: number): WorkspaceImportResult {
  requireWorkspaceEditor(workspaceId, userId);
  const db = getDb();
  const now = nowIso();
  const hasSection = (section: string) => payload.sections.includes(section as never);
  const importCategories = payload.categories || [];
  const importEntries = payload.entries || [];
  const importFolders = "folders" in payload ? payload.folders || [] : [];
  const importInvoices = "invoices" in payload ? payload.invoices || [] : [];
  const importWebsiteNotifications = "websiteNotifications" in payload ? payload.websiteNotifications || [] : [];
  const result: WorkspaceImportResult = {
    insertedCategories: 0,
    skippedCategories: 0,
    insertedEntries: 0,
    skippedEntries: 0,
    insertedFolders: 0,
    skippedFolders: 0,
    insertedInvoices: 0,
    skippedInvoices: 0,
    insertedWebsiteNotifications: 0,
    skippedWebsiteNotifications: 0,
    warnings: [],
  };

  const existingCategories = listCategoriesForWorkspace(workspaceId, userId);
  const categoryByKey = new Map(existingCategories.map((category) => [categoryKey(category.name), category]));
  const existingItems = listItemsForWorkspace(workspaceId, userId);
  const itemSignatures = new Set(existingItems.map((item) => buildEntrySignature(portableEntrySchema.parse({
    name: item.name,
    categoryName: item.categoryName || "",
    paymentType: item.paymentType,
    amount: item.amount,
    currency: item.currency,
    billingStartAt: item.billingStartAt,
    billingEndAt: item.billingEndAt,
    period: item.period,
    customPeriodDays: item.customPeriodDays,
    vendorName: item.vendorName,
    vendorUrl: item.vendorUrl,
    accountName: item.accountName,
    notes: item.notes,
    customFields: item.customFields,
  }))));
  const itemIdsByName = new Map<string, number[]>();
  existingItems.forEach((item) => {
    const key = item.name.trim().toLowerCase();
    const current = itemIdsByName.get(key) || [];
    current.push(item.id);
    itemIdsByName.set(key, current);
  });

  const existingFolders = new Map(
    ((db.prepare("SELECT id, name FROM folders WHERE workspace_id = ?").all(workspaceId) as DbRow[]).map((row) => [String(row.name).trim().toLowerCase(), Number(row.id)])),
  );

  const existingInvoiceSignatures = new Set(
    listInvoicesForWorkspace(workspaceId, userId).map((invoice) =>
      [
        (invoice.itemName || "").trim().toLowerCase(),
        (invoice.categoryName || "").trim().toLowerCase(),
        invoice.amount.toFixed(6),
        invoice.currency.trim().toUpperCase(),
        invoice.paymentDate || "",
        invoice.dueDate || "",
        invoice.vendorName.trim().toLowerCase(),
        invoice.accountName.trim().toLowerCase(),
      ].join("\u001f")),
  );

  const existingNotificationSignatures = new Set(
    (db
      .prepare("SELECT title, body, created_at FROM notifications WHERE workspace_id = ?")
      .all(workspaceId) as DbRow[])
      .map((row) => `${String(row.title || "").trim().toLowerCase()}\u001f${String(row.body || "").trim().toLowerCase()}\u001f${String(row.created_at || "")}`),
  );

  const maxSortRow = db.prepare("SELECT COALESCE(MAX(sort_order), 0) as sort FROM categories WHERE workspace_id = ?").get(workspaceId) as DbRow;
  let nextSort = Number(maxSortRow.sort || 0);

  const insertCategory = db.prepare(
    "INSERT INTO categories (workspace_id, name, icon, color, sort_order, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertItem = db.prepare(
    `INSERT INTO items
     (workspace_id, name, category_id, payment_type, amount, currency, billing_start_at, billing_end_at, period, custom_period_days, vendor_name, vendor_url, account_name, notes, custom_fields_json, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPriceEvent = db.prepare("INSERT INTO price_events (item_id, amount, created_at) VALUES (?, ?, ?)");
  const insertFolder = db.prepare("INSERT INTO folders (workspace_id, name, owner_id, created_at) VALUES (?, ?, ?, ?)");
  const insertFolderItem = db.prepare("INSERT OR IGNORE INTO folder_items (folder_id, item_id) VALUES (?, ?)");
  const insertFolderCategory = db.prepare("INSERT OR IGNORE INTO folder_categories (folder_id, category_id) VALUES (?, ?)");
  const insertInvoice = db.prepare(
    `INSERT INTO invoices
     (workspace_id, item_id, category_id, vendor_name, vendor_url, account_name, amount, currency, payment_date, due_date, period, custom_period_days, shift_dates, shift_payment_period, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertWebsiteNotification = db.prepare(
    `INSERT INTO notifications
     (workspace_id, title, body, item_id, category_id, created_at, read_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  );

  function ensureCategoryId(name: string) {
    const key = categoryKey(name || "");
    if (!key) return null;
    const existing = categoryByKey.get(key);
    if (existing) return existing.id;
    nextSort += 1;
    const created = insertCategory.run(workspaceId, name.trim(), "Sparkles", "#8b5cf6", nextSort, "[]", now, now);
    const category: Category = {
      id: Number(created.lastInsertRowid),
      workspaceId,
      name: name.trim(),
      icon: "Sparkles",
      color: "#8b5cf6",
      sortOrder: nextSort,
      fields: [],
      createdAt: now,
      updatedAt: now,
    };
    categoryByKey.set(key, category);
    result.insertedCategories += 1;
    return category.id;
  }

  const tx = db.transaction(() => {
    if (hasSection("categories")) {
      importCategories.forEach((candidate) => {
        const category = portableCategorySchema.parse(candidate);
        const key = categoryKey(category.name);
        if (!key) return;
        if (categoryByKey.has(key)) {
          result.skippedCategories += 1;
          return;
        }
        nextSort += 1;
        const created = insertCategory.run(
          workspaceId,
          category.name.trim(),
          category.icon || "Sparkles",
          category.color || "#8b5cf6",
          category.sortOrder > 0 ? category.sortOrder : nextSort,
          JSON.stringify(category.fields || []),
          now,
          now,
        );
        categoryByKey.set(key, {
          id: Number(created.lastInsertRowid),
          workspaceId,
          name: category.name.trim(),
          icon: category.icon || "Sparkles",
          color: category.color || "#8b5cf6",
          sortOrder: category.sortOrder > 0 ? category.sortOrder : nextSort,
          fields: category.fields || [],
          createdAt: now,
          updatedAt: now,
        });
        result.insertedCategories += 1;
      });
    }

    if (hasSection("entries")) {
      importEntries.forEach((candidate) => {
        const entry = portableEntrySchema.parse(candidate);
        const signature = buildEntrySignature(entry);
        if (itemSignatures.has(signature)) {
          result.skippedEntries += 1;
          return;
        }
        const categoryId = ensureCategoryId(entry.categoryName);
        const inserted = insertItem.run(
          workspaceId,
          entry.name.trim(),
          categoryId,
          entry.paymentType,
          entry.amount,
          (entry.currency || "USD").trim().toUpperCase(),
          entry.billingStartAt,
          entry.billingEndAt,
          entry.period,
          entry.customPeriodDays,
          entry.vendorName.trim(),
          entry.vendorUrl.trim(),
          entry.accountName.trim(),
          entry.notes,
          JSON.stringify(entry.customFields || {}),
          userId,
          now,
          now,
        );
        const itemId = Number(inserted.lastInsertRowid);
        insertPriceEvent.run(itemId, entry.amount, now);
        itemSignatures.add(signature);
        const nameKey = entry.name.trim().toLowerCase();
        const current = itemIdsByName.get(nameKey) || [];
        current.push(itemId);
        itemIdsByName.set(nameKey, current);
        result.insertedEntries += 1;
      });
    }

    if (hasSection("folders")) {
      importFolders.forEach((candidate) => {
        const folder = portableFolderSchema.parse(candidate);
        const nameKey = folder.name.trim().toLowerCase();
        if (!nameKey) return;
        let folderId = existingFolders.get(nameKey) || 0;
        if (!folderId) {
          const inserted = insertFolder.run(workspaceId, folder.name.trim(), userId, now);
          folderId = Number(inserted.lastInsertRowid);
          existingFolders.set(nameKey, folderId);
          result.insertedFolders += 1;
        } else {
          result.skippedFolders += 1;
        }
        folder.entryNames.forEach((entryName) => {
          const candidates = itemIdsByName.get(entryName.trim().toLowerCase()) || [];
          if (!candidates.length) {
            result.warnings.push(`Folder "${folder.name}" skipped missing entry "${entryName}".`);
            return;
          }
          insertFolderItem.run(folderId, candidates[0]);
        });
        folder.categoryNames.forEach((categoryName) => {
          const categoryId = ensureCategoryId(categoryName);
          if (!categoryId) return;
          insertFolderCategory.run(folderId, categoryId);
        });
      });
    }

    if (hasSection("invoices")) {
      importInvoices.forEach((candidate) => {
        const invoice = portableInvoiceSchema.parse(candidate);
        const signature = [
          invoice.itemName.trim().toLowerCase(),
          invoice.categoryName.trim().toLowerCase(),
          invoice.amount.toFixed(6),
          invoice.currency.trim().toUpperCase(),
          invoice.paymentDate || "",
          invoice.dueDate || "",
          invoice.vendorName.trim().toLowerCase(),
          invoice.accountName.trim().toLowerCase(),
        ].join("\u001f");
        if (existingInvoiceSignatures.has(signature)) {
          result.skippedInvoices += 1;
          return;
        }
        const itemCandidates = itemIdsByName.get(invoice.itemName.trim().toLowerCase()) || [];
        const categoryId = ensureCategoryId(invoice.categoryName);
        insertInvoice.run(
          workspaceId,
          itemCandidates[0] || null,
          categoryId,
          invoice.vendorName.trim(),
          invoice.vendorUrl.trim(),
          invoice.accountName.trim(),
          invoice.amount,
          invoice.currency.trim().toUpperCase(),
          invoice.paymentDate,
          invoice.dueDate,
          invoice.period,
          invoice.customPeriodDays,
          invoice.shiftDates ? 1 : 0,
          invoice.shiftPaymentPeriod ? 1 : 0,
          now,
        );
        existingInvoiceSignatures.add(signature);
        result.insertedInvoices += 1;
      });
    }

    if (hasSection("websiteNotifications")) {
      importWebsiteNotifications.forEach((candidate) => {
        const notification = portableWebsiteNotificationSchema.parse(candidate);
        const createdAt = notification.createdAt && !Number.isNaN(new Date(notification.createdAt).getTime())
          ? notification.createdAt
          : now;
        const signature = `${notification.title.trim().toLowerCase()}\u001f${notification.body.trim().toLowerCase()}\u001f${createdAt}`;
        if (existingNotificationSignatures.has(signature)) {
          result.skippedWebsiteNotifications += 1;
          return;
        }
        const itemCandidates = itemIdsByName.get(notification.itemName.trim().toLowerCase()) || [];
        const categoryId = ensureCategoryId(notification.categoryName);
        insertWebsiteNotification.run(
          workspaceId,
          notification.title.trim(),
          notification.body,
          itemCandidates[0] || null,
          categoryId,
          createdAt,
        );
        existingNotificationSignatures.add(signature);
        result.insertedWebsiteNotifications += 1;
      });
    }
  });

  tx();
  return result;
}

function normalizeDashboardCurrency(value: string | null | undefined) {
  return ensureSupportedCurrency(value, "USD");
}

async function getConversionRates(displayCurrency: string, currencies: string[]) {
  const display = normalizeDashboardCurrency(displayCurrency);
  const uniqueCurrencies = [...new Set(currencies.map((currency) => normalizeDashboardCurrency(currency)))];
  const rates = new Map<string, number>([[display, 1]]);
  const sources = uniqueCurrencies.filter((currency) => currency !== display);
  if (!sources.length) return rates;

  const db = getDb();
  const freshAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const placeholders = sources.map(() => "?").join(",");
  const freshRows = db
    .prepare(
      `SELECT base_currency, rate
       FROM exchange_rates
       WHERE target_currency = ?
         AND base_currency IN (${placeholders})
         AND fetched_at >= ?`,
    )
    .all(display, ...sources, freshAfter) as DbRow[];
  freshRows.forEach((row) => {
    rates.set(String(row.base_currency), Number(row.rate || 0));
  });

  let missing = sources.filter((currency) => !rates.has(currency));
  if (missing.length) {
    const staleRows = db
      .prepare(
        `SELECT base_currency, rate
         FROM exchange_rates
         WHERE target_currency = ?
           AND base_currency IN (${missing.map(() => "?").join(",")})`,
      )
      .all(display, ...missing) as DbRow[];
    staleRows.forEach((row) => {
      rates.set(String(row.base_currency), Number(row.rate || 0));
    });
    missing = missing.filter((currency) => !rates.has(currency));
  }

  if (missing.length) {
    const fetched: Array<[string, number]> = [];
    for (const source of missing) {
      try {
        const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${source}&quotes=${display}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | Array<{ base?: string; quote?: string; rate?: number }>
          | { rates?: Record<string, number> }
          | null;
        if (!response.ok || !payload) continue;
        let rate = 0;
        if (Array.isArray(payload)) {
          const match = payload.find((row) => String(row.base || "").toUpperCase() === source && String(row.quote || "").toUpperCase() === display);
          rate = Number(match?.rate || 0);
        } else if (payload.rates) {
          rate = Number(payload.rates[display] || 0);
        }
        if (Number.isFinite(rate) && rate > 0) {
          fetched.push([source, rate]);
          rates.set(source, rate);
        }
      } catch {
        // Ignore transient API failures and rely on cached rows.
      }
    }

    if (fetched.length) {
      const upsert = db.prepare(
        `INSERT INTO exchange_rates (base_currency, target_currency, rate, fetched_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(base_currency, target_currency) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at`,
      );
      const now = nowIso();
      const tx = db.transaction((pairs: Array<[string, number]>) => {
        pairs.forEach(([source, rate]) => upsert.run(source, display, rate, now));
      });
      tx(fetched);
    }
  }

  const stillMissing = sources.filter((currency) => !rates.has(currency));
  if (stillMissing.length) {
    throw new Error(`Currency conversion unavailable for: ${stillMissing.join(", ")} -> ${display}`);
  }
  return rates;
}

function convertForDisplay(amount: number, sourceCurrency: string, displayCurrency: string, rates: Map<string, number>) {
  const from = normalizeDashboardCurrency(sourceCurrency);
  const to = normalizeDashboardCurrency(displayCurrency);
  if (from === to) return amount;
  const sourceToDisplay = rates.get(from);
  if (!sourceToDisplay || !Number.isFinite(sourceToDisplay) || sourceToDisplay <= 0) {
    throw new Error(`Missing exchange rate for ${from} -> ${to}`);
  }
  return amount * sourceToDisplay;
}

export async function dashboardStats(userId?: number, displayCurrency = "USD"): Promise<DashboardStats> {
  const items = typeof userId === "number" ? listItemsForUser(userId) : listItems();
  const resolvedDisplayCurrency = normalizeDashboardCurrency(displayCurrency);
  const rates = await getConversionRates(resolvedDisplayCurrency, items.map((item) => item.currency));
  const recurring = items.filter((item) => item.paymentType === "recurring");
  const monthlyItems = recurring.filter((item) => item.period === "1m");
  const monthlyRecurring = monthlyItems.reduce((sum, item) => sum + convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates), 0);
  const approxMonthlySpend = recurring.reduce((sum, item) => sum + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates), 0);
  const totalExpenses = items.reduce((sum, item) => sum + convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates), 0);
  const since = new Date();
  since.setMonth(since.getMonth() - 1);
  const newMonthly = recurring
    .filter((item) => new Date(item.createdAt) >= since)
    .reduce((sum, item) => sum + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates), 0);

  const priceChanges = (getDb()
    .prepare("SELECT item_id, amount, created_at FROM price_events WHERE created_at >= ? ORDER BY created_at ASC")
    .all(since.toISOString()) as DbRow[]).reduce((sum, event) => {
    const item = items.find((candidate) => candidate.id === Number(event.item_id));
    if (!item || item.paymentType !== "recurring") return sum;
    return sum + convertForDisplay(normalizeMonthlyAmount({ ...item, amount: Number(event.amount || 0) }), item.currency, resolvedDisplayCurrency, rates);
  }, 0);

  const oneMonthChangeAmount = newMonthly + priceChanges;
  const categoryMap = new Map<string, { name: string; icon: string; color: string; monthly: number }>();
  const categoryItemMap = new Map<string, { name: string; icon: string; color: string; count: number }>();
  items.forEach((item) => {
    const key = item.categoryName || "Uncategorized";
    const current = categoryItemMap.get(key) || {
      name: key,
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      count: 0,
    };
    current.count += 1;
    categoryItemMap.set(key, current);
  });
  recurring.forEach((item) => {
    const key = item.categoryName || "Uncategorized";
    const current = categoryMap.get(key) || {
      name: key,
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      monthly: 0,
    };
    current.monthly += convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates);
    categoryMap.set(key, current);
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = recurring
    .map((item) => {
      const nextPayment = currentDueDate(item);
      if (!nextPayment) return null;
      const daysUntilPayment = daysBetween(now, nextPayment);
      if (daysUntilPayment > 14) return null;
      return { ...item, nextPaymentAt: nextPayment.toISOString(), daysUntilPayment };
    })
    .filter((item): item is PaymentItem & { nextPaymentAt: string; daysUntilPayment: number } => Boolean(item))
    .sort((a, b) => a.nextPaymentAt.localeCompare(b.nextPaymentAt));

  const dueMap = new Map<
    string,
    { categoryId: number | null; name: string; icon: string; color: string; week: number; month: number; quarter: number; year: number }
  >();
  recurring.forEach((item) => {
    if (!item.billingEndAt || !item.period) return;
    const key = String(item.categoryId || "none");
    const current = dueMap.get(key) || {
      categoryId: item.categoryId,
      name: item.categoryName || "Uncategorized",
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      week: 0,
      month: 0,
      quarter: 0,
      year: 0,
    };
    const nextPayment = nextForecastPaymentDate(item, now);
    if (!nextPayment) return;

    const horizons = [
      { key: "week" as const, days: 7 },
      { key: "month" as const, days: 30 },
      { key: "quarter" as const, days: 90 },
      { key: "year" as const, days: null },
    ];

    horizons.forEach((horizon) => {
      const end = new Date(now);
      if (horizon.days === null) {
        end.setMonth(11, 31);
      } else {
        end.setDate(end.getDate() + horizon.days);
      }
      end.setHours(23, 59, 59, 999);
      let occurrence = new Date(nextPayment);
      while (occurrence <= end) {
        current[horizon.key] += convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates);
        occurrence = addBillingPeriod(occurrence, item.period, item.customPeriodDays);
        occurrence.setHours(0, 0, 0, 0);
      }
    });
    dueMap.set(key, current);
  });

  return {
    displayCurrency: resolvedDisplayCurrency,
    totalExpenses,
    monthlyRecurring,
    monthlyRecurringCount: monthlyItems.length,
    approxMonthlySpend,
    approxYearlySpend: approxMonthlySpend * 12,
    yearlyRecurring: approxMonthlySpend * 12,
    recurringCount: recurring.length,
    oneMonthChangeAmount,
    oneMonthChangePercent: approxMonthlySpend ? (oneMonthChangeAmount / Math.max(approxMonthlySpend - oneMonthChangeAmount, 1)) * 100 : 0,
    upcoming,
    upcomingDueByCategory: [...dueMap.values()].sort((a, b) => b.year - a.year),
    categoryItemSplit: [...categoryItemMap.values()].sort((a, b) => b.count - a.count),
    categoryBreakdown: [...categoryMap.values()].sort((a, b) => b.monthly - a.monthly),
    workspaceObjectDominance: [],
    workspaceCostDominance: [],
    trend: [
      { label: "Previous", amount: Math.max(approxMonthlySpend - oneMonthChangeAmount, 0) },
      { label: "Current", amount: approxMonthlySpend },
    ],
  };
}

export async function dashboardStatsForWorkspace(workspaceId: number, userId: number, displayCurrency = "USD"): Promise<DashboardStats> {
  requireWorkspaceViewer(workspaceId, userId);
  const items = listItemsForWorkspace(workspaceId, userId);
  const resolvedDisplayCurrency = normalizeDashboardCurrency(displayCurrency);
  const rates = await getConversionRates(resolvedDisplayCurrency, items.map((item) => item.currency));
  const recurring = items.filter((item) => item.paymentType === "recurring");
  const monthlyItems = recurring.filter((item) => item.period === "1m");
  const monthlyRecurring = monthlyItems.reduce((sum, item) => sum + convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates), 0);
  const approxMonthlySpend = recurring.reduce((sum, item) => sum + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates), 0);
  const totalExpenses = items.reduce((sum, item) => sum + convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates), 0);
  const since = new Date();
  since.setMonth(since.getMonth() - 1);
  const newMonthly = recurring
    .filter((item) => new Date(item.createdAt) >= since)
    .reduce((sum, item) => sum + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates), 0);

  const priceChanges = (getDb()
    .prepare(
      `SELECT item_id, amount, created_at
       FROM price_events
       WHERE created_at >= ?
         AND item_id IN (SELECT id FROM items WHERE workspace_id = ?)
       ORDER BY created_at ASC`,
    )
    .all(since.toISOString(), workspaceId) as DbRow[]).reduce((sum, event) => {
    const item = items.find((candidate) => candidate.id === Number(event.item_id));
    if (!item || item.paymentType !== "recurring") return sum;
    return sum + convertForDisplay(normalizeMonthlyAmount({ ...item, amount: Number(event.amount || 0) }), item.currency, resolvedDisplayCurrency, rates);
  }, 0);

  const oneMonthChangeAmount = newMonthly + priceChanges;
  const categoryMap = new Map<string, { name: string; icon: string; color: string; monthly: number }>();
  const categoryItemMap = new Map<string, { name: string; icon: string; color: string; count: number }>();
  items.forEach((item) => {
    const key = item.categoryName || "Uncategorized";
    const current = categoryItemMap.get(key) || {
      name: key,
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      count: 0,
    };
    current.count += 1;
    categoryItemMap.set(key, current);
  });
  recurring.forEach((item) => {
    const key = item.categoryName || "Uncategorized";
    const current = categoryMap.get(key) || {
      name: key,
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      monthly: 0,
    };
    current.monthly += convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates);
    categoryMap.set(key, current);
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = recurring
    .map((item) => {
      const nextPayment = currentDueDate(item);
      if (!nextPayment) return null;
      const daysUntilPayment = daysBetween(now, nextPayment);
      if (daysUntilPayment > 14) return null;
      return { ...item, nextPaymentAt: nextPayment.toISOString(), daysUntilPayment };
    })
    .filter((item): item is PaymentItem & { nextPaymentAt: string; daysUntilPayment: number } => Boolean(item))
    .sort((a, b) => a.nextPaymentAt.localeCompare(b.nextPaymentAt));

  const dueMap = new Map<
    string,
    { categoryId: number | null; name: string; icon: string; color: string; week: number; month: number; quarter: number; year: number }
  >();
  recurring.forEach((item) => {
    if (!item.billingEndAt || !item.period) return;
    const key = String(item.categoryId || "none");
    const current = dueMap.get(key) || {
      categoryId: item.categoryId,
      name: item.categoryName || "Uncategorized",
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      week: 0,
      month: 0,
      quarter: 0,
      year: 0,
    };
    const nextPayment = nextForecastPaymentDate(item, now);
    if (!nextPayment) return;
    const horizons = [
      { key: "week" as const, days: 7 },
      { key: "month" as const, days: 30 },
      { key: "quarter" as const, days: 90 },
      { key: "year" as const, days: null },
    ];
    horizons.forEach((horizon) => {
      const end = new Date(now);
      if (horizon.days === null) end.setMonth(11, 31);
      else end.setDate(end.getDate() + horizon.days);
      end.setHours(23, 59, 59, 999);
      let occurrence = new Date(nextPayment);
      while (occurrence <= end) {
        current[horizon.key] += convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates);
        occurrence = addBillingPeriod(occurrence, item.period, item.customPeriodDays);
        occurrence.setHours(0, 0, 0, 0);
      }
    });
    dueMap.set(key, current);
  });

  return {
    displayCurrency: resolvedDisplayCurrency,
    totalExpenses,
    monthlyRecurring,
    monthlyRecurringCount: monthlyItems.length,
    approxMonthlySpend,
    approxYearlySpend: approxMonthlySpend * 12,
    yearlyRecurring: approxMonthlySpend * 12,
    recurringCount: recurring.length,
    oneMonthChangeAmount,
    oneMonthChangePercent: approxMonthlySpend ? (oneMonthChangeAmount / Math.max(approxMonthlySpend - oneMonthChangeAmount, 1)) * 100 : 0,
    upcoming,
    upcomingDueByCategory: [...dueMap.values()].sort((a, b) => b.year - a.year),
    categoryItemSplit: [...categoryItemMap.values()].sort((a, b) => b.count - a.count),
    categoryBreakdown: [...categoryMap.values()].sort((a, b) => b.monthly - a.monthly),
    workspaceObjectDominance: [],
    workspaceCostDominance: [],
    trend: [
      { label: "Previous", amount: Math.max(approxMonthlySpend - oneMonthChangeAmount, 0) },
      { label: "Current", amount: approxMonthlySpend },
    ],
  };
}

const WORKSPACE_DOMINANCE_COLORS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6", "#84cc16", "#ef4444"];

function workspaceColor(index: number) {
  return WORKSPACE_DOMINANCE_COLORS[index % WORKSPACE_DOMINANCE_COLORS.length];
}

export async function dashboardStatsGlobalForUser(userId: number, displayCurrency = "USD"): Promise<DashboardStats> {
  const workspaces = listWorkspacesForUser(userId);
  const items = workspaces.flatMap((workspace) => listItemsForWorkspace(workspace.id, userId));
  const resolvedDisplayCurrency = normalizeDashboardCurrency(displayCurrency);
  const rates = await getConversionRates(resolvedDisplayCurrency, items.map((item) => item.currency));
  const recurring = items.filter((item) => item.paymentType === "recurring");
  const monthlyItems = recurring.filter((item) => item.period === "1m");
  const monthlyRecurring = monthlyItems.reduce((sum, item) => sum + convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates), 0);
  const approxMonthlySpend = recurring.reduce((sum, item) => sum + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates), 0);
  const totalExpenses = items.reduce((sum, item) => sum + convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates), 0);
  const since = new Date();
  since.setMonth(since.getMonth() - 1);
  const newMonthly = recurring
    .filter((item) => new Date(item.createdAt) >= since)
    .reduce((sum, item) => sum + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates), 0);
  const priceChanges = (getDb()
    .prepare("SELECT item_id, amount, created_at FROM price_events WHERE created_at >= ? ORDER BY created_at ASC")
    .all(since.toISOString()) as DbRow[]).reduce((sum, event) => {
    const item = items.find((candidate) => candidate.id === Number(event.item_id));
    if (!item || item.paymentType !== "recurring") return sum;
    return sum + convertForDisplay(normalizeMonthlyAmount({ ...item, amount: Number(event.amount || 0) }), item.currency, resolvedDisplayCurrency, rates);
  }, 0);
  const oneMonthChangeAmount = newMonthly + priceChanges;

  const categoryMap = new Map<string, { name: string; icon: string; color: string; monthly: number }>();
  const categoryItemMap = new Map<string, { name: string; icon: string; color: string; count: number }>();
  items.forEach((item) => {
    const key = item.categoryName || "Uncategorized";
    const current = categoryItemMap.get(key) || {
      name: key,
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      count: 0,
    };
    current.count += 1;
    categoryItemMap.set(key, current);
  });
  recurring.forEach((item) => {
    const key = item.categoryName || "Uncategorized";
    const current = categoryMap.get(key) || {
      name: key,
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      monthly: 0,
    };
    current.monthly += convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates);
    categoryMap.set(key, current);
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = recurring
    .map((item) => {
      const nextPayment = currentDueDate(item);
      if (!nextPayment) return null;
      const daysUntilPayment = daysBetween(now, nextPayment);
      if (daysUntilPayment > 14) return null;
      return { ...item, nextPaymentAt: nextPayment.toISOString(), daysUntilPayment };
    })
    .filter((item): item is PaymentItem & { nextPaymentAt: string; daysUntilPayment: number } => Boolean(item))
    .sort((a, b) => a.nextPaymentAt.localeCompare(b.nextPaymentAt));

  const dueMap = new Map<
    string,
    { categoryId: number | null; name: string; icon: string; color: string; week: number; month: number; quarter: number; year: number }
  >();
  recurring.forEach((item) => {
    if (!item.billingEndAt || !item.period) return;
    const key = String(item.categoryId || "none");
    const current = dueMap.get(key) || {
      categoryId: item.categoryId,
      name: item.categoryName || "Uncategorized",
      icon: item.categoryIcon || "Boxes",
      color: item.categoryColor || "#8b5cf6",
      week: 0,
      month: 0,
      quarter: 0,
      year: 0,
    };
    const nextPayment = nextForecastPaymentDate(item, now);
    if (!nextPayment) return;
    const horizons = [
      { key: "week" as const, days: 7 },
      { key: "month" as const, days: 30 },
      { key: "quarter" as const, days: 90 },
      { key: "year" as const, days: null },
    ];
    horizons.forEach((horizon) => {
      const end = new Date(now);
      if (horizon.days === null) end.setMonth(11, 31);
      else end.setDate(end.getDate() + horizon.days);
      end.setHours(23, 59, 59, 999);
      let occurrence = new Date(nextPayment);
      while (occurrence <= end) {
        current[horizon.key] += convertForDisplay(item.amount, item.currency, resolvedDisplayCurrency, rates);
        occurrence = addBillingPeriod(occurrence, item.period, item.customPeriodDays);
        occurrence.setHours(0, 0, 0, 0);
      }
    });
    dueMap.set(key, current);
  });

  const workspaceMetaById = new Map(workspaces.map((workspace) => [workspace.id, workspace] as const));
  const workspaceObjectMap = new Map<number, number>();
  const workspaceCostMap = new Map<number, number>();
  for (const workspace of workspaces) {
    const categoryCount = listCategoriesForWorkspace(workspace.id, userId).length;
    workspaceObjectMap.set(workspace.id, categoryCount);
  }
  items.forEach((item) => {
    if (!item.workspaceId) return;
    workspaceObjectMap.set(item.workspaceId, (workspaceObjectMap.get(item.workspaceId) || 0) + 1);
    if (item.paymentType === "recurring") {
      workspaceCostMap.set(
        item.workspaceId,
        (workspaceCostMap.get(item.workspaceId) || 0) + convertForDisplay(normalizeMonthlyAmount(item), item.currency, resolvedDisplayCurrency, rates),
      );
    }
  });
  const workspaceObjectDominance = [...workspaceObjectMap.entries()]
    .map(([workspaceId, count], index) => {
      const workspace = workspaceMetaById.get(workspaceId);
      return { name: `${workspace?.emoji || "📦"} ${workspace?.name || `Workspace ${workspaceId}`}`, color: workspaceColor(index), count };
    })
    .sort((a, b) => b.count - a.count);
  const workspaceCostDominance = [...workspaceCostMap.entries()]
    .map(([workspaceId, monthly], index) => {
      const workspace = workspaceMetaById.get(workspaceId);
      return { name: `${workspace?.emoji || "📦"} ${workspace?.name || `Workspace ${workspaceId}`}`, color: workspaceColor(index), monthly };
    })
    .sort((a, b) => b.monthly - a.monthly);

  return {
    displayCurrency: resolvedDisplayCurrency,
    totalExpenses,
    monthlyRecurring,
    monthlyRecurringCount: monthlyItems.length,
    approxMonthlySpend,
    approxYearlySpend: approxMonthlySpend * 12,
    yearlyRecurring: approxMonthlySpend * 12,
    recurringCount: recurring.length,
    oneMonthChangeAmount,
    oneMonthChangePercent: approxMonthlySpend ? (oneMonthChangeAmount / Math.max(approxMonthlySpend - oneMonthChangeAmount, 1)) * 100 : 0,
    upcoming,
    upcomingDueByCategory: [...dueMap.values()].sort((a, b) => b.year - a.year),
    categoryItemSplit: [...categoryItemMap.values()].sort((a, b) => b.count - a.count),
    categoryBreakdown: [...categoryMap.values()].sort((a, b) => b.monthly - a.monthly),
    workspaceObjectDominance,
    workspaceCostDominance,
    trend: [
      { label: "Previous", amount: Math.max(approxMonthlySpend - oneMonthChangeAmount, 0) },
      { label: "Current", amount: approxMonthlySpend },
    ],
  };
}

export function listFolders() {
  return (
    getDb()
      .prepare(
        `SELECT folders.*,
          (SELECT COUNT(*) FROM folder_items WHERE folder_items.folder_id = folders.id) as item_count,
          (SELECT COUNT(*) FROM folder_categories WHERE folder_categories.folder_id = folders.id) as category_count,
          (SELECT COUNT(*) FROM folder_members WHERE folder_members.folder_id = folders.id) as member_count
         FROM folders
         ORDER BY created_at DESC`,
      )
      .all() as DbRow[]
  ).map(mapFolder);
}

export function listFoldersForUser(userId: number) {
  return (
    getDb()
      .prepare(
        `SELECT folders.*, users.username as owner_username,
          CASE WHEN folders.owner_id = ? THEN 'owner' ELSE folder_members.role END as access_role,
          (SELECT COUNT(*) FROM folder_items WHERE folder_items.folder_id = folders.id) as item_count,
          (SELECT COUNT(*) FROM folder_categories WHERE folder_categories.folder_id = folders.id) as category_count,
          (SELECT COUNT(*) FROM folder_members WHERE folder_members.folder_id = folders.id) as member_count
         FROM folders
         JOIN users ON users.id = folders.owner_id
         LEFT JOIN folder_members ON folder_members.folder_id = folders.id AND folder_members.user_id = ?
         WHERE folders.owner_id = ? OR folder_members.user_id = ?
         ORDER BY folders.created_at DESC`,
      )
      .all(userId, userId, userId, userId) as DbRow[]
  ).map(mapFolder);
}

function getFolderAccess(folderId: number, userId: number) {
  const row = getDb()
    .prepare(
      `SELECT folders.owner_id, folder_members.role
       FROM folders
       LEFT JOIN folder_members ON folder_members.folder_id = folders.id AND folder_members.user_id = ?
       WHERE folders.id = ?`,
    )
    .get(userId, folderId) as { owner_id: number; role?: ShareRole } | undefined;
  if (!row) return null;
  if (Number(row.owner_id) === userId) return "owner" as const;
  return row.role || null;
}

function requireFolderEditor(folderId: number, userId: number) {
  const access = getFolderAccess(folderId, userId);
  if (access !== "owner" && access !== "editor") {
    throw new Error("You cannot edit this folder.");
  }
}

function requireFolderOwner(folderId: number, userId: number) {
  const access = getFolderAccess(folderId, userId);
  if (access !== "owner") {
    throw new Error("Only folder owner can manage sharing.");
  }
}

export function getFolderRelations(folderId: number) {
  const db = getDb();
  return {
    itemIds: new Set((db.prepare("SELECT item_id FROM folder_items WHERE folder_id = ?").all(folderId) as DbRow[]).map((row) => Number(row.item_id))),
    categoryIds: new Set(
      (db.prepare("SELECT category_id FROM folder_categories WHERE folder_id = ?").all(folderId) as DbRow[]).map((row) => Number(row.category_id)),
    ),
  };
}

export function listFolderItems(folderId: number) {
  return (
    getDb()
      .prepare(
        `SELECT items.*, categories.name as category_name, categories.icon as category_icon, categories.color as category_color
         FROM folder_items
         JOIN items ON items.id = folder_items.item_id
         LEFT JOIN categories ON categories.id = items.category_id
         WHERE folder_items.folder_id = ?
         ORDER BY items.name ASC`,
      )
      .all(folderId) as DbRow[]
  ).map(mapItem);
}

export function listFolderCategories(folderId: number) {
  return (
    getDb()
      .prepare(
        `SELECT categories.*
         FROM folder_categories
         JOIN categories ON categories.id = folder_categories.category_id
         WHERE folder_categories.folder_id = ?
         ORDER BY categories.name ASC`,
      )
      .all(folderId) as DbRow[]
  ).map(mapCategory);
}

export function listFolderMembers(folderId: number) {
  return getDb()
    .prepare(
      `SELECT users.username, users.role as user_role, folder_members.role
       FROM folder_members
       JOIN users ON users.id = folder_members.user_id
       WHERE folder_members.folder_id = ?
       ORDER BY users.username`,
    )
    .all(folderId) as Array<{ username: string; role: ShareRole; user_role: UserRole }>;
}

export function listFolderInvites(folderId: number) {
  return getDb()
    .prepare("SELECT token, role, created_at FROM invite_links WHERE folder_id = ? AND revoked_at IS NULL ORDER BY created_at DESC")
    .all(folderId) as Array<{ token: string; role: ShareRole; created_at: string }>;
}

export function createFolder(name: string, ownerId: number, itemIds: number[] = [], categoryIds: number[] = []) {
  const db = getDb();
  const workspaceId = Number((db.prepare("SELECT id FROM workspaces WHERE owner_id = ? ORDER BY id ASC LIMIT 1").get(ownerId) as DbRow | undefined)?.id || 0) || null;
  const result = db
    .prepare("INSERT INTO folders (workspace_id, name, owner_id, created_at) VALUES (?, ?, ?, ?)")
    .run(workspaceId, name.trim(), ownerId, nowIso());
  const folderId = Number(result.lastInsertRowid);
  const itemInsert = db.prepare("INSERT OR IGNORE INTO folder_items (folder_id, item_id) VALUES (?, ?)");
  const categoryInsert = db.prepare("INSERT OR IGNORE INTO folder_categories (folder_id, category_id) VALUES (?, ?)");
  const ownedItemIds = new Set(listItemsForUser(ownerId).map((item) => item.id));
  itemIds.filter((id) => ownedItemIds.has(id)).forEach((id) => itemInsert.run(folderId, id));
  categoryIds.filter(Boolean).forEach((id) => categoryInsert.run(folderId, id));
  return folderId;
}

export function updateFolderContentForUser(formData: FormData, userId: number) {
  const folderId = Number(formData.get("folderId"));
  requireFolderEditor(folderId, userId);
  const itemIds = formData.getAll("itemIds").map(Number);
  const categoryIds = formData.getAll("categoryIds").map(Number);
  const db = getDb();
  const allowedItemIds = new Set(listItemsForUser(userId).map((item) => item.id));
  db.prepare("DELETE FROM folder_items WHERE folder_id = ?").run(folderId);
  db.prepare("DELETE FROM folder_categories WHERE folder_id = ?").run(folderId);
  const itemInsert = db.prepare("INSERT OR IGNORE INTO folder_items (folder_id, item_id) VALUES (?, ?)");
  const categoryInsert = db.prepare("INSERT OR IGNORE INTO folder_categories (folder_id, category_id) VALUES (?, ?)");
  itemIds.filter((id) => allowedItemIds.has(id)).forEach((id) => itemInsert.run(folderId, id));
  categoryIds.forEach((id) => categoryInsert.run(folderId, id));
}

export function addFolderMemberForUser(folderId: number, username: string, role: ShareRole, actorId: number) {
  requireFolderOwner(folderId, actorId);
  const user = getUserAuthByUsername(username);
  if (!user) throw new Error("User not found.");
  if (Number(user.id) === actorId) throw new Error("You already own this folder.");
  getDb()
    .prepare("INSERT OR REPLACE INTO folder_members (folder_id, user_id, role) VALUES (?, ?, ?)")
    .run(folderId, Number(user.id), role);
}

export function createInviteForUser(folderId: number, role: ShareRole, actorId: number) {
  requireFolderOwner(folderId, actorId);
  const token = crypto.randomUUID().replaceAll("-", "");
  getDb()
    .prepare("INSERT INTO invite_links (folder_id, token, role, created_at) VALUES (?, ?, ?, ?)")
    .run(folderId, token, role, nowIso());
  return token;
}

export function getInvite(token: string) {
  return getDb()
    .prepare(
      `SELECT invite_links.*, folders.name as folder_name
       FROM invite_links
       JOIN folders ON folders.id = invite_links.folder_id
       WHERE token = ? AND revoked_at IS NULL`,
    )
    .get(token) as ({ folder_id: number; folder_name: string; role: ShareRole } & DbRow) | undefined;
}

export function acceptInvite(token: string, userId: number) {
  const invite = getInvite(token);
  if (!invite) throw new Error("Invite is invalid or revoked.");
  const folder = getDb().prepare("SELECT owner_id FROM folders WHERE id = ?").get(Number(invite.folder_id)) as DbRow | undefined;
  const ownerId = Number(folder?.owner_id || 0);
  if (ownerId === userId) return;
  getDb()
    .prepare("INSERT OR REPLACE INTO folder_members (folder_id, user_id, role) VALUES (?, ?, ?)")
    .run(Number(invite.folder_id), userId, invite.role);
}

export function listInvoices() {
  return (getDb()
    .prepare(
      `SELECT invoices.*, items.name as item_name, categories.name as category_name
       FROM invoices
       LEFT JOIN items ON items.id = invoices.item_id
       LEFT JOIN categories ON categories.id = invoices.category_id
       ORDER BY invoices.created_at DESC`,
    )
    .all() as DbRow[]).map(mapInvoice);
}

export function listInvoicesForUser(userId: number) {
  return (getDb()
    .prepare(
      `SELECT invoices.*, items.name as item_name, categories.name as category_name
       FROM invoices
       LEFT JOIN items ON items.id = invoices.item_id
       LEFT JOIN categories ON categories.id = invoices.category_id
       WHERE items.owner_id = ?
       ORDER BY invoices.created_at DESC`,
    )
    .all(userId) as DbRow[]).map(mapInvoice);
}

export function createInvoiceForUser(formData: FormData, userId: number) {
  const itemId = Number(formData.get("itemId") || 0) || null;
  const item = itemId ? getItemForUser(itemId, userId) : null;
  if (itemId && !item) {
    throw new Error("You can only invoice your own entries.");
  }
  return createInvoice(formData);
}

export function createInvoice(formData: FormData) {
  const itemId = Number(formData.get("itemId") || 0) || null;
  const item = itemId ? getItem(itemId) : null;
  const categoryId = Number(formData.get("categoryId") || item?.categoryId || 0) || null;
  const period = String(formData.get("period") || item?.period || "1m") as BillingPeriod;
  const customPeriodDays = period === "custom" ? Number(formData.get("customPeriodDays") || item?.customPeriodDays || 30) : null;
  const paymentDate = normalizeDate(formData.get("paymentDate"));
  const explicitDueDate = normalizeDate(formData.get("dueDate"));
  const dueDate = explicitDueDate || (paymentDate ? addBillingPeriod(new Date(paymentDate), period, customPeriodDays).toISOString() : null);
  const shiftDates = formData.get("shiftDates") === "on" || formData.get("shiftDates") === "true";
  const shiftPaymentPeriod = formData.get("shiftPaymentPeriod") === "on" || formData.get("shiftPaymentPeriod") === "true";
  const vendorName = String(formData.get("vendorName") || item?.vendorName || "").trim();
  const vendorUrl = String(formData.get("vendorUrl") || item?.vendorUrl || "").trim();
  const accountName = String(formData.get("accountName") || item?.accountName || "").trim();
  const amount = Number(formData.get("amount") || item?.amount || 0);
  const currency = ensureSupportedCurrency(String(formData.get("currency") || item?.currency || "USD"));

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO invoices
       (item_id, category_id, vendor_name, vendor_url, account_name, amount, currency, payment_date, due_date, period, custom_period_days, shift_dates, shift_payment_period, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(itemId, categoryId, vendorName, vendorUrl, accountName, amount, currency, paymentDate, dueDate, period, customPeriodDays, shiftDates ? 1 : 0, shiftPaymentPeriod ? 1 : 0, nowIso());

  if (itemId && item) {
    const nextPeriod = shiftPaymentPeriod ? period : item.period;
    const nextCustomDays = shiftPaymentPeriod ? customPeriodDays : item.customPeriodDays;
    let nextStart = item.billingStartAt;
    let nextEnd = item.billingEndAt;

    if (shiftDates) {
      nextStart = paymentDate || item.billingStartAt;
      nextEnd =
        dueDate ||
        (nextStart && period
          ? addBillingPeriod(new Date(nextStart), period, customPeriodDays).toISOString()
          : item.billingEndAt);
    } else if (shiftPaymentPeriod && item.billingStartAt && nextPeriod) {
      nextEnd = addBillingPeriod(new Date(item.billingStartAt), nextPeriod, nextCustomDays).toISOString();
    }

    db.prepare(
      `UPDATE items
       SET billing_start_at = ?, billing_end_at = ?, period = ?, custom_period_days = ?, amount = ?, currency = ?, vendor_name = ?, vendor_url = ?, account_name = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextStart, nextEnd, nextPeriod, nextCustomDays, amount, currency, vendorName, vendorUrl, accountName, nowIso(), itemId);
    if (item.amount !== amount) {
      db.prepare("INSERT INTO price_events (item_id, amount, created_at) VALUES (?, ?, ?)").run(itemId, amount, nowIso());
    }
  }

  return Number(result.lastInsertRowid);
}

export function payEntryForUser(itemId: number, userId: number, paymentDate?: FormDataEntryValue | null) {
  const item = getItemForUser(itemId, userId);
  if (!item) {
    throw new Error("You can only modify your own entries.");
  }
  return payEntry(itemId, paymentDate);
}

export function payEntry(itemId: number, paymentDate?: FormDataEntryValue | null) {
  const item = getItem(itemId);
  if (!item || item.paymentType !== "recurring" || !item.period || !item.billingEndAt) {
    throw new Error("Only recurring entries with a due date can be paid.");
  }

  const db = getDb();
  const paidThrough = dayStart(new Date(item.billingEndAt));
  const nextEnd = addBillingPeriod(paidThrough, item.period, item.customPeriodDays);
  const now = nowIso();
  const invoicePaymentDate = normalizeDate(paymentDate || null) || now;

  db.prepare(
    `INSERT INTO invoices
     (item_id, category_id, vendor_name, vendor_url, account_name, amount, currency, payment_date, due_date, period, custom_period_days, shift_dates, shift_payment_period, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
  ).run(
    item.id,
    item.categoryId,
    item.vendorName,
    item.vendorUrl,
    item.accountName,
    item.amount,
    item.currency,
    invoicePaymentDate,
    nextEnd.toISOString(),
    item.period,
    item.customPeriodDays,
    now,
  );

  db.prepare("UPDATE items SET billing_start_at = ?, billing_end_at = ?, updated_at = ? WHERE id = ?").run(
    paidThrough.toISOString(),
    nextEnd.toISOString(),
    now,
    item.id,
  );
}

export function listNotificationChannels() {
  return (getDb().prepare("SELECT * FROM notification_channels ORDER BY type ASC, title ASC").all() as DbRow[]).map(mapNotificationChannel);
}

export function listWebsiteNotificationsForUser(userId: number, limit = 20) {
  return (getDb()
    .prepare(
      `SELECT notifications.*
       FROM notifications
       JOIN items ON items.id = notifications.item_id
       WHERE items.owner_id = ?
       ORDER BY notifications.created_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as DbRow[]).map(mapWebsiteNotification);
}

export function unreadNotificationCountForUser(userId: number) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as count
       FROM notifications
       JOIN items ON items.id = notifications.item_id
       WHERE items.owner_id = ? AND notifications.read_at IS NULL`,
    )
    .get(userId) as DbRow;
  return Number(row.count || 0);
}

export function unreadWebsiteNotificationsForUser(userId: number, limit = 10) {
  return (getDb()
    .prepare(
      `SELECT notifications.*
       FROM notifications
       JOIN items ON items.id = notifications.item_id
       WHERE items.owner_id = ? AND notifications.read_at IS NULL
       ORDER BY notifications.created_at DESC
       LIMIT ?`,
    )
    .all(userId, limit) as DbRow[]).map(mapWebsiteNotification);
}

export function markNotificationReadForUser(id: number, userId: number) {
  getDb()
    .prepare(
      `UPDATE notifications
       SET read_at = ?
       WHERE id = ?
         AND item_id IN (SELECT id FROM items WHERE owner_id = ?)`,
    )
    .run(nowIso(), id, userId);
}

export function markAllNotificationsReadForUser(userId: number) {
  getDb()
    .prepare(
      `UPDATE notifications
       SET read_at = ?
       WHERE read_at IS NULL
         AND item_id IN (SELECT id FROM items WHERE owner_id = ?)`,
    )
    .run(nowIso(), userId);
}

function normalizeHttpProxyUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Proxy URL is invalid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Proxy URL must use http or https.");
  }
  return parsed.toString();
}

export function upsertTelegramChannel(formData: FormData) {
  const id = Number(formData.get("id") || 0);
  const title = String(formData.get("title") || "").trim();
  const botToken = String(formData.get("botToken") || "").trim();
  const chatId = String(formData.get("chatId") || "").trim();
  const topicId = String(formData.get("topicId") || "").trim();
  const proxyUrl = normalizeHttpProxyUrl(String(formData.get("proxyUrl") || ""));
  if (!title || !botToken || !chatId) throw new Error("Title, token, and chat ID are required.");

  if (id) {
    getDb()
      .prepare("UPDATE notification_channels SET title = ?, bot_token = ?, chat_id = ?, topic_id = ?, proxy_url = ? WHERE id = ? AND type = 'telegram'")
      .run(title, botToken, chatId, topicId, proxyUrl, id);
    return id;
  }

  const result = getDb()
    .prepare("INSERT INTO notification_channels (type, title, bot_token, chat_id, topic_id, proxy_url, created_at) VALUES ('telegram', ?, ?, ?, ?, ?, ?)")
    .run(title, botToken, chatId, topicId, proxyUrl, nowIso());
  return Number(result.lastInsertRowid);
}

export function deleteNotificationChannel(id: number) {
  getDb().prepare("DELETE FROM notification_channels WHERE id = ? AND type = 'telegram'").run(id);
}

export function listInvoicesForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return (getDb()
    .prepare(
      `SELECT invoices.*, items.name as item_name, categories.name as category_name
       FROM invoices
       LEFT JOIN items ON items.id = invoices.item_id
       LEFT JOIN categories ON categories.id = invoices.category_id
       WHERE invoices.workspace_id = ?
       ORDER BY invoices.created_at DESC`,
    )
    .all(workspaceId) as DbRow[]).map(mapInvoice);
}

export function createInvoiceForWorkspace(formData: FormData, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const itemId = Number(formData.get("itemId") || 0) || null;
  const item = itemId ? getItemForWorkspace(itemId, workspaceId, userId) : null;
  if (itemId && !item) {
    throw new Error("Entry is not available in this workspace.");
  }
  const invoiceId = createInvoice(formData);
  getDb().prepare("UPDATE invoices SET workspace_id = ? WHERE id = ?").run(workspaceId, invoiceId);
  return invoiceId;
}

export function payEntryForWorkspace(itemId: number, workspaceId: number, userId: number, paymentDate?: FormDataEntryValue | null) {
  requireWorkspaceEditor(workspaceId, userId);
  const item = getItemForWorkspace(itemId, workspaceId, userId);
  if (!item) {
    throw new Error("Entry is not available in this workspace.");
  }
  payEntry(itemId, paymentDate);
  getDb().prepare("UPDATE invoices SET workspace_id = ? WHERE item_id = ? AND workspace_id IS NULL").run(workspaceId, itemId);
}

export function listNotificationChannelsForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  return (getDb()
    .prepare("SELECT * FROM notification_channels WHERE workspace_id = ? ORDER BY type ASC, title ASC")
    .all(workspaceId) as DbRow[]).map(mapNotificationChannel);
}

export function listWebsiteNotificationsForWorkspace(workspaceId: number, userId: number, limit = 20) {
  requireWorkspaceViewer(workspaceId, userId);
  return (getDb()
    .prepare(
      `SELECT notifications.*
       FROM notifications
       WHERE workspace_id = ?
       ORDER BY notifications.created_at DESC
       LIMIT ?`,
    )
    .all(workspaceId, limit) as DbRow[]).map(mapWebsiteNotification);
}

export function unreadNotificationCountForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE workspace_id = ? AND read_at IS NULL")
    .get(workspaceId) as DbRow;
  return Number(row.count || 0);
}

export function unreadWebsiteNotificationsForWorkspace(workspaceId: number, userId: number, limit = 10) {
  requireWorkspaceViewer(workspaceId, userId);
  return (getDb()
    .prepare(
      `SELECT notifications.*
       FROM notifications
       WHERE workspace_id = ? AND read_at IS NULL
       ORDER BY notifications.created_at DESC
       LIMIT ?`,
    )
    .all(workspaceId, limit) as DbRow[]).map(mapWebsiteNotification);
}

export function markNotificationReadForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  getDb().prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND workspace_id = ?").run(nowIso(), id, workspaceId);
}

export function markAllNotificationsReadForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  getDb().prepare("UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND workspace_id = ?").run(nowIso(), workspaceId);
}

export function deleteNotificationForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  getDb().prepare("DELETE FROM notifications WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
}

export function deleteReadNotificationsForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  getDb().prepare("DELETE FROM notifications WHERE read_at IS NOT NULL AND workspace_id = ?").run(workspaceId);
}

export function deleteAllNotificationsForWorkspace(workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  getDb().prepare("DELETE FROM notifications WHERE workspace_id = ?").run(workspaceId);
}

export function upsertTelegramChannelForWorkspace(formData: FormData, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const id = Number(formData.get("id") || 0);
  const channelId = upsertTelegramChannel(formData);
  getDb().prepare("UPDATE notification_channels SET workspace_id = ? WHERE id = ?").run(workspaceId, channelId);
  if (id && id !== channelId) {
    getDb().prepare("UPDATE notification_channels SET workspace_id = ? WHERE id = ?").run(workspaceId, id);
  }
  return channelId;
}

export function deleteNotificationChannelForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  getDb().prepare("DELETE FROM notification_channels WHERE id = ? AND type = 'telegram' AND workspace_id = ?").run(id, workspaceId);
}

export async function sendTelegramTest(channelId: number) {
  const channel = getDb().prepare("SELECT * FROM notification_channels WHERE id = ? AND type = 'telegram'").get(channelId) as DbRow | undefined;
  if (!channel) throw new Error("Telegram channel not found.");
  const sampleMessage = [
    "🧪 <b>MC Tracker Test Notification</b>",
    "<b>Macy base</b> <i>(Servers)</i>",
    "",
    "📅 <b>Status:</b> Due in 12 days",
    "🗓 <b>Due date:</b> 13/05/2026",
    "💰 <b>Amount:</b> 85 USD",
    "👤 <b>Account:</b> amelle",
    "🏷 <b>Vendor:</b> inferno",
    '🔗 <b>URL:</b> <a href="https://example-host.com/server/macy-base">https://example-host.com/server/macy-base</a>',
  ].join("\n");
  await sendTelegramMessage(mapNotificationChannel(channel), sampleMessage);
}

async function sendTelegramMessage(channel: NotificationChannel, text: string) {
  const payload: Record<string, string | number> = {
    chat_id: channel.chatId,
    text,
    parse_mode: "HTML",
  };
  if (channel.topicId) payload.message_thread_id = Number(channel.topicId);

  const request: RequestInit & { dispatcher?: unknown } = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
  if (channel.proxyUrl) {
    const { ProxyAgent } = await import("undici");
    request.dispatcher = new ProxyAgent(channel.proxyUrl);
  }
  const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMessage`, request);
  const body = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.description || "Telegram test message failed.");
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function telegramValue(value: string | number | null | undefined, fallback = "—") {
  const normalized = String(value ?? "").trim();
  return escapeHtml(normalized || fallback);
}

function telegramVendorLink(url: string) {
  const normalized = url.trim();
  if (!normalized) return "—";
  if (/^https?:\/\//i.test(normalized)) {
    const safeUrl = escapeHtml(normalized);
    return `<a href="${safeUrl}">${safeUrl}</a>`;
  }
  return telegramValue(normalized);
}

export async function runNotificationCron() {
  const db = getDb();
  const reminderDays = [1, 3, 7, 14];
  const today = dayStart(new Date());
  const items = listItems().filter((item) => item.paymentType === "recurring" && item.billingEndAt && item.categoryId && item.workspaceId);
  let sent = 0;
  let skipped = 0;

  for (const item of items) {
    const target = currentDueDate(item);
    if (!target) continue;
    const diffDays = daysBetween(today, target);
    const isDueToday = diffDays === 0;
    const isOverdue = diffDays < 0;
    const reminderBucket = reminderDays.find((days) => diffDays > 0 && diffDays <= days);
    if ((!reminderBucket && !isDueToday && !isOverdue) || !item.categoryId || !item.workspaceId) continue;

    const channels = (db
      .prepare(
        `SELECT DISTINCT notification_channels.*
         FROM notification_channels
         LEFT JOIN category_notification_channels ON notification_channels.id = category_notification_channels.channel_id
         WHERE notification_channels.workspace_id = ?
           AND (notification_channels.type = 'website' OR category_notification_channels.category_id = ?)`,
      )
      .all(item.workspaceId, item.categoryId) as DbRow[]).map(mapNotificationChannel);

    for (const channel of channels) {
      try {
        const dueKey = target.toISOString().slice(0, 10);
        const targetKey = isOverdue ? `${dueKey}:overdue:${today.toISOString().slice(0, 10)}` : dueKey;
        db.prepare(
          "INSERT INTO notification_deliveries (item_id, category_id, channel_id, reminder_days, target_date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(item.id, item.categoryId, channel.id, isDueToday || isOverdue ? 0 : reminderBucket, targetKey, nowIso());
      } catch {
        skipped += 1;
        continue;
      }

      const title = isOverdue
        ? `Hey dude, ${item.name} is missing payment`
        : isDueToday
          ? `${item.name} payment is due today`
          : `${item.name} payment is due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
      const body = `${item.name} (${item.categoryName || "category"}) is due on ${target.toLocaleDateString("en-GB")}. Amount: ${item.amount} ${item.currency}.`;

      if (channel.type === "website") {
        db.prepare("INSERT INTO notifications (workspace_id, title, body, item_id, category_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
          item.workspaceId,
          title,
          body,
          item.id,
          item.categoryId,
          nowIso(),
        );
      } else {
        const dueLabel = isOverdue
          ? `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`
          : isDueToday
            ? "Due today"
            : `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
        const telegramMessage = [
          "🔔 <b>Payment reminder</b>",
          `<b>${telegramValue(item.name)}</b> <i>(${telegramValue(item.categoryName || "category")})</i>`,
          "",
          `📅 <b>Status:</b> ${escapeHtml(dueLabel)}`,
          `🗓 <b>Due date:</b> ${escapeHtml(target.toLocaleDateString("en-GB"))}`,
          `💰 <b>Amount:</b> ${telegramValue(item.amount)} ${telegramValue(item.currency)}`,
          `👤 <b>Account:</b> ${telegramValue(item.accountName)}`,
          `🏷 <b>Vendor:</b> ${telegramValue(item.vendorName)}`,
          `🔗 <b>URL:</b> ${telegramVendorLink(item.vendorUrl)}`,
        ].join("\n");
        await sendTelegramMessage(channel, telegramMessage);
      }
      sent += 1;
    }
  }

  return { sent, skipped };
}

export async function testExternalConnection(url: string) {
  if (!url.trim()) {
    throw new Error("Connection URL is required.");
  }

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000, max: 1 });
    try {
      await pool.query("SELECT 1");
      return "PostgreSQL connection succeeded.";
    } finally {
      await pool.end();
    }
  }

  if (url.startsWith("mysql://") || url.startsWith("mysql2://")) {
    const connection = await mysql.createConnection(url.replace(/^mysql2:\/\//, "mysql://"));
    try {
      await connection.query("SELECT 1");
      return "MySQL connection succeeded.";
    } finally {
      await connection.end();
    }
  }

  throw new Error("Use a postgresql://, postgres://, mysql://, or mysql2:// URL.");
}
