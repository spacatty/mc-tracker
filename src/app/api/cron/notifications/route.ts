import { runNotificationCron } from "@/lib/db";
import { maskedJson } from "@/lib/security/api-response";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !configuredSecret) {
    return maskedJson({ ok: false, message: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const headerSecret = request.headers.get("x-cron-secret");

  if (headerSecret !== (configuredSecret || "dev-cron-secret")) {
    return maskedJson({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runNotificationCron();
    return maskedJson({ ok: true, ...result });
  } catch (error) {
    return maskedJson(
      { ok: false, message: error instanceof Error ? error.message : "Notification cron failed." },
      { status: 500 },
    );
  }
}
