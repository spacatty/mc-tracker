import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { BrandLogo, BrandWordmark } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth";
import { isSetupComplete } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { loginTwoFactorEnabled } from "@/lib/vault/two-factor";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSetupComplete()) redirect("/setup");
  const user = await getCurrentUser();
  if (user) redirect("/app");
  const locale = await getLocale();
  const params = await searchParams;
  const hasInvalidCredentials = params.error === "invalid";
  const ru = locale === "ru";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandLogo className="h-6 w-6" />
          <BrandWordmark />
        </div>
        <form action={loginAction} className="rounded-xl border border-white/[0.06] bg-surface p-6">
          <h1 className="text-[15px] font-semibold text-white">{t(locale, "signIn")}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">{ru ? "Войдите, чтобы продолжить." : "Sign in to continue."}</p>

          <div className="mt-5 grid gap-4">
            {hasInvalidCredentials ? <Alert tone="danger">{t(locale, "authInvalidCredentials")}</Alert> : null}
            <Field label={t(locale, "username")} htmlFor="login-username">
              <Input id="login-username" name="username" autoComplete="username" autoFocus />
            </Field>
            <Field label={t(locale, "password")} htmlFor="login-password">
              <Input id="login-password" name="password" type="password" autoComplete="current-password" />
            </Field>
            {loginTwoFactorEnabled() ? (
              <Field
                label={t(locale, "authenticatorCode")}
                htmlFor="login-token"
                hint={ru ? "Нужен, только если у вас включена 2FA." : "Only needed if 2FA is on for your account."}
              >
                <Input id="login-token" name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="000 000" className="font-mono tracking-[0.2em]" />
              </Field>
            ) : null}
          </div>
          <Button type="submit" className="mt-6 w-full">
            {t(locale, "signIn")}
          </Button>
        </form>

        <Link href="/" className="mt-5 block text-center text-xs text-zinc-500 transition hover:text-zinc-300">
          {t(locale, "backToEntry")}
        </Link>
      </div>
    </main>
  );
}
