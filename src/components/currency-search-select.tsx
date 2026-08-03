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
            className={cn("h-10 w-full justify-between gap-3 pr-4 text-sm", triggerClassName)}
          >
            <span className="truncate">
              {selected
                ? `${showSymbol ? `${getCurrencySymbol(selected.code)} ` : ""}${selected.code} - ${selected.name}`
                : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={locale === "ru" ? "Поиск валюты..." : "Search currency..."} />
            <CommandList>
              <CommandEmpty>{locale === "ru" ? "Валюта не найдена." : "No currency found."}</CommandEmpty>
              <CommandGroup>
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <CommandItem key={currency.code} value={`${currency.code} ${currency.name}`} onSelect={() => selectCurrency(currency.code)}>
                    <Check className={cn("mr-2 h-4 w-4", value === currency.code ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{getCurrencySymbol(currency.code)} {currency.code} - {currency.name}</span>
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
