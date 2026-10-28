import { requireUser } from "@/lib/auth";
import { testExternalConnection } from "@/lib/db";
import { maskedJson } from "@/lib/security/api-response";

export async function POST(request: Request) {
  await requireUser();
  const body = (await request.json()) as { url?: string };

  try {
    const message = await testExternalConnection(body.url || "");
    return maskedJson({ ok: true, message });
  } catch (error) {
    return maskedJson(
      { ok: false, message: error instanceof Error ? error.message : "Connection failed." },
      { status: 400 },
    );
  }
}
