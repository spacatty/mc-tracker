import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { testExternalConnection } from "@/lib/db";

export async function POST(request: Request) {
  await requireUser();
  const body = (await request.json()) as { url?: string };

  try {
    const message = await testExternalConnection(body.url || "");
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Connection failed." },
      { status: 400 },
    );
  }
}
