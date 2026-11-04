import { ButtonVariants } from "@/components/button-variants";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";

/** Temporary preview of five primary button styles; not linked from the sidebar. */
export default async function ButtonStylesPage() {
  await requireUser();
  const locale = await getLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={locale === "ru" ? "Превью" : "Preview"}
        title={locale === "ru" ? "Главная кнопка" : "Primary button"}
        description={locale === "ru" ? "Пять анимированных вариантов. Выбранный заменит все главные кнопки и «Новая запись»." : "Five animated takes. The one you pick replaces every primary button, including Create new entry."}
      />
      <ButtonVariants locale={locale} />
    </div>
  );
}
