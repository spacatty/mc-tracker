import { NextResponse } from "next/server";
import { runNotificationCron } from "@/lib/db";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !configuredSecret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const headerSecret = request.headers.get("x-cron-secret");

  if (headerSecret !== (configuredSecret || "dev-cron-secret")) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runNotificationCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Notification cron failed." },
      { status: 500 },
    );
  }
}
