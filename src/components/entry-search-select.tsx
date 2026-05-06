"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Category, PaymentItem } from "@/lib/types";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
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

  const suggestions = useMemo(() => {
    return entries
      .filter((entry) => !categoryFilter || String(entry.categoryId || "") === categoryFilter)
      .filter((entry) => fuzzyMatch(`${entry.name} ${entry.vendorName} ${entry.vendorUrl} ${entry.accountName} ${entry.categoryName}`, query))
      .slice(0, 12);
  }, [categoryFilter, entries, query]);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <input type="hidden" name="itemId" value={value} />
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <Select value={categoryFilter || "all"} onValueChange={(next) => setCategoryFilter(next === "all" ? "" : next)}>
          <SelectTrigger>
            <SelectValue placeholder={locale === "ru" ? "Все категории" : "All categories"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "ru" ? "Все категории" : "All categories"}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                <span className="flex items-center gap-2">
                  <AppIcon name={category.icon} className="h-4 w-4" />
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={selected ? selected.name : (locale === "ru" ? "Поиск записи" : "Fuzzy-search entry")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/60 p-1">
        {suggestions.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              onChange(String(entry.id));
              setQuery(entry.name);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/10"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
            <Badge
              variant="secondary"
              className="shrink-0"
              style={{ backgroundColor: `${entry.categoryColor || "#8b5cf6"}25`, color: entry.categoryColor || "#c4b5fd" }}
            >
              {entry.categoryName || t(locale, "uncategorized")}
            </Badge>
          </button>
        ))}
        {!suggestions.length ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-500">{locale === "ru" ? "Совпадений не найдено." : "No matching entries."}</p>
        ) : null}
      </div>
    </div>
  );
}
