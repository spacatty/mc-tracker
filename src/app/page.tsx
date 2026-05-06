import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSetupComplete } from "@/lib/db";

export default async function Home() {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getCurrentUser();
  redirect(user ? "/app" : "/login");
}
