"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { updateMyPreferencesAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { CurrencySearchSelect } from "./currency-search-select";
import { Button } from "./ui/button";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** A settings row: what it is on the left, the control on the right (stacked on phones). */
export function SettingRow({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-8">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-zinc-100">{title}</p>
        {description ? <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Currency and dashboard options in one form with one Save. */
export function PreferencesForm({ locale, displayCurrency, showTrend }: { locale: Locale; displayCurrency: string; showTrend: boolean }) {
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
        <SettingRow
          title={tx(locale, "Display currency", "Валюта отображения")}
          description={tx(locale, "Totals on the dashboard are converted to this currency.", "Итоги на дашборде пересчитываются в эту валюту.")}
        >
          <div onClickCapture={() => setDirty(true)}>
            <CurrencySearchSelect name="displayCurrency" defaultValue={displayCurrency || "USD"} />
          </div>
        </SettingRow>
        <SettingRow
          title={tx(locale, "Month-over-month change", "Изменение за месяц")}
          description={tx(locale, "Shows how monthly spend changed since last month, next to “Per month” on the dashboard.", "Показывает изменение расходов за месяц рядом с «В месяц» на дашборде.")}
        >
          <label className="flex cursor-pointer items-center justify-end gap-3 text-[13px] text-zinc-400">
            <span>{trend ? tx(locale, "Shown", "Показано") : tx(locale, "Hidden", "Скрыто")}</span>
            <input type="checkbox" name="showTrend" checked={trend} onChange={(event) => setTrend(event.target.checked)} className="peer sr-only" />
            <span className="relative h-5 w-9 rounded-full bg-white/[0.08] transition peer-checked:bg-violet-500/70 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400/40 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-zinc-200 after:transition peer-checked:after:translate-x-4" />
          </label>
        </SettingRow>
        <SettingRow title={tx(locale, "Language", "Язык")} description={tx(locale, "Switch it from the profile menu at the bottom of the sidebar.", "Меняется в меню профиля внизу боковой панели.")}>
          <p className="text-right text-[13px] text-zinc-400">{locale === "ru" ? "Русский" : "English"}</p>
        </SettingRow>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
        {!dirty && !pending ? <span className="flex items-center gap-1.5 text-xs text-zinc-500"><Check className="h-3.5 w-3.5" />{tx(locale, "Up to date", "Сохранено")}</span> : null}
        <Button type="submit" size="sm" disabled={pending || !dirty}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {tx(locale, "Save changes", "Сохранить")}
        </Button>
      </div>
    </form>
  );
}
