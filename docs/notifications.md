# Notification Center

Notification units replace category notification settings. Each user manages their own units and reusable Telegram templates.

- Choose one or more workspaces, or Global for all workspaces you can access. Select categories or individual entries. The category switch defaults to on and includes future entries; turn it off to keep a snapshot. Individual entries can be excluded.
- Reminders send one message per entry. By default, they start three days before the due date, repeat daily at 12:30 in the browser's timezone, and include the due day. Each entry's repeat interval starts at its own reminder threshold, or the unit's start date when later.
- Summaries combine entries within the configured due-date window and follow the unit's start date and interval. Empty summaries are skipped; long Telegram summaries are divided into messages. Website summaries only contain entries from the workspace where they appear.
- Repetition, hourly/daily intervals, timezone, start/end dates, and the number of days before/after a due date are configurable. With repetition off, reminders send once per entry/due date and summaries send once for the unit.
- Telegram templates support the variable buttons shown in the editor and attribute-free HTML formatting: `b`, `i`, `u`, `s`, `code`, and `pre`. Variable values are escaped. Preview with example data or an accessible entry, then optionally send the current draft through a selected bot/chat.
- Units re-check source and destination access at delivery time. Website delivery requires edit access. Failed Telegram deliveries are retried; successful destinations are tracked independently. Delivery errors appear on the unit.

The existing minute worker and `/api/cron/notifications` endpoint both run the new scheduler. The app must be running for its in-process worker to send. `NOTIFICATION_WORKER=off` disables that worker for local/test copies.

Run `npm run test:notifications` for isolated scheduler, template, permission, and delivery tests. Telegram transport is mocked; these tests never send real messages.
