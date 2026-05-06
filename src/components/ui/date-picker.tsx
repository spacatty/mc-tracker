"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function DatePickerInput({
  name,
  value,
  placeholder = "Pick date",
  onChange,
}: {
  name: string;
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const [selected, setSelected] = useState<Date | undefined>(value ? new Date(`${value}T00:00:00`) : undefined);
  const formatted = selected ? format(selected, "yyyy-MM-dd") : "";

  function select(date?: Date) {
    setSelected(date);
    onChange?.(date ? format(date, "yyyy-MM-dd") : "");
  }

  return (
    <>
      <input type="hidden" name={name} value={formatted} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start overflow-hidden border-white/10 bg-black/30 text-left font-normal",
              "hover:border-violet-400/30 hover:bg-violet-500/10",
              selected ? "text-zinc-100" : "text-zinc-600",
            )}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-200">
              <CalendarIcon className="h-3.5 w-3.5" />
            </span>
            {selected ? format(selected, "dd-MM-yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto overflow-hidden rounded-3xl border-violet-400/20 bg-[#09090f]/95 p-0 shadow-2xl shadow-violet-950/30 backdrop-blur-xl"
        >
          <div className="border-b border-white/10 bg-gradient-to-r from-violet-500/15 via-sky-500/10 to-fuchsia-500/15 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">Pick date</p>
            <p className="mt-1 text-sm text-zinc-400">{selected ? format(selected, "EEEE, dd MMMM yyyy") : "Choose billing or expiry date"}</p>
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={select}
            showOutsideDays
            fixedWeeks
            weekStartsOn={1}
            classNames={{
              root: "p-4 text-zinc-100",
              months: "relative flex flex-col gap-4",
              month: "space-y-4",
              month_caption: "relative flex h-10 items-center justify-center",
              caption_label: "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white shadow-inner shadow-white/5",
              nav: "absolute inset-x-4 top-4 flex items-center justify-between",
              button_previous:
                "grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-violet-400/30 hover:bg-violet-500/15 hover:text-white disabled:opacity-30",
              button_next:
                "grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-violet-400/30 hover:bg-violet-500/15 hover:text-white disabled:opacity-30",
              chevron: "h-4 w-4 fill-none stroke-current stroke-2",
              month_grid: "w-full border-separate border-spacing-1",
              weekdays: "grid grid-cols-7 gap-1",
              weekday: "grid h-8 place-items-center rounded-lg text-[0.7rem] font-semibold uppercase tracking-wider text-zinc-500",
              weeks: "space-y-1",
              week: "grid grid-cols-7 gap-1",
              day: "group relative grid h-10 w-10 place-items-center rounded-xl text-sm text-zinc-200 transition",
              day_button:
                "grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
              selected:
                "rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/50 [&>button]:bg-transparent [&>button]:font-bold [&>button]:hover:bg-transparent",
              today:
                "rounded-xl text-sky-200 ring-1 ring-sky-400/30 before:absolute before:bottom-1 before:h-1 before:w-1 before:rounded-full before:bg-sky-300",
              outside: "text-zinc-700 opacity-60 [&>button]:hover:text-zinc-500",
              disabled: "text-zinc-800 opacity-40",
              hidden: "invisible",
            }}
            footer={
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => select(new Date())}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/10"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => select(undefined)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
