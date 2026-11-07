/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks isolate the server-only TypeScript loader for these tests. */
const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Module = require("node:module");
const ts = require("typescript");

// Load server TypeScript without a Next runtime; all storage is isolated in a temporary DB.
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === "server-only") return {};
  return originalLoad.call(this, name.startsWith("@/") ? path.join(__dirname, "../src", name.slice(2)) : name, parent, main);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "mc-notifications-"));
process.env.SQLITE_PATH = path.join(folder, "test.sqlite");
process.env.NOTIFICATION_WORKER = "off";
const config = require("../src/lib/notification-config.ts");
const dbApi = require("../src/lib/db.ts");
const center = require("../src/lib/notification-center.ts");
after(() => { globalThis.mcTrackerDb?.close(); fs.rmSync(folder, { recursive: true, force: true }); });

test("daily defaults, timezone boundaries, start/end dates and multi-day intervals", () => {
  const unit = { ...config.newNotificationUnit("Europe/Moscow"), startDate: "2026-11-07" };
  assert.equal(config.scheduleSlot(unit, new Date("2026-11-07T09:29Z")), null);
  assert.equal(config.scheduleSlot(unit, new Date("2026-11-07T09:30Z")), "2026-11-07");
  assert.equal(config.scheduleSlot({ ...unit, interval: 2 }, new Date("2026-11-08T10:00Z")), null);
  assert.equal(config.scheduleSlot({ ...unit, interval: 2 }, new Date("2026-11-09T10:00Z")), "2026-11-09");
  assert.equal(config.scheduleSlot({ ...unit, endDate: "2026-11-07" }, new Date("2026-11-08T10:00Z")), null);
  assert.equal(config.scheduleSlot({ ...unit, repeat: false, interval: 2 }, new Date("2026-11-08T10:00Z")), "2026-11-08");
});

test("hourly intervals continue across midnight, including intervals longer than a day", () => {
  const unit = { ...config.newNotificationUnit("UTC"), startDate: "2026-11-07", time: "23:30", intervalUnit: "hours", interval: 2 };
  const first = config.scheduleSlot(unit, new Date("2026-11-07T23:30Z"));
  assert.equal(config.scheduleSlot(unit, new Date("2026-11-08T00:30Z")), first);
  assert.notEqual(config.scheduleSlot(unit, new Date("2026-11-08T01:30Z")), first);
  const long = { ...unit, interval: 48 };
  assert.equal(config.scheduleSlot(long, new Date("2026-11-08T23:30Z")), config.scheduleSlot(long, new Date("2026-11-07T23:30Z")));
  assert.notEqual(config.scheduleSlot(long, new Date("2026-11-09T23:30Z")), first);
});

test("calendar intervals remain stable across daylight saving", () => {
  const unit = { ...config.newNotificationUnit("America/New_York"), startDate: "2026-10-31" };
  assert.equal(config.scheduleSlot(unit, new Date("2026-11-01T17:29Z")), null);
  assert.equal(config.scheduleSlot(unit, new Date("2026-11-01T17:30Z")), "2026-11-01");
  assert.equal(config.dueDays({ billingEndAt: "2026-11-02T00:00:00Z" }, "2026-11-01"), 1);
});

test("entry repetition starts at its own before-X-days threshold", () => {
  const unit = { ...config.newNotificationUnit("UTC"), startDate: "2026-11-01", interval: 2 };
  const entry = { billingEndAt: "2026-11-11T00:00:00Z" };
  assert.equal(config.entryScheduleSlot(unit, entry, new Date("2026-11-08T12:30Z")), "2026-11-08");
  assert.equal(config.entryScheduleSlot(unit, entry, new Date("2026-11-09T12:30Z")), null);
  assert.equal(config.entryScheduleSlot(unit, entry, new Date("2026-11-10T12:30Z")), "2026-11-10");
});

test("dynamic category selection, snapshots, exclusions, and workspace boundaries", () => {
  const entries = [{ id: 1, workspaceId: 1, categoryId: 4 }, { id: 2, workspaceId: 1, categoryId: 4 }, { id: 3, workspaceId: 2, categoryId: 5 }];
  const unit = { ...config.newNotificationUnit(), workspaceIds: [1], categoryIds: [4], excludedIds: [2] };
  assert.deepEqual(config.selectedEntries(unit, entries).map((entry) => entry.id), [1]);
  assert.deepEqual(config.selectedEntries({ ...unit, autoInclude: false, entryIds: [2, 3], excludedIds: [] }, entries).map((entry) => entry.id), [2]);
  assert.deepEqual(config.selectedEntries({ ...unit, scope: "global", entryIds: [3] }, entries).map((entry) => entry.id), [1, 3]);
});

test("template formatting is validated and entry content cannot inject HTML", () => {
  config.validateTemplate(config.DEFAULT_TEMPLATE);
  assert.throws(() => config.validateTemplate("{{entry.password}}"));
  assert.throws(() => config.validateTemplate('<a href="https://evil">link</a>'));
  assert.throws(() => config.validateTemplate("<b>unclosed"));
  const message = config.renderMessage("<b>{{entry.name}}</b>", { "entry.name": '<img src=x onerror="alert(1)">' });
  assert.equal(message, "<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>");
  assert.ok(!config.messagePreviewHtml(message).includes("<img"));
  assert.equal(config.composeUnitMessage("summary", null, { "unit.name": "Daily", "summary.count": 2, "summary.entries": "A\nB" }), "<b>Daily</b> · 2\nA\nB");
  assert.equal(config.composeUnitMessage("summary", "Custom header", { "summary.entries": "A\nB" }), "Custom header\n\nA\nB");
});

test("end-to-end delivery: dedup, retries, ownership, snapshots, revocation, and summary privacy", async () => {
  const db = dbApi.getDb();
  db.prepare("DELETE FROM categories").run();
  const stamp = "2026-11-07T00:00:00Z";
  for (const id of [1, 2]) db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, 'test', 'superadmin', ?)").run(id, `test-${id}`, stamp);
  for (const id of [1, 2]) {
    db.prepare("INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run(id, `Workspace ${id}`, stamp, stamp);
    db.prepare("INSERT INTO workspace_members VALUES (?, 1, 'owner', ?)").run(id, stamp);
    db.prepare("INSERT INTO categories (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, 'Servers', ?, ?)").run(id, id, stamp, stamp);
    db.prepare("INSERT INTO items (id, workspace_id, name, category_id, payment_type, amount, currency, billing_end_at, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'single', 24, 'USD', '2026-11-10T00:00:00Z', 1, ?, ?)").run(id, id, `Private entry ${id}`, id, stamp, stamp);
  }
  const base = { ...config.newNotificationUnit("UTC"), name: "Reminder", workspaceIds: [1], categoryIds: [1], startDate: "2026-11-07" };
  const unitId = center.saveNotificationUnit(1, base);
  assert.deepEqual(await center.runNotificationCenter(new Date("2026-11-07T12:29Z")), { sent: 0, skipped: 0 });
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:30Z"))).sent, 1);
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:31Z"))).sent, 0);
  assert.equal((await center.runNotificationCenter(new Date("2026-11-08T12:30Z"))).sent, 1);
  assert.throws(() => center.saveNotificationUnit(2, { ...base, id: unitId }), /not found/);
  assert.throws(() => center.saveNotificationUnit(2, base), /access denied/);
  center.deleteNotificationUnit(2, unitId);
  assert.equal(center.listNotificationUnits(1).length, 1);
  center.deleteNotificationUnit(1, unitId);

  const summary = center.saveNotificationUnit(1, { ...base, name: "Summary", scope: "global", categoryIds: [1, 2], mode: "summary" });
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:30Z"))).sent, 2);
  const summaries = db.prepare("SELECT workspace_id, body FROM notifications WHERE title = 'Summary'").all();
  assert.equal(summaries.length, 2);
  for (const row of summaries) {
    assert.ok(row.body.includes(`Private entry ${row.workspace_id}`));
    assert.ok(!row.body.includes(`Private entry ${row.workspace_id === 1 ? 2 : 1}`));
  }
  center.deleteNotificationUnit(1, summary);

  const snapshot = center.saveNotificationUnit(1, { ...base, name: "Snapshot", autoInclude: false, entryIds: [1], repeat: false });
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:30Z"))).sent, 1);
  assert.equal((await center.runNotificationCenter(new Date("2026-11-08T12:30Z"))).sent, 0);
  center.deleteNotificationUnit(1, snapshot);

  db.prepare("INSERT INTO notification_channels (id, workspace_id, type, title, bot_token, chat_id, created_at) VALUES (100, 1, 'telegram', 'Fake', 'never-send', '123', ?)").run(stamp);
  let attempts = 0;
  dbApi.sendTelegramMessage = async () => { if (++attempts === 1) throw new Error("Temporary Telegram failure"); };
  const retry = center.saveNotificationUnit(1, { ...base, website: false, channelIds: [100] });
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:30Z"))).sent, 0);
  assert.equal(center.listNotificationUnits(1)[0].lastError, "Temporary Telegram failure");
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:31Z"))).sent, 1);
  assert.equal(center.listNotificationUnits(1)[0].lastError, null);
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:32Z"))).sent, 0);
  assert.equal(attempts, 2);
  center.deleteNotificationUnit(1, retry);

  db.prepare("INSERT INTO notification_channels (id, workspace_id, type, title, bot_token, chat_id, created_at) VALUES (101, 1, 'telegram', 'Working', 'never-send', '123', ?)").run(stamp);
  const destinations = [];
  dbApi.sendTelegramMessage = async (channel) => { destinations.push(channel.id); if (channel.id === 100) throw new Error("Destination unavailable"); };
  const multi = center.saveNotificationUnit(1, { ...base, website: true, channelIds: [100, 101] });
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:30Z"))).sent, 2);
  assert.deepEqual(destinations, [100, 101]);
  assert.equal(center.listNotificationUnits(1)[0].lastError, "Destination unavailable");
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:31Z"))).sent, 0);
  assert.deepEqual(destinations, [100, 101, 100]);
  center.deleteNotificationUnit(1, multi);

  center.saveNotificationUnit(1, base);
  db.prepare("DELETE FROM workspace_members WHERE workspace_id = 1 AND user_id = 1").run();
  assert.equal((await center.runNotificationCenter(new Date("2026-11-07T12:30Z"))).sent, 0);
});
