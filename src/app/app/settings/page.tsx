import { disableMyTotpAction, updateMyDisplayCurrencyAction } from "@/app/actions";
import { CurrencySearchSelect } from "@/components/currency-search-select";
import { TotpSetup } from "@/components/totp-setup";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const user = await requireUser();
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "settings")}
        description={locale === "ru" ? "Настройки аккаунта и безопасности" : "Account and security settings"}
      />

      {user.totpEnabled ? (
        <form action={disableMyTotpAction} className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-5">
          <h2 className="text-[15px] font-semibold text-white">{t(locale, "disableMy2fa")}</h2>
          <p className="mt-1 text-sm text-red-100/70">{locale === "ru" ? "Администраторы также могут сбросить 2FA в админ-панели." : "Admins can also reset user 2FA from the admin panel."}</p>
          <Button className="mt-4" variant="destructive">{t(locale, "disable2fa")}</Button>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-white">{locale === "ru" ? "Предпочтения" : "Preferences"}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{locale === "ru" ? "Валюта отображения статистики. Язык меняется в меню профиля." : "Dashboard display currency. Language lives in the profile menu."}</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <form action={updateMyDisplayCurrencyAction} className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
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
