import "server-only";

import { runNotificationCron } from "./db";

declare global {
  var mcTrackerNotificationWorker: NodeJS.Timeout | undefined;
  var mcTrackerNotificationWorkerRunning: boolean | undefined;
}

export function startNotificationWorker() {
  if (globalThis.mcTrackerNotificationWorker) return;
  // NOTIFICATION_WORKER=off keeps a test copy of the database from sending real reminders.
  if (process.env.NOTIFICATION_WORKER?.trim().toLowerCase() === "off") return;

  async function tick() {
    if (globalThis.mcTrackerNotificationWorkerRunning) return;
    globalThis.mcTrackerNotificationWorkerRunning = true;
    try {
      await runNotificationCron();
    } catch (error) {
      console.error("Notification worker failed", error);
    } finally {
      globalThis.mcTrackerNotificationWorkerRunning = false;
    }
  }

  void tick();
  globalThis.mcTrackerNotificationWorker = setInterval(() => {
    void tick();
  }, 60_000);
}
