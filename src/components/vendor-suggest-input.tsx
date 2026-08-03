"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { VendorSuggestion } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function matches(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

function SuggestCombobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  name,
  locale,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  name: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const uniqueOptions = [...new Set(options.filter(Boolean))].slice(0, 40);

  return (
    <div className="space-y-2">
      <label htmlFor={`${name}-trigger`} className="text-sm font-medium text-foreground">{label}</label>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={`${name}-trigger`} type="button" variant="outline" aria-label={label} className="w-full justify-between gap-3 pr-4 font-normal">
            <span className={cn("truncate", !value && "text-zinc-600")}>{value || placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={locale === "ru" ? `Поиск: ${label.toLowerCase()}...` : `Search ${label.toLowerCase()}...`} value={value} onValueChange={onChange} />
            <CommandList>
              <CommandEmpty>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
                >
                  {locale === "ru" ? "Использовать" : "Use"} &quot;{value || placeholder}&quot;
                </button>
              </CommandEmpty>
              <CommandGroup heading={label}>
                {uniqueOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={(next) => {
                      onChange(next);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{option}</span>
                    {option === value ? <Check className="ml-auto h-4 w-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function VendorSuggestInputs({
  suggestions,
  defaultVendor = "",
  defaultUrl = "",
  defaultAccount = "",
  className = "grid gap-3 lg:grid-cols-3",
  locale = "en",
}: {
  suggestions: VendorSuggestion[];
  defaultVendor?: string;
  defaultUrl?: string;
  defaultAccount?: string;
  className?: string;
  locale?: Locale;
}) {
  const [vendor, setVendor] = useState(defaultVendor);
  const [url, setUrl] = useState(defaultUrl);
  const [account, setAccount] = useState(defaultAccount);
  const vendorOptions = useMemo(() => suggestions.filter((suggestion) => matches(suggestion.vendorName, vendor)).map((suggestion) => suggestion.vendorName), [suggestions, vendor]);
  const urlOptions = useMemo(() => suggestions.filter((suggestion) => matches(suggestion.vendorUrl, url)).map((suggestion) => suggestion.vendorUrl), [suggestions, url]);
  const accountOptions = useMemo(() => suggestions.filter((suggestion) => matches(suggestion.accountName, account)).map((suggestion) => suggestion.accountName), [suggestions, account]);

  return (
    <div className={className}>
      <SuggestCombobox name="vendorName" label={locale === "ru" ? "Поставщик" : "Vendor"} value={vendor} onChange={setVendor} options={vendorOptions} placeholder={locale === "ru" ? "Поставщик или ресурс" : "Provider/resource name"} locale={locale} />
      <SuggestCombobox name="vendorUrl" label="URL" value={url} onChange={setUrl} options={urlOptions} placeholder="https://..." locale={locale} />
      <SuggestCombobox name="accountName" label={locale === "ru" ? "Аккаунт" : "Account"} value={account} onChange={setAccount} options={accountOptions} placeholder={locale === "ru" ? "Аккаунт или логин" : "Account/login"} locale={locale} />
    </div>
  );
}
