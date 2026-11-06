"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Category, PaymentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { SearchInput } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

function fuzzyMatch(haystack: string, needle: string) {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  let index = 0;
  const value = haystack.toLowerCase();
  for (const char of query) {
    index = value.indexOf(char, index);
    if (index === -1) return false;
    index += 1;
  }
  return true;
}

export function EntrySearchSelect({
  entries,
  categories,
  value,
  onChange,
  locale = "en",
}: {
  entries: PaymentItem[];
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  locale?: Locale;
}) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [query, setQuery] = useState("");
  const selected = entries.find((entry) => String(entry.id) === value);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const allCategoriesLabel = locale === "ru" ? "Все категории" : "All categories";

  const suggestions = useMemo(() => {
    return entries
      .filter((entry) => !categoryFilter || String(entry.categoryId || "") === categoryFilter)
      .filter((entry) => fuzzyMatch(`${entry.name} ${entry.vendorName} ${entry.vendorUrl} ${entry.accountName} ${entry.categoryName}`, query))
      .slice(0, 12);
  }, [categoryFilter, entries, query]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
      <input type="hidden" name="itemId" value={value} />
      <div className="flex flex-col gap-2 border-b border-white/[0.06] p-2 sm:flex-row">
        <Select value={categoryFilter || "all"} onValueChange={(next) => setCategoryFilter(next === "all" ? "" : next)}>
          <SelectTrigger className="h-8 rounded-md text-[13px] sm:w-48" aria-label={t(locale, "category")}>
            <SelectValue placeholder={allCategoriesLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{allCategoriesLabel}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                <span className="flex items-center gap-2">
                  <AppIcon name={category.icon} className="h-3.5 w-3.5" />
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          size="sm"
          value={query}
          onChange={setQuery}
          placeholder={selected ? selected.name : locale === "ru" ? "Найти запись" : "Search entries"}
          aria-label={locale === "ru" ? "Найти запись" : "Search entries"}
          clearLabel={locale === "ru" ? "Очистить поиск" : "Clear search"}
          className="flex-1"
        />
      </div>

      <div role="listbox" aria-label={t(locale, "entry")} className="max-h-56 overflow-y-auto p-1">
        {suggestions.map((entry) => {
          const isSelected = String(entry.id) === value;
          const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
          const secondary = entry.accountName || entry.vendorName;
          return (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(String(entry.id));
                setQuery("");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
                isSelected ? "bg-violet-500/10" : "hover:bg-white/[0.04]",
              )}
            >
              <span className="grid h-4 w-4 shrink-0 place-items-center text-violet-300">
                {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-zinc-100">{entry.name}</span>
                {secondary ? <span className="block truncate text-[11.5px] text-zinc-500">{secondary}</span> : null}
              </span>
              <Badge
                color={entry.categoryColor || category?.color || undefined}
                icon={<AppIcon name={entry.categoryIcon || category?.icon} />}
                className="shrink-0"
              >
                {entry.categoryName || t(locale, "uncategorized")}
              </Badge>
            </button>
          );
        })}
        {!suggestions.length ? (
          <p className="px-3 py-6 text-center text-[13px] text-zinc-500">{locale === "ru" ? "Ничего не найдено." : "No matching entries."}</p>
        ) : null}
      </div>
    </div>
  );
}
