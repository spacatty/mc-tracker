import { redirect } from "next/navigation";
import { setupAction } from "@/app/actions";
import { BrandLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSetupComplete } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function SetupPage() {
  if (isSetupComplete()) redirect("/login");
  const locale = await getLocale();

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <form action={setupAction} className="w-full max-w-[380px] rounded-xl border border-white/10 bg-[#101013] p-7 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandLogo className="h-6 w-6 object-contain" />
          <h1 className="text-[15px] font-semibold text-zinc-100">{locale === "ru" ? "Создать superadmin" : "Create superadmin"}</h1>
        </div>
        <div className="space-y-2.5">
          <Input name="username" placeholder={t(locale, "username")} />
          <Input name="password" type="password" placeholder={locale === "ru" ? "Пароль, 8+ символов" : "Password, 8+ characters"} />
          <Button className="!mt-4 w-full">{locale === "ru" ? "Завершить настройку" : "Finish setup"}</Button>
        </div>
      </form>
    </main>
  );
}
