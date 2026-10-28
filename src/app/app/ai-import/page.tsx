import { redirect } from "next/navigation";

export default async function AiImportPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const params = await searchParams;
  redirect(`/app/import${params.workspace ? `?workspace=${encodeURIComponent(params.workspace)}` : ""}`);
}
