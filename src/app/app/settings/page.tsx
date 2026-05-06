import { disableMyTotpAction, setLanguageAction, updateMyDisplayCurrencyAction } from "@/app/actions";
import { CurrencySearchSelect } from "@/components/currency-search-select";
import { TotpSetup } from "@/components/totp-setup";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const currentHref = `/app/settings?workspace=${workspace.id}`;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-sky-500/5 to-cyan-500/10 p-6">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{locale === "ru" ? "Настройки аккаунта и безопасности" : "Account and security settings"}</h1>
      </header>

      {user.totpEnabled ? (
        <form action={disableMyTotpAction} className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5">
          <h2 className="text-lg font-semibold text-white">{t(locale, "disableMy2fa")}</h2>
          <p className="mt-1 text-sm text-red-100/70">{locale === "ru" ? "Администраторы также могут сбросить 2FA в админ-панели." : "Admins can also reset user 2FA from the admin panel."}</p>
          <Button className="mt-4" variant="destructive">{t(locale, "disable2fa")}</Button>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 bg-black/20 p-5">
          <h2 className="text-lg font-semibold text-white">{locale === "ru" ? "Предпочтения" : "Preferences"}</h2>
          <p className="mt-1 text-sm text-zinc-400">{locale === "ru" ? "Язык интерфейса и валюта отображения статистики." : "Interface language and dashboard display currency."}</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <form action={setLanguageAction} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <input type="hidden" name="next" value={currentHref} />
            <label className="space-y-2 text-xs font-medium text-zinc-300">
              <span className="block">{t(locale, "language")}</span>
              <div className="grid grid-cols-2 gap-2">
                {(["en", "ru"] as const).map((option) => (
                  <button
                    key={option}
                    type="submit"
                    name="locale"
                    value={option}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                      locale === option
                        ? "border-violet-300/35 bg-violet-500/[0.18] text-violet-100"
                        : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"
                    }`}
                  >
                    {option === "en" ? t(locale, "english") : t(locale, "russian")}
                  </button>
                ))}
              </div>
            </label>
          </form>

          <form action={updateMyDisplayCurrencyAction} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="space-y-2 text-xs font-medium text-zinc-300">
              <span className="block">{locale === "ru" ? "Валюта отображения" : "Display currency"}</span>
              <CurrencySearchSelect name="displayCurrency" defaultValue={user.displayCurrency || "USD"} />
            </label>
            <div className="flex justify-end">
              <Button size="sm">{t(locale, "saveChanges")}</Button>
            </div>
          </form>
        </div>
      </section>

      <TotpSetup enabled={user.totpEnabled} locale={locale} />
    </div>
  );
}
