"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, ensureSupportedCurrency, getCurrencySymbol } from "@/lib/currencies";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type CurrencySearchSelectProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  triggerClassName?: string;
  onValueChange?: (value: string) => void;
  showSymbol?: boolean;
  triggerId?: string;
  ariaLabel?: string;
  locale?: Locale;
};

export function CurrencySearchSelect({
  name,
  defaultValue,
  placeholder = "Select currency",
  triggerClassName,
  onValueChange,
  showSymbol = true,
  triggerId,
  ariaLabel,
  locale = "en",
}: CurrencySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(ensureSupportedCurrency(defaultValue, DEFAULT_CURRENCY));
  const selected = useMemo(() => SUPPORTED_CURRENCIES.find((currency) => currency.code === value), [value]);

  function selectCurrency(next: string) {
    setValue(next);
    setOpen(false);
    onValueChange?.(next);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={triggerId}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            className={cn(
              "h-9 w-full justify-between gap-3 bg-white/[0.03] px-3 text-sm font-normal text-zinc-100 hover:border-white/15 hover:bg-white/[0.03] active:scale-100",
              triggerClassName,
            )}
          >
            <span className="truncate">
              {selected
                ? `${showSymbol ? `${getCurrencySymbol(selected.code)} ` : ""}${selected.code} · ${selected.name}`
                : placeholder}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
          <Command>
            <CommandInput placeholder={locale === "ru" ? "Поиск валюты…" : "Search currency..."} />
            <CommandList>
              <CommandEmpty>{locale === "ru" ? "Валюта не найдена." : "No currency found."}</CommandEmpty>
              <CommandGroup>
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <CommandItem key={currency.code} value={`${currency.code} ${currency.name}`} onSelect={() => selectCurrency(currency.code)}>
                    <Check className={cn("mr-2 h-3.5 w-3.5 text-violet-300", value === currency.code ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="truncate"><span className="font-medium text-zinc-100">{currency.code}</span> <span className="text-zinc-500">{getCurrencySymbol(currency.code)} · {currency.name}</span></span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
