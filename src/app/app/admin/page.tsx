import { createUserAction, updateAiSettingsAction } from "@/app/actions";
import { aiSettingsSummary } from "@/lib/ai/client";
import { AdminUsersTable } from "@/components/admin-users-table";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectInput } from "@/components/ui/hidden-input";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

const formFooterClass = "flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3";

export default async function AdminPage() {
  const actor = await requireUser();
  const locale = await getLocale();
  const users = listUsers();
  const ai = actor.role === "superadmin" ? aiSettingsSummary() : null;

  if (actor.role === "user") {
    return <p className="text-[13px] text-zinc-500">{tx(locale, "Admin tools are available to administrators only.", "Инструменты администрирования доступны только администраторам.")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <SectionCard flush title={tx(locale, "Create user", "Создать пользователя")} description={tx(locale, "Create an account with role and credentials in a single step.", "Создайте аккаунт с ролью и учётными данными за один шаг.")}>
        <form action={createUserAction}>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label={tx(locale, "Username", "Имя пользователя")} htmlFor="admin-new-username" required>
              <Input id="admin-new-username" name="username" autoComplete="off" required />
            </Field>
            <Field label={tx(locale, "Password", "Пароль")} htmlFor="admin-new-password" required>
              <Input id="admin-new-password" name="password" type="password" autoComplete="new-password" required />
            </Field>
            <Field label={tx(locale, "Role", "Роль")} htmlFor="admin-new-role">
              <SelectInput
                name="role"
                defaultValue="user"
                triggerId="admin-new-role"
                options={[
                  { value: "user", label: "user" },
                  ...(actor.role === "superadmin" ? [{ value: "admin", label: "admin" }, { value: "superadmin", label: "superadmin" }] : []),
                ]}
              />
            </Field>
          </div>
          <div className={formFooterClass}>
            <Button type="submit" size="sm">
              {tx(locale, "Create user", "Создать пользователя")}
            </Button>
          </div>
        </form>
      </SectionCard>

      {ai ? (
        <SectionCard
          flush
          title={tx(locale, "AI import", "Импорт с помощью AI")}
          description={tx(locale, "OpenRouter key and model for free-form import. Values saved here override the environment; leave them empty to use .env.", "Ключ OpenRouter и модель для импорта произвольного текста. Сохранённые здесь значения важнее переменных окружения; оставьте поля пустыми, чтобы использовать .env.")}
        >
          <form action={updateAiSettingsAction}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label={tx(locale, "API key", "API-ключ")}
                htmlFor="admin-ai-key"
                hint={
                  ai.keySource === "admin"
                    ? tx(locale, `Current: ${ai.maskedKey} (saved here)`, `Текущий: ${ai.maskedKey} (сохранён здесь)`)
                    : ai.keySource === "env"
                      ? tx(locale, `Current: ${ai.maskedKey} (from .env)`, `Текущий: ${ai.maskedKey} (из .env)`)
                      : tx(locale, "No key set. AI import is off.", "Ключ не задан. Импорт с помощью AI отключён.")
                }
              >
                <Input
                  id="admin-ai-key"
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={ai.keySource === "none" ? "sk-or-v1-…" : tx(locale, "Leave empty to keep the current key", "Оставьте пустым, чтобы сохранить текущий ключ")}
                />
              </Field>
              <Field
                label={tx(locale, "Model", "Модель")}
                htmlFor="admin-ai-model"
                hint={ai.storedModel ? tx(locale, `In use: ${ai.model} (saved here)`, `Используется: ${ai.model} (сохранена здесь)`) : tx(locale, `In use: ${ai.model} (from .env or default)`, `Используется: ${ai.model} (из .env или по умолчанию)`)}
              >
                <Input id="admin-ai-model" name="model" defaultValue={ai.storedModel} placeholder={ai.fallbackModel} autoComplete="off" />
              </Field>
            </div>
            {/* Save comes first in the DOM so pressing Enter saves instead of removing the key. */}
            <div className={formFooterClass}>
              <Button type="submit" size="sm">
                {tx(locale, "Save AI settings", "Сохранить настройки AI")}
              </Button>
              {ai.keySource === "admin" ? (
                <Button type="submit" name="clearKey" value="1" variant="ghost" size="sm" className="order-first text-red-300 hover:bg-red-500/10 hover:text-red-200">
                  {tx(locale, "Remove saved key", "Удалить сохранённый ключ")}
                </Button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      <AdminUsersTable users={users} actorRole={actor.role} locale={locale} />
    </div>
  );
}
