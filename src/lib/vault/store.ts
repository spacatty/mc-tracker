import "server-only";

import type Database from "better-sqlite3";
import { getDb, getItemForWorkspace, listItemsForWorkspace, requireWorkspaceEditor, requireWorkspaceViewer } from "@/lib/db";
import { nowIso } from "@/lib/utils";
import { openSecret, sealSecret } from "./crypto";
import type { AccountCredentials, VaultAccount, Vendor } from "./types";

type Row = Record<string, unknown>;

const globalForVault = globalThis as typeof globalThis & { mcTrackerVaultReady?: Database.Database };

/** Vendors and accounts live in their own tables, created on first use. */
function db() {
  const database = getDb();
  if (globalForVault.mcTrackerVaultReady !== database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS vendors_workspace_name ON vendors(workspace_id, name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS vault_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        login_url TEXT NOT NULL DEFAULT '',
        -- login, password and notes, sealed together with AES-256-GCM (see vault/crypto.ts)
        credentials_enc TEXT,
        has_login INTEGER NOT NULL DEFAULT 0,
        has_password INTEGER NOT NULL DEFAULT 0,
        has_notes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS vault_accounts_workspace ON vault_accounts(workspace_id);
    `);
    globalForVault.mcTrackerVaultReady = database;
  }
  return database;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function normalizeUrl(value: string) {
  const text = value.trim();
  if (!text) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid URL, like https://example.com/login.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only http and https links are allowed.");
  return parsed.toString();
}

function mapVendor(row: Row, entryCount: number): Vendor {
  return {
    id: Number(row.id),
    workspaceId: Number(row.workspace_id),
    name: String(row.name || ""),
    url: String(row.url || ""),
    notes: String(row.notes || ""),
    accountCount: Number(row.account_count || 0),
    entryCount,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAccount(row: Row, entryCount: number): VaultAccount {
  return {
    id: Number(row.id),
    workspaceId: Number(row.workspace_id),
    vendorId: row.vendor_id == null ? null : Number(row.vendor_id),
    vendorName: String(row.vendor_name || ""),
    vendorUrl: String(row.vendor_url || ""),
    name: String(row.name || ""),
    loginUrl: String(row.login_url || ""),
    hasLogin: Boolean(row.has_login),
    hasPassword: Boolean(row.has_password),
    hasNotes: Boolean(row.has_notes),
    entryCount,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const accountSelect = `SELECT vault_accounts.*, vendors.name AS vendor_name, vendors.url AS vendor_url
  FROM vault_accounts LEFT JOIN vendors ON vendors.id = vault_accounts.vendor_id`;

type EntryRef = { vendorName: string; accountName: string };

function entryRefs(workspaceId: number, userId: number): EntryRef[] {
  return listItemsForWorkspace(workspaceId, userId).map((item) => ({ vendorName: item.vendorName || "", accountName: item.accountName || "" }));
}

function accountMatchesEntry(account: { name: string; vendorName: string }, entry: EntryRef) {
  if (!entry.accountName || !same(account.name, entry.accountName)) return false;
  return !account.vendorName || !entry.vendorName || same(account.vendorName, entry.vendorName);
}

/* ------------------------------- Vendors ------------------------------- */

export function listVendorsForWorkspace(workspaceId: number, userId: number): Vendor[] {
  requireWorkspaceViewer(workspaceId, userId);
  const entries = entryRefs(workspaceId, userId);
  const rows = db()
    .prepare(
      `SELECT vendors.*, (SELECT COUNT(*) FROM vault_accounts WHERE vault_accounts.vendor_id = vendors.id) AS account_count
       FROM vendors WHERE workspace_id = ? ORDER BY name COLLATE NOCASE`,
    )
    .all(workspaceId) as Row[];
  return rows.map((row) => mapVendor(row, entries.filter((entry) => entry.vendorName && same(entry.vendorName, String(row.name))).length));
}

export function saveVendorForWorkspace(
  input: { id?: number | null; name: string; url: string; notes: string },
  workspaceId: number,
  userId: number,
) {
  requireWorkspaceEditor(workspaceId, userId);
  const name = input.name.trim();
  if (!name) throw new Error("Vendor name is required.");
  const url = normalizeUrl(input.url);
  const notes = input.notes.trim();
  const database = db();
  const clash = database
    .prepare("SELECT id FROM vendors WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND id <> ?")
    .get(workspaceId, name, input.id || 0) as Row | undefined;
  if (clash) throw new Error(`A vendor named “${name}” already exists.`);
  const now = nowIso();
  if (input.id) {
    const result = database
      .prepare("UPDATE vendors SET name = ?, url = ?, notes = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
      .run(name, url, notes, now, input.id, workspaceId);
    if (!result.changes) throw new Error("Vendor not found.");
    return input.id;
  }
  return Number(
    database
      .prepare("INSERT INTO vendors (workspace_id, name, url, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(workspaceId, name, url, notes, now, now).lastInsertRowid,
  );
}

export function deleteVendorForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  db().prepare("DELETE FROM vendors WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
}

function findVendorByName(workspaceId: number, name: string) {
  if (!name.trim()) return undefined;
  return db().prepare("SELECT * FROM vendors WHERE workspace_id = ? AND name = ? COLLATE NOCASE").get(workspaceId, name.trim()) as Row | undefined;
}

/* ------------------------------- Accounts ------------------------------ */

export function listAccountsForWorkspace(workspaceId: number, userId: number): VaultAccount[] {
  requireWorkspaceViewer(workspaceId, userId);
  const entries = entryRefs(workspaceId, userId);
  const rows = db()
    .prepare(`${accountSelect} WHERE vault_accounts.workspace_id = ? ORDER BY vendors.name COLLATE NOCASE, vault_accounts.name COLLATE NOCASE`)
    .all(workspaceId) as Row[];
  return rows.map((row) => {
    const ref = { name: String(row.name || ""), vendorName: String(row.vendor_name || "") };
    return mapAccount(row, entries.filter((entry) => accountMatchesEntry(ref, entry)).length);
  });
}

function getAccountRow(id: number, workspaceId: number) {
  return db().prepare(`${accountSelect} WHERE vault_accounts.id = ? AND vault_accounts.workspace_id = ?`).get(id, workspaceId) as Row | undefined;
}

export function getAccountForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceViewer(workspaceId, userId);
  const row = getAccountRow(id, workspaceId);
  return row ? mapAccount(row, 0) : null;
}

export type AccountInput = {
  id?: number | null;
  vendorId: number | null;
  name: string;
  loginUrl: string;
  /** Undefined keeps the stored value; a string (even empty) replaces it. */
  login?: string;
  password?: string;
  notes?: string;
};

export function saveAccountForWorkspace(input: AccountInput, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const name = input.name.trim();
  if (!name) throw new Error("Account name is required.");
  const loginUrl = normalizeUrl(input.loginUrl);
  const database = db();
  if (input.vendorId) {
    const vendor = database.prepare("SELECT id FROM vendors WHERE id = ? AND workspace_id = ?").get(input.vendorId, workspaceId);
    if (!vendor) throw new Error("Vendor not found.");
  }
  const clash = database
    .prepare("SELECT id FROM vault_accounts WHERE workspace_id = ? AND IFNULL(vendor_id, 0) = ? AND name = ? COLLATE NOCASE AND id <> ?")
    .get(workspaceId, input.vendorId || 0, name, input.id || 0);
  if (clash) throw new Error(`An account named “${name}” already exists for this vendor.`);

  const existing = input.id ? getAccountRow(input.id, workspaceId) : undefined;
  if (input.id && !existing) throw new Error("Account not found.");
  const previous: AccountCredentials = existing?.credentials_enc
    ? (JSON.parse(openSecret(String(existing.credentials_enc))) as AccountCredentials)
    : { login: "", password: "", notes: "" };
  const next: AccountCredentials = {
    login: input.login === undefined ? previous.login : input.login.trim(),
    password: input.password === undefined ? previous.password : input.password,
    notes: input.notes === undefined ? previous.notes : input.notes.trim(),
  };
  const hasAny = Boolean(next.login || next.password || next.notes);
  const sealed = hasAny ? sealSecret(JSON.stringify(next)) : null;
  const now = nowIso();
  const flags = [next.login ? 1 : 0, next.password ? 1 : 0, next.notes ? 1 : 0];

  if (existing) {
    database
      .prepare(
        `UPDATE vault_accounts SET vendor_id = ?, name = ?, login_url = ?, credentials_enc = ?, has_login = ?, has_password = ?, has_notes = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .run(input.vendorId, name, loginUrl, sealed, ...flags, now, input.id, workspaceId);
    return Number(input.id);
  }
  return Number(
    database
      .prepare(
        `INSERT INTO vault_accounts (workspace_id, vendor_id, name, login_url, credentials_enc, has_login, has_password, has_notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(workspaceId, input.vendorId, name, loginUrl, sealed, ...flags, now, now).lastInsertRowid,
  );
}

export function deleteAccountForWorkspace(id: number, workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  db().prepare("DELETE FROM vault_accounts WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
}

/** Decrypts one account's credentials. Callers check permissions and the 2FA gate first. */
export function readAccountCredentials(id: number, workspaceId: number): AccountCredentials | null {
  const row = getAccountRow(id, workspaceId);
  if (!row) return null;
  if (!row.credentials_enc) return { login: "", password: "", notes: "" };
  const parsed = JSON.parse(openSecret(String(row.credentials_enc))) as Partial<AccountCredentials>;
  return { login: parsed.login || "", password: parsed.password || "", notes: parsed.notes || "" };
}

/* ------------------------------ Entry links ---------------------------- */

/** Finds the vendor and account an entry points at, by the names typed on the entry. */
export function resolveEntryLogin(itemId: number, workspaceId: number, userId: number) {
  const item = getItemForWorkspace(itemId, workspaceId, userId);
  if (!item) return null;
  const vendorRow = findVendorByName(workspaceId, item.vendorName || "");
  let accountRow: Row | undefined;
  if (item.accountName?.trim()) {
    const candidates = db()
      .prepare(`${accountSelect} WHERE vault_accounts.workspace_id = ? AND vault_accounts.name = ? COLLATE NOCASE`)
      .all(workspaceId, item.accountName.trim()) as Row[];
    accountRow =
      (vendorRow && candidates.find((row) => Number(row.vendor_id) === Number(vendorRow.id))) ||
      candidates.find((row) => row.vendor_id == null) ||
      (!vendorRow && candidates.length === 1 ? candidates[0] : undefined);
  }
  const account = accountRow ? mapAccount(accountRow, 0) : null;
  const url = account?.loginUrl || account?.vendorUrl || String(vendorRow?.url || "") || item.vendorUrl || "";
  return { item, vendorId: vendorRow ? Number(vendorRow.id) : null, account, url };
}

/** Fills in the account name on an entry that had none, so the entry finds its new account next time. */
export function linkEntryToAccount(itemId: number, workspaceId: number, userId: number, accountName: string) {
  requireWorkspaceEditor(workspaceId, userId);
  db()
    .prepare("UPDATE items SET account_name = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND COALESCE(account_name, '') = ''")
    .run(accountName.trim(), nowIso(), itemId, workspaceId);
}

/** Creates vendors and empty accounts for every vendor and account name already used on entries. */
export function importVendorsFromEntries(workspaceId: number, userId: number) {
  requireWorkspaceEditor(workspaceId, userId);
  const items = listItemsForWorkspace(workspaceId, userId);
  const database = db();
  let vendors = 0;
  let accounts = 0;
  const now = nowIso();
  database.transaction(() => {
    for (const item of items) {
      const vendorName = (item.vendorName || "").trim();
      let vendorId: number | null = null;
      if (vendorName) {
        const found = findVendorByName(workspaceId, vendorName);
        if (found) {
          vendorId = Number(found.id);
          if (!found.url && item.vendorUrl) {
            try {
              database.prepare("UPDATE vendors SET url = ?, updated_at = ? WHERE id = ?").run(normalizeUrl(item.vendorUrl), now, vendorId);
            } catch {
              /* keep the vendor without a URL when the entry's URL is malformed */
            }
          }
        } else {
          let url = "";
          try {
            url = normalizeUrl(item.vendorUrl || "");
          } catch {
            url = "";
          }
          vendorId = Number(
            database
              .prepare("INSERT INTO vendors (workspace_id, name, url, notes, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)")
              .run(workspaceId, vendorName, url, now, now).lastInsertRowid,
          );
          vendors += 1;
        }
      }
      const accountName = (item.accountName || "").trim();
      if (accountName) {
        const exists = database
          .prepare("SELECT id FROM vault_accounts WHERE workspace_id = ? AND IFNULL(vendor_id, 0) = ? AND name = ? COLLATE NOCASE")
          .get(workspaceId, vendorId || 0, accountName);
        if (!exists) {
          database
            .prepare("INSERT INTO vault_accounts (workspace_id, vendor_id, name, login_url, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)")
            .run(workspaceId, vendorId, accountName, now, now);
          accounts += 1;
        }
      }
    }
  })();
  return { vendors, accounts };
}
