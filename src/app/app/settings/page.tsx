import { disableMyTotpAction } from "@/app/actions";
import { PreferencesForm } from "@/components/settings-preferences-form";
import { TotpSetup } from "@/components/totp-setup";
import { Button } from "@/components/ui/button";
import { FieldRow } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { requireUser } from "@/lib/auth";
import { getUserDashboardPrefs } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { credentialTwoFactorEnabled, loginTwoFactorEnabled, twoFactorSetupAvailable } from "@/lib/vault/two-factor";

export default async function SettingsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const dashboardPrefs = getUserDashboardPrefs(user.id);
  const ru = locale === "ru";

  return (
    <div className="max-w-3xl space-y-6">
      <SectionCard flush title={ru ? "Параметры" : "Preferences"} description={ru ? "Как приложение показывает ваши данные." : "How the app shows your numbers."}>
        <PreferencesForm locale={locale} displayCurrency={user.displayCurrency || "USD"} showTrend={dashboardPrefs.showTrend} />
      </SectionCard>

      <SectionCard
        flush
        title={ru ? "Безопасность" : "Security"}
        description={ru ? "Двухфакторная аутентификация через Google Authenticator." : "Two-factor authentication with Google Authenticator."}
      >
        {twoFactorSetupAvailable() ? (
          <TotpSetup enabled={user.totpEnabled} locale={locale} usedFor={{ login: loginTwoFactorEnabled(), credentials: credentialTwoFactorEnabled() }} />
        ) : (
          <FieldRow label={ru ? "Двухфакторная аутентификация" : "Two-factor authentication"} description={ru ? "Не включена на этом сервере." : "Not turned on for this server."}>
            <p className="text-[13px] text-zinc-500">—</p>
          </FieldRow>
        )}
        {user.totpEnabled ? (
          <form action={disableMyTotpAction} className="border-t border-white/[0.06]">
            <FieldRow
              label={t(locale, "disableMy2fa")}
              description={ru ? "Администратор также может сбросить 2FA в разделе администрирования." : "Admins can also reset 2FA from the admin panel."}
            >
              <Button size="sm" variant="destructive">
                {t(locale, "disable2fa")}
              </Button>
            </FieldRow>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}
