import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { AppIcon } from "@/components/icons";
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
    <main className="relative min-h-screen overflow-hidden bg-[#07070b] px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.22),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.08),transparent_32%),radial-gradient(circle_at_52%_92%,rgba(244,63,94,0.08),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="auth-drift pointer-events-none absolute left-[12%] top-[18%] h-40 w-40 rotate-12 rounded-[2rem] border border-violet-400/15 bg-violet-500/[0.04] blur-[1px]" />
      <div className="auth-drift-slow pointer-events-none absolute bottom-[13%] right-[13%] h-48 w-48 -rotate-12 rounded-[2rem] border border-white/10 bg-white/[0.025]" />

      <div className="relative grid min-h-[calc(100vh-5rem)] place-items-center">
        <form action={loginAction} className="relative w-full max-w-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d13]/90 p-7 shadow-[0_30px_90px_-50px_rgba(76,29,149,0.95)] backdrop-blur-xl sm:p-8">
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_55%)]" />
            <span className="auth-scan pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-violet-300/[0.06] to-transparent" />
            <div className="relative mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-violet-500/10 text-violet-200 shadow-lg shadow-violet-950/20">
                  <AppIcon name="WalletCards" className="h-6 w-6" />
                </div>
                <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{t(locale, "signIn")}</h1>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-violet-400/25 to-transparent" />
            </div>

            <div className="relative space-y-3.5">
              {hasInvalidCredentials ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {t(locale, "authInvalidCredentials")}
                </div>
              ) : null}
              <div className="grid grid-cols-[4px_1fr] overflow-hidden rounded-2xl border border-white/10 bg-black/25 transition focus-within:border-violet-300/35 focus-within:bg-violet-500/[0.08]">
                <span className="bg-violet-400/70 shadow-[0_0_18px_rgba(167,139,250,0.45)]" />
                <Input className="h-12 rounded-none border-0 bg-transparent px-4 ring-offset-transparent placeholder:text-zinc-600 focus:ring-0 focus-visible:ring-0" name="username" autoComplete="username" placeholder={t(locale, "username")} />
              </div>
              <div className="grid grid-cols-[4px_1fr] overflow-hidden rounded-2xl border border-white/10 bg-black/25 transition focus-within:border-violet-300/35 focus-within:bg-violet-500/[0.08]">
                <span className="bg-sky-400/60 shadow-[0_0_18px_rgba(56,189,248,0.35)]" />
                <Input className="h-12 rounded-none border-0 bg-transparent px-4 ring-offset-transparent placeholder:text-zinc-600 focus:ring-0 focus-visible:ring-0" name="password" type="password" autoComplete="current-password" placeholder={t(locale, "password")} />
              </div>
              <div className="grid grid-cols-[4px_1fr] overflow-hidden rounded-2xl border border-white/10 bg-black/25 transition focus-within:border-violet-300/35 focus-within:bg-violet-500/[0.08]">
                <span className="bg-red-400/50 shadow-[0_0_18px_rgba(248,113,113,0.3)]" />
                <Input className="h-12 rounded-none border-0 bg-transparent px-4 ring-offset-transparent placeholder:text-zinc-600 focus:ring-0 focus-visible:ring-0" name="token" inputMode="numeric" placeholder={`${t(locale, "authenticatorCode")} (${locale === "ru" ? "необязательно" : "optional"})`} />
              </div>
              <Button className="mt-3 w-full border border-violet-400/20 bg-violet-500/[0.14] text-violet-100 shadow-lg shadow-violet-950/20 hover:border-violet-300/35 hover:bg-violet-500/[0.24] hover:text-white" size="lg">{t(locale, "signIn")}</Button>
            </div>

            <Link href="/" className="relative mt-6 block text-center text-sm text-zinc-500 transition hover:text-zinc-300">{t(locale, "backToEntry")}</Link>
          </form>
      </div>
    </main>
  );
}
