import type { ReactNode } from "react";
import { disableMyTotpAction } from "@/app/actions";
import { PreferencesForm, SettingRow } from "@/components/settings-preferences-form";
import { TotpSetup } from "@/components/totp-setup";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth";
import { getUserDashboardPrefs } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { credentialTwoFactorEnabled, loginTwoFactorEnabled, twoFactorSetupAvailable } from "@/lib/vault/two-factor";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
      <Surface className="overflow-hidden">{children}</Surface>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const dashboardPrefs = getUserDashboardPrefs(user.id);
  const ru = locale === "ru";

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title={t(locale, "settings")} description={ru ? "Настройки вашего аккаунта" : "Your account preferences and security"} />

      <Section title={ru ? "Предпочтения" : "Preferences"} description={ru ? "Как приложение показывает ваши данные." : "How the app shows your numbers."}>
        <PreferencesForm locale={locale} displayCurrency={user.displayCurrency || "USD"} showTrend={dashboardPrefs.showTrend} />
      </Section>

      <Section title={ru ? "Безопасность" : "Security"} description={ru ? "Двухфакторная аутентификация через Google Authenticator." : "Two-factor authentication with Google Authenticator."}>
        {twoFactorSetupAvailable() ? (
          // TotpSetup brings its own card; inside this section it sits flat.
          <div className="px-5 py-4 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
            <TotpSetup enabled={user.totpEnabled} locale={locale} usedFor={{ login: loginTwoFactorEnabled(), credentials: credentialTwoFactorEnabled() }} />
          </div>
        ) : (
          <SettingRow title={ru ? "Двухфакторная аутентификация" : "Two-factor authentication"} description={ru ? "Не включена на этом сервере." : "Not turned on for this server."}>
            <p className="text-right text-[13px] text-zinc-500">—</p>
          </SettingRow>
        )}
        {user.totpEnabled ? (
          <form action={disableMyTotpAction} className="border-t border-white/[0.06]">
            <SettingRow title={t(locale, "disableMy2fa")} description={ru ? "Администраторы также могут сбросить 2FA в админ-панели." : "Admins can also reset 2FA from the admin panel."}>
              <div className="flex justify-end">
                <Button size="sm" variant="destructive">{t(locale, "disable2fa")}</Button>
              </div>
            </SettingRow>
          </form>
        ) : null}
      </Section>
    </div>
  );
}
