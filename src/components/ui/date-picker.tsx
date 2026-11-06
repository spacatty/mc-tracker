"use client";

/**
 * Date field: an Input-styled trigger that opens the app calendar. Submits `yyyy-MM-dd` through a hidden input
 * and shows the date as dd/MM/yyyy, the same format `displayDate()` uses everywhere else.
 *
 * @example
 * <Field label="Payment date"><DatePickerInput name="paymentDate" value={date} onChange={setDate} locale={locale} /></Field>
 */
import { format } from "date-fns";
import { enGB, ru as ruLocale } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function DatePickerInput({
  name,
  value,
  placeholder,
  onChange,
  triggerId,
  ariaLabel,
  locale = "en",
  triggerClassName,
  invalid = false,
  size = "md",
}: {
  name: string;
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  triggerId?: string;
  ariaLabel?: string;
  locale?: Locale;
  triggerClassName?: string;
  invalid?: boolean;
  size?: "sm" | "md";
}) {
  const [uncontrolledSelected, setUncontrolledSelected] = useState<Date | undefined>(
    value ? new Date(`${value}T00:00:00`) : undefined,
  );
  const controlled = onChange !== undefined;
  const selected = controlled
    ? (value ? new Date(`${value}T00:00:00`) : undefined)
    : uncontrolledSelected;
  const formatted = selected ? format(selected, "yyyy-MM-dd") : "";
  const emptyLabel = placeholder ?? (locale === "ru" ? "Выбрать дату" : "Pick a date");

  function select(date?: Date) {
    if (!controlled) setUncontrolledSelected(date);
    onChange?.(date ? format(date, "yyyy-MM-dd") : "");
  }

  return (
    <>
      <input type="hidden" name={name} value={formatted} />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={triggerId}
            aria-label={ariaLabel}
            data-invalid={invalid || undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-left text-sm outline-none transition-colors hover:border-white/15 focus-visible:border-white/20 focus-visible:ring-2 focus-visible:ring-violet-400/25 data-[state=open]:border-white/20 disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "h-8 text-[13px]" : "h-9",
              selected ? "text-zinc-100" : "text-subtle-foreground",
              invalid && "border-red-400/70 focus-visible:ring-red-400/30",
              triggerClassName,
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
            <span className="truncate tabular-nums">{selected ? format(selected, "dd/MM/yyyy") : emptyLabel}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden rounded-xl p-0">
          <DateCalendar selected={selected} onSelect={select} locale={locale} />
        </PopoverContent>
      </Popover>
    </>
  );
}

/** The app calendar on its own, for popovers that are not a form field (e.g. Quick Capture). */
export function DateCalendar({
  selected,
  onSelect,
  locale = "en",
  showClear = true,
}: {
  selected?: Date;
  onSelect: (date?: Date) => void;
  locale?: Locale;
  showClear?: boolean;
}) {
  const select = onSelect;
  const dateFnsLocale = locale === "ru" ? ruLocale : enGB;
  return (
    <>
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{locale === "ru" ? "Дата" : "Date"}</p>
        <p className="mt-0.5 text-[13px] text-zinc-200">
          {selected
            ? format(selected, "EEEE, d MMMM yyyy", { locale: dateFnsLocale })
            : locale === "ru" ? "Выберите день в календаре" : "Choose a day in the calendar"}
        </p>
      </div>
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={select}
        showOutsideDays
        fixedWeeks
        weekStartsOn={1}
        locale={dateFnsLocale}
        classNames={{
          root: "p-3 text-zinc-100",
          months: "relative flex flex-col gap-4",
          month: "space-y-3",
          month_caption: "relative flex h-8 items-center justify-center",
          caption_label: "text-[13px] font-semibold capitalize text-zinc-100",
          nav: "absolute inset-x-1 top-3 flex items-center justify-between",
          button_previous:
            "grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:opacity-30",
          button_next:
            "grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:opacity-30",
          chevron: "h-4 w-4 fill-none stroke-current stroke-2",
          month_grid: "w-full border-separate border-spacing-0.5",
          weekdays: "grid grid-cols-7",
          weekday: "grid h-7 place-items-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500",
          weeks: "",
          week: "grid grid-cols-7",
          day: "group relative grid h-8 w-8 place-items-center rounded-md text-[13px] text-zinc-200 transition",
          day_button:
            "grid h-8 w-8 place-items-center rounded-md tabular-nums transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
          selected:
            "rounded-md bg-violet-500 text-white [&>button]:bg-transparent [&>button]:font-semibold [&>button]:hover:bg-transparent",
          today: "text-violet-200 after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-violet-300",
          outside: "text-zinc-600 [&>button]:hover:text-zinc-400",
          disabled: "text-zinc-700 opacity-40",
          hidden: "invisible",
        }}
        footer={
          <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
            <button
              type="button"
              onClick={() => select(new Date())}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/10 hover:text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
            >
              {locale === "ru" ? "Сегодня" : "Today"}
            </button>
            {showClear ? (
              <button
                type="button"
                onClick={() => select(undefined)}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              >
                {locale === "ru" ? "Очистить" : "Clear"}
              </button>
            ) : null}
          </div>
        }
      />
    </>
  );
}
