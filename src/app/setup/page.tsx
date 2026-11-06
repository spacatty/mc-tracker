import { redirect } from "next/navigation";
import { setupAction } from "@/app/actions";
import { BrandLogo, BrandWordmark } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isSetupComplete } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function SetupPage() {
  if (isSetupComplete()) redirect("/login");
  const locale = await getLocale();
  const ru = locale === "ru";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandLogo className="h-6 w-6" />
          <BrandWordmark />
        </div>
        <form action={setupAction} className="rounded-xl border border-white/[0.06] bg-surface p-6">
          <h1 className="text-[15px] font-semibold text-white">{ru ? "Создание суперадминистратора" : "Create superadmin"}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {ru ? "Первый аккаунт получает права на управление пользователями и настройками." : "The first account manages users and settings."}
          </p>
          <div className="mt-5 grid gap-4">
            <Field label={t(locale, "username")} htmlFor="setup-username">
              <Input id="setup-username" name="username" autoComplete="username" autoFocus />
            </Field>
            <Field label={t(locale, "password")} htmlFor="setup-password" hint={ru ? "Не меньше 8 символов." : "At least 8 characters."}>
              <Input id="setup-password" name="password" type="password" autoComplete="new-password" />
            </Field>
          </div>
          <Button type="submit" className="mt-6 w-full">
            {ru ? "Завершить настройку" : "Finish setup"}
          </Button>
        </form>
      </div>
    </main>
  );
}
