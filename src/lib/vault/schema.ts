import type Database from "better-sqlite3";

/*
 * Vendors and accounts are the single source of truth for the vendor, vendor URL and account on an entry.
 * items.vendor_id / items.account_id hold the link; items.vendor_name / vendor_url / account_name stay as a
 * cache (export, search, notifications) that SQLite triggers keep equal to the linked records:
 *
 * - Writing a vendor or account name on an entry links it to the record with that name, creating it if needed.
 * - Changing an entry's vendor URL changes the vendor's URL (and so every entry of that vendor).
 * - Renaming a vendor or account, or changing a vendor's URL, rewrites the cache on every linked entry.
 * - Deleting a vendor or account unlinks its entries; they keep the text.
 *
 * Doing this in triggers means every write path (forms, batch save, Quick Capture, import, transfer) is covered
 * without each one having to remember it.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const V = "trim(COALESCE(NEW.vendor_name, ''))";
const A = "trim(COALESCE(NEW.account_name, ''))";
const U = `(CASE
  WHEN trim(COALESCE(NEW.vendor_url, '')) = '' THEN ''
  WHEN lower(trim(NEW.vendor_url)) LIKE 'http://%' OR lower(trim(NEW.vendor_url)) LIKE 'https://%' THEN trim(NEW.vendor_url)
  ELSE 'https://' || trim(NEW.vendor_url) END)`;
const VID = "(SELECT vendor_id FROM items WHERE id = NEW.id)";
const ACCOUNT_MATCH = `a.workspace_id = NEW.workspace_id AND a.name = ${A} COLLATE NOCASE
  AND (a.vendor_id IS ${VID} OR a.vendor_id IS NULL OR ${VID} IS NULL)`;

/**
 * The body shared by the insert and update triggers on items.
 * vendorChanged / accountChanged gate re-linking, so saving an entry with unchanged text never recreates a
 * vendor or account that was deleted on purpose. pushUrl decides when the entry's URL is written to the vendor.
 */
function linkBody(vendorChanged: string, accountChanged: string, pushUrl: string) {
  return `
    INSERT INTO vendors (workspace_id, name, url, notes, created_at, updated_at)
      SELECT NEW.workspace_id, ${V}, ${U}, '', ${NOW}, ${NOW}
      WHERE ${vendorChanged} AND ${V} <> ''
        AND NOT EXISTS (SELECT 1 FROM vendors WHERE workspace_id = NEW.workspace_id AND name = ${V} COLLATE NOCASE);
    UPDATE items SET vendor_id = CASE WHEN ${V} = '' THEN NULL
        ELSE (SELECT id FROM vendors WHERE workspace_id = NEW.workspace_id AND name = ${V} COLLATE NOCASE) END
      WHERE id = NEW.id AND ${vendorChanged};
    UPDATE vendors SET url = ${U}, updated_at = ${NOW}
      WHERE id = ${VID} AND ${U} <> '' AND url IS NOT ${U} AND ${pushUrl};
    UPDATE items SET
        vendor_name = (SELECT name FROM vendors WHERE vendors.id = items.vendor_id),
        vendor_url = (SELECT url FROM vendors WHERE vendors.id = items.vendor_id)
      WHERE id = NEW.id AND vendor_id IS NOT NULL;

    INSERT INTO vault_accounts (workspace_id, vendor_id, name, login_url, created_at, updated_at)
      SELECT NEW.workspace_id, ${VID}, ${A}, '', ${NOW}, ${NOW}
      WHERE ${accountChanged} AND ${A} <> '' AND NOT EXISTS (SELECT 1 FROM vault_accounts a WHERE ${ACCOUNT_MATCH});
    UPDATE items SET account_id = CASE WHEN ${A} = '' THEN NULL
        ELSE (SELECT a.id FROM vault_accounts a WHERE ${ACCOUNT_MATCH}
              ORDER BY (a.vendor_id IS ${VID}) DESC, (a.vendor_id IS NULL) DESC, a.id LIMIT 1) END
      WHERE id = NEW.id AND ${accountChanged};
    UPDATE items SET account_name = (SELECT name FROM vault_accounts WHERE vault_accounts.id = items.account_id)
      WHERE id = NEW.id AND account_id IS NOT NULL;
  `;
}

const VENDOR_CHANGED = "(NEW.vendor_name IS NOT OLD.vendor_name OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.vendor_url IS NOT OLD.vendor_url)";
const ACCOUNT_CHANGED = `(NEW.account_name IS NOT OLD.account_name OR ${VENDOR_CHANGED})`;

function columnExists(database: Database.Database, table: string, column: string) {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((row) => row.name === column);
}

export function ensureVaultSchema(database: Database.Database) {
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

  const backfill = !columnExists(database, "items", "vendor_id");
  if (backfill) {
    database.prepare("ALTER TABLE items ADD COLUMN vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL").run();
  }
  if (!columnExists(database, "items", "account_id")) {
    database.prepare("ALTER TABLE items ADD COLUMN account_id INTEGER REFERENCES vault_accounts(id) ON DELETE SET NULL").run();
  }

  // Recreated on every start so changes to the rules above take effect.
  database.exec(`
    CREATE INDEX IF NOT EXISTS items_vendor_id ON items(vendor_id);
    CREATE INDEX IF NOT EXISTS items_account_id ON items(account_id);

    DROP TRIGGER IF EXISTS items_vault_link_insert;
    CREATE TRIGGER items_vault_link_insert AFTER INSERT ON items WHEN NEW.workspace_id IS NOT NULL BEGIN
      ${linkBody("1", "1", "(SELECT url FROM vendors WHERE id = " + VID + ") = ''")}
    END;

    DROP TRIGGER IF EXISTS items_vault_link_update;
    CREATE TRIGGER items_vault_link_update AFTER UPDATE OF vendor_name, vendor_url, account_name, workspace_id ON items
      WHEN NEW.workspace_id IS NOT NULL AND (${ACCOUNT_CHANGED}) BEGIN
      ${linkBody(VENDOR_CHANGED, ACCOUNT_CHANGED, "(NEW.vendor_url IS NOT OLD.vendor_url OR url = '')")}
    END;

    DROP TRIGGER IF EXISTS vendors_sync_items;
    CREATE TRIGGER vendors_sync_items AFTER UPDATE OF name, url ON vendors
      WHEN NEW.name IS NOT OLD.name OR NEW.url IS NOT OLD.url BEGIN
      UPDATE items SET vendor_name = NEW.name, vendor_url = NEW.url WHERE vendor_id = NEW.id;
    END;

    DROP TRIGGER IF EXISTS vault_accounts_sync_items;
    CREATE TRIGGER vault_accounts_sync_items AFTER UPDATE OF name ON vault_accounts
      WHEN NEW.name IS NOT OLD.name BEGIN
      UPDATE items SET account_name = NEW.name WHERE account_id = NEW.id;
    END;
  `);

  if (backfill) linkExistingEntries(database);
}

/**
 * One-off link of entries written before the link columns existed. Each entry's names are cleared and
 * written back so the update trigger links them; the most recently updated entry's URL wins for a new vendor.
 */
function linkExistingEntries(database: Database.Database) {
  const rows = database
    .prepare(
      `SELECT id, vendor_name, account_name FROM items
       WHERE workspace_id IS NOT NULL AND (COALESCE(vendor_name, '') <> '' OR COALESCE(account_name, '') <> '')
       ORDER BY updated_at DESC, id DESC`,
    )
    .all() as { id: number; vendor_name: string | null; account_name: string | null }[];
  const clear = database.prepare("UPDATE items SET vendor_name = NULL, account_name = NULL WHERE id = ?");
  const restore = database.prepare("UPDATE items SET vendor_name = ?, account_name = ? WHERE id = ?");
  database.transaction(() => {
    for (const row of rows) {
      clear.run(row.id);
      restore.run(row.vendor_name, row.account_name, row.id);
    }
  })();
}
