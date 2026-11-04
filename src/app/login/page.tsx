import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { BrandLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { isSetupComplete } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/app");
  const locale = await getLocale();
  const params = await searchParams;
  const hasInvalidCredentials = params.error === "invalid";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <form action={loginAction} className="w-full max-w-[380px] rounded-xl border border-white/10 bg-[#101013] p-7 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandLogo className="h-6 w-6 object-contain" />
          <h1 className="text-[15px] font-semibold text-zinc-100">{t(locale, "signIn")}</h1>
        </div>

        <div className="space-y-2.5">
          {hasInvalidCredentials ? (
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-100">
              {t(locale, "authInvalidCredentials")}
            </div>
          ) : null}
          <Input name="username" autoComplete="username" placeholder={t(locale, "username")} />
          <Input name="password" type="password" autoComplete="current-password" placeholder={t(locale, "password")} />
          <Input name="token" inputMode="numeric" placeholder={`${t(locale, "authenticatorCode")} (${locale === "ru" ? "необязательно" : "optional"})`} />
          <Button className="!mt-4 w-full">{t(locale, "signIn")}</Button>
        </div>

        <Link href="/" className="mt-5 block text-center text-xs text-zinc-500 transition hover:text-zinc-300">{t(locale, "backToEntry")}</Link>
      </form>
    </main>
  );
}
