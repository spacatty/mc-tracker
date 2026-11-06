"use client";

import { Check, Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMyPreferencesAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { CurrencySearchSelect } from "./currency-search-select";
import { Button } from "./ui/button";
import { FieldRow } from "./ui/field";
import { Switch } from "./ui/switch";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** Currency and dashboard options in one form with one Save. */
export function PreferencesForm({ locale, displayCurrency, showTrend }: { locale: Locale; displayCurrency: string; showTrend: boolean }) {
  const id = useId();
  const [dirty, setDirty] = useState(false);
  const [trend, setTrend] = useState(showTrend);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onChange={() => setDirty(true)}
      // A submit handler rather than a form action: React resets a form after its action, which would
      // throw the controlled toggle out of step with what was saved.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          await updateMyPreferencesAction(formData);
          setDirty(false);
          toast.success(tx(locale, "Preferences saved", "Настройки сохранены"));
        });
      }}
    >
      <div className="divide-y divide-white/[0.06]">
        <FieldRow
          label={tx(locale, "Display currency", "Валюта отображения")}
          description={tx(locale, "Totals on the dashboard are converted to this currency.", "Итоги на обзоре пересчитываются в эту валюту.")}
        >
          <div className="w-full" onClickCapture={() => setDirty(true)}>
            <CurrencySearchSelect name="displayCurrency" defaultValue={displayCurrency || "USD"} />
          </div>
        </FieldRow>
        <FieldRow
          label={tx(locale, "Month-over-month change", "Изменение за месяц")}
          description={tx(locale, "Shows how monthly spend changed since last month, next to “Per month” on the dashboard.", "Показывает изменение расходов за месяц рядом с «В месяц» на обзоре.")}
          htmlFor={`${id}-trend`}
        >
          <div className="flex items-center gap-3 text-[13px] text-zinc-400">
            <span aria-hidden="true">{trend ? tx(locale, "Shown", "Показано") : tx(locale, "Hidden", "Скрыто")}</span>
            <Switch
              id={`${id}-trend`}
              name="showTrend"
              checked={trend}
              onCheckedChange={(next) => {
                setTrend(next);
                setDirty(true);
              }}
            />
          </div>
        </FieldRow>
        <FieldRow
          label={tx(locale, "Language", "Язык")}
          description={tx(locale, "Switch it from the profile menu at the bottom of the sidebar.", "Меняется в меню профиля внизу боковой панели.")}
        >
          <p className="text-[13px] text-zinc-400">{locale === "ru" ? "Русский" : "English"}</p>
        </FieldRow>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
        {!dirty && !pending ? (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {tx(locale, "Up to date", "Изменений нет")}
          </span>
        ) : null}
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {tx(locale, "Save changes", "Сохранить изменения")}
        </Button>
      </div>
    </form>
  );
}
