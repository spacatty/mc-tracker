"use client";

import { ArrowUpDown, Bell, Check, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { saveCategoryAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Category, CategoryField, NotificationChannel } from "@/lib/types";
import { displayDate } from "@/lib/utils";
import { AppIcon } from "./icons";
import { IconPicker } from "./icon-picker";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Button } from "./ui/button";
import { CheckboxInput } from "./ui/hidden-input";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const fieldTypes: CategoryField["type"][] = ["text", "url", "number", "date", "checkbox", "select", "textarea"];

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

function blankField(locale: Locale): CategoryField {
  return {
    id: crypto.randomUUID().slice(0, 8),
    label: locale === "ru" ? "Новое поле" : "New field",
    type: "text",
    required: false,
    bold: false,
    color: "#c4b5fd",
    showInTable: true,
    copyable: false,
  };
}

function FieldEditor({
  field,
  index,
  onChange,
  onRemove,
  locale,
}: {
  field: CategoryField;
  index: number;
  onChange: (field: CategoryField) => void;
  onRemove: () => void;
  locale: Locale;
}) {
  const [optionsText, setOptionsText] = useState((field.options || []).join(", "));
  const colorValue = field.color || "#c4b5fd";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <input type="hidden" name="field_id" value={field.id} />
      <input type="hidden" name="field_type" value={field.type} />
      <div className="grid gap-3 lg:grid-cols-[1.2fr_160px_96px_auto]">
        <Input
          name="field_label"
          value={field.label}
          onChange={(event) => onChange({ ...field, label: event.target.value })}
          placeholder={locale === "ru" ? "Название поля" : "Field label"}
        />
        <Select value={field.type} onValueChange={(value) => onChange({ ...field, type: value as CategoryField["type"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2">
          <input type="hidden" name="field_color" value={field.color || ""} />
          <Input
            type="color"
            value={colorValue}
            onChange={(event) => onChange({ ...field, color: event.target.value })}
            className="h-8 w-8 rounded-full border-0 bg-transparent p-0"
            title={locale === "ru" ? "Цвет текста" : "Text color"}
          />
          <button
            type="button"
            onClick={() => onChange({ ...field, color: "" })}
            className="rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
          >
            {field.color ? (locale === "ru" ? "Без цвета" : "No color") : (locale === "ru" ? "Цвет не выбран" : "No color selected")}
          </button>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} title={locale === "ru" ? "Удалить поле" : "Remove field"}>
          <Trash2 className="h-4 w-4 text-red-300" />
        </Button>
      </div>
      {field.type === "select" ? (
        <Input
          name="field_options"
          value={optionsText}
          onChange={(event) => {
            const nextValue = event.target.value;
            setOptionsText(nextValue);
            onChange({
              ...field,
              options: nextValue
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean),
            });
          }}
          placeholder={locale === "ru" ? "Опции через запятую" : "Select options, comma separated"}
          className="mt-3"
        />
      ) : (
        <input type="hidden" name="field_options" value="" />
      )}
      <div className="mt-3 flex flex-wrap gap-4">
        <CheckboxInput name="field_required" value={index} defaultChecked={field.required}>{locale === "ru" ? "Обязательно" : "Required"}</CheckboxInput>
        <CheckboxInput name="field_bold" value={index} defaultChecked={field.bold}>{locale === "ru" ? "Жирный текст" : "Bold text"}</CheckboxInput>
        <CheckboxInput name="field_show" value={index} defaultChecked={field.showInTable}>{locale === "ru" ? "Показывать в таблице" : "Show in table"}</CheckboxInput>
        <CheckboxInput name="field_copyable" value={index} defaultChecked={field.copyable}>{locale === "ru" ? "Клик для копии" : "Click to copy"}</CheckboxInput>
      </div>
    </div>
  );
}

function NotificationPicker({
  channels,
  selectedIds,
  locale,
}: {
  channels?: NotificationChannel[];
  selectedIds: number[];
  locale: Locale;
}) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const routes = channels || [];

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[...selected].map((id) => <input key={id} type="hidden" name="notificationChannelIds" value={id} />)}
      {routes.map((channel) => (
        <div
          key={channel.id}
          role="button"
          tabIndex={0}
          onClick={() => toggle(channel.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggle(channel.id);
            }
          }}
          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-violet-300/40 hover:bg-white/[0.04]"
        >
          <span
            className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
              selected.has(channel.id) ? "border-violet-400 bg-violet-500 text-white" : "border-white/15 bg-black/40"
            }`}
          >
            {selected.has(channel.id) ? <Check className="h-4 w-4" /> : null}
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-200">
            {channel.type === "website" ? <Bell className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{channel.title}</span>
            <span className="mt-1 block text-xs text-zinc-500">
              {channel.type === "website" ? (locale === "ru" ? "Website входящие" : "Website inbox") : `${locale === "ru" ? "Telegram чат" : "Telegram chat"} ${channel.chatId || "-"}`}
              {channel.topicId ? ` · ${locale === "ru" ? "топик" : "topic"} ${channel.topicId}` : channel.type === "telegram" ? ` · ${locale === "ru" ? "основной чат" : "main chat"}` : ""}
            </span>
          </span>
        </div>
      ))}
      {!routes.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
          {locale === "ru"
            ? "Маршрутов уведомлений пока нет. Добавьте Telegram-маршруты в Настройках."
            : "No notification routes yet. Add Telegram bot/topic routes in Settings, then assign them here."}
        </p>
      ) : null}
    </div>
  );
}

function CategoryForm({
  category,
  channels,
  selectedNotificationIds = [],
  workspaceId,
  locale = "en",
}: {
  category?: Category;
  channels?: NotificationChannel[];
  selectedNotificationIds?: number[];
  workspaceId: number;
  locale?: Locale;
}) {
  const [fields, setFields] = useState<CategoryField[]>(category?.fields || []);

  function updateField(index: number, field: CategoryField) {
    setFields((current) => current.map((candidate, candidateIndex) => (candidateIndex === index ? field : candidate)));
  }

  return (
    <form action={saveCategoryAction} className="space-y-5">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-3 lg:grid-cols-[1fr_260px_120px_auto]">
        <Input name="name" defaultValue={category?.name || ""} placeholder={locale === "ru" ? "Название категории" : "Category name"} />
        <IconPicker name="icon" defaultValue={category?.icon || "Sparkles"} />
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2">
          <Input name="color" type="color" defaultValue={category?.color || "#8b5cf6"} className="h-8 w-8 rounded-full border-0 bg-transparent p-0" />
          <span className="text-xs text-zinc-500">{locale === "ru" ? "Акцент" : "Accent"}</span>
        </div>
        <Button>{category ? (locale === "ru" ? "Сохранить" : "Save category") : t(locale, "createCategory")}</Button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">{t(locale, "fields")}</h3>
          <Button type="button" variant="secondary" size="sm" onClick={() => setFields((current) => [...current, blankField(locale)])}>
            <Plus className="h-4 w-4" />
            {locale === "ru" ? "Добавить поле" : "Add field"}
          </Button>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              locale={locale}
              onChange={(next) => updateField(index, next)}
              onRemove={() => setFields((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}
            />
          ))}
          {!fields.length ? <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">{locale === "ru" ? "Пользовательских полей пока нет." : "No custom fields yet."}</p> : null}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-300">{locale === "ru" ? "Маршруты уведомлений" : "Notification routes"}</h3>
        <p className="mb-3 text-xs text-zinc-500">{locale === "ru" ? "Выберите Website или Telegram маршруты для этой категории." : "Pick existing Website or Telegram bot/topic instances for this category."}</p>
        <NotificationPicker channels={channels} selectedIds={selectedNotificationIds} locale={locale} />
      </div>
    </form>
  );
}

export function CategoryManager({
  categories,
  channels,
  selectedByCategory,
  workspaceId,
  locale = "en",
}: {
  categories: Category[];
  channels?: NotificationChannel[];
  selectedByCategory: Record<number, number[]>;
  workspaceId: number;
  locale?: Locale;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"created" | "name" | "fields">("created");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const visibleCategories = categories
    .filter((category) => fuzzyMatch(`${category.name} ${(category.fields || []).map((field) => field.label).join(" ")}`, query))
    .sort((a, b) => {
      const result = sortKey === "fields"
        ? (a.fields || []).length - (b.fields || []).length
        : sortKey === "created"
          ? String(a.createdAt).localeCompare(String(b.createdAt))
          : a.name.localeCompare(b.name);
      return direction === "asc" ? result : -result;
    });

  function changeSort(key: "created" | "name" | "fields") {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "created" ? "desc" : "asc");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
            <AppIcon name="Sparkles" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t(locale, "createCategory")}</h2>
            <p className="text-sm text-zinc-500">{locale === "ru" ? "Добавьте шаблон с полями и маршрутами уведомлений." : "Add a clean template with custom display fields and notification routes."}</p>
          </div>
        </div>
        <CategoryForm channels={channels} workspaceId={workspaceId} locale={locale} />
      </section>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(locale, "searchCategories")} className="md:max-w-md" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => changeSort("created")}>
              <ArrowUpDown className="h-4 w-4" />
              {t(locale, "created")}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => changeSort("name")}>
              <ArrowUpDown className="h-4 w-4" />
              {t(locale, "name")}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => changeSort("fields")}>
              <ArrowUpDown className="h-4 w-4" />
              {t(locale, "fields")}
            </Button>
          </div>
        </div>
        <Accordion type="multiple">
        {visibleCategories.map((category) => (
          <AccordionItem key={category.id} value={String(category.id)} className="px-5">
            <AccordionTrigger>
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: `${category.color}25`, color: category.color }}>
                  <AppIcon name={category.icon} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-base">{category.name}</span>
                  <span className="block text-xs font-normal text-zinc-500">
                    {(category.fields || []).length} {locale === "ru" ? "полей" : "fields"} · {t(locale, "created").toLowerCase()} {displayDate(category.createdAt)}
                  </span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <CategoryForm category={category} channels={channels} selectedNotificationIds={selectedByCategory[category.id] || []} workspaceId={workspaceId} locale={locale} />
            </AccordionContent>
          </AccordionItem>
        ))}
        {!visibleCategories.length ? <p className="p-8 text-center text-sm text-zinc-500">{t(locale, "noCategoriesMatch")}</p> : null}
        </Accordion>
      </div>
    </div>
  );
}
