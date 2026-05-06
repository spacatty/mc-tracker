"use client";

import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category, PaymentItem } from "@/lib/types";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function fuzzyMatch(value: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  let index = 0;
  const text = value.toLowerCase();
  for (const char of normalized) {
    index = text.indexOf(char, index);
    if (index === -1) return false;
    index += 1;
  }
  return true;
}

export function FolderContentPicker({
  categories,
  items,
  initialCategoryIds = [],
  initialItemIds = [],
}: {
  categories: Category[];
  items: PaymentItem[];
  initialCategoryIds?: number[];
  initialItemIds?: number[];
}) {
  const [categoryIds, setCategoryIds] = useState(new Set(initialCategoryIds));
  const [itemIds, setItemIds] = useState(new Set(initialItemIds));
  const [categoryQuery, setCategoryQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");

  const selectedCategories = categories.filter((category) => categoryIds.has(category.id));
  const selectedItems = items.filter((item) => itemIds.has(item.id));

  const categorySuggestions = useMemo(
    () => categories.filter((category) => !categoryIds.has(category.id) && fuzzyMatch(category.name, categoryQuery)).slice(0, 8),
    [categories, categoryIds, categoryQuery],
  );
  const itemSuggestions = useMemo(
    () =>
      items
        .filter((item) => !itemIds.has(item.id) && fuzzyMatch(`${item.name} ${item.vendorName} ${item.accountName} ${item.categoryName}`, itemQuery))
        .slice(0, 8),
    [itemIds, itemQuery, items],
  );

  function addCategory(id: number) {
    setCategoryIds((current) => new Set([...current, id]));
    setCategoryQuery("");
  }

  function removeCategory(id: number) {
    setCategoryIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function addItem(id: number) {
    setItemIds((current) => new Set([...current, id]));
    setItemQuery("");
  }

  function removeItem(id: number) {
    setItemIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {[...categoryIds].map((id) => <input key={`category-${id}`} type="hidden" name="categoryIds" value={id} />)}
      {[...itemIds].map((id) => <input key={`item-${id}`} type="hidden" name="itemIds" value={id} />)}

      <div className="rounded-2xl bg-black/20 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Categories</h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Search category to add" className="pl-9" />
        </div>
        {categoryQuery || categorySuggestions.length ? (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-1">
            {categorySuggestions.map((category) => (
              <button key={category.id} type="button" onClick={() => addCategory(category.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10">
                <AppIcon name={category.icon} className="h-4 w-4" />
                <span className="flex-1 truncate">{category.name}</span>
                <Plus className="h-4 w-4 text-zinc-500" />
              </button>
            ))}
            {!categorySuggestions.length ? <p className="px-3 py-5 text-center text-sm text-zinc-500">No categories found.</p> : null}
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          {selectedCategories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <AppIcon name={category.icon} className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{category.name}</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCategory(category.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!selectedCategories.length ? <p className="text-sm text-zinc-500">No selected categories.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl bg-black/20 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Entries</h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Search entry to add" className="pl-9" />
        </div>
        {itemQuery || itemSuggestions.length ? (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-1">
            {itemSuggestions.map((item) => (
              <button key={item.id} type="button" onClick={() => addItem(item.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10">
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <Badge variant="secondary" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}25`, color: item.categoryColor || "#c4b5fd" }}>
                  {item.categoryName || "Uncategorized"}
                </Badge>
                <Plus className="h-4 w-4 text-zinc-500" />
              </button>
            ))}
            {!itemSuggestions.length ? <p className="px-3 py-5 text-center text-sm text-zinc-500">No entries found.</p> : null}
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{item.name}</span>
              <Badge variant="secondary" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}25`, color: item.categoryColor || "#c4b5fd" }}>
                {item.categoryName || "Uncategorized"}
              </Badge>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(item.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!selectedItems.length ? <p className="text-sm text-zinc-500">No selected entries.</p> : null}
        </div>
      </div>
    </div>
  );
}
