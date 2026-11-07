"use client";

import { Plus, Save, SearchX, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { saveCategoryAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { count, t } from "@/lib/i18n";
import type { Category, CategoryField } from "@/lib/types";
import { cn, displayDate } from "@/lib/utils";
import { defaultIdentifierField } from "@/lib/item-host";
import { CategoryMark } from "./host-line";
import { IconPicker } from "./icon-picker";
import { Button } from "./ui/button";
import { Field, Fieldset } from "./ui/field";
import { CheckboxInput } from "./ui/hidden-input";
import { Input, SearchInput } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { RowAction } from "./ui/row-actions";
import { SectionCard } from "./ui/section-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, TableToolbar } from "./ui/table";
import { Tooltip } from "./ui/tooltip";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

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
    color: "#7dd3fc",
    showInTable: true,
    copyable: false,
  };
}

/** A small colour swatch input (native picker) inside an input-styled box. */
function ColorSwatch({
  id,
  name,
  value,
  defaultValue,
  onChange,
  label,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="color"
      value={value}
      defaultValue={defaultValue}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      aria-label={label}
      className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-white/10 bg-transparent p-0 [&::-moz-color-swatch]:rounded-[5px] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border-0"
    />
  );
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
  const id = useId();
  const [optionsText, setOptionsText] = useState((field.options || []).join(", "));
  const colorValue = field.color || "#7dd3fc";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <input type="hidden" name="field_id" value={field.id} />
      <input type="hidden" name="field_type" value={field.type} />
      <input type="hidden" name="field_color" value={field.color || ""} />
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] lg:grid-cols-[minmax(0,1fr)_9rem_minmax(0,12rem)_auto]">
        <Field label={tx(locale, "Label", "Название")} htmlFor={`${id}-label`}>
          <Input
            id={`${id}-label`}
            name="field_label"
            value={field.label}
            onChange={(event) => onChange({ ...field, label: event.target.value })}
            placeholder={tx(locale, "Field label", "Название поля")}
          />
        </Field>
        <Field label={tx(locale, "Type", "Тип")} htmlFor={`${id}-type`}>
          <Select value={field.type} onValueChange={(value) => onChange({ ...field, type: value as CategoryField["type"] })}>
            <SelectTrigger id={`${id}-type`}>
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
        </Field>
        <Field label={tx(locale, "Text colour", "Цвет текста")} htmlFor={`${id}-color`}>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] pl-1.5 pr-1">
            <ColorSwatch
              id={`${id}-color`}
              value={colorValue}
              onChange={(color) => onChange({ ...field, color })}
              label={tx(locale, "Text colour", "Цвет текста")}
            />
            <span className={cn("min-w-0 flex-1 truncate font-mono text-xs", field.color ? "text-zinc-300" : "text-zinc-600")}>
              {field.color || tx(locale, "Default", "По умолчанию")}
            </span>
            {field.color ? (
              <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5 text-[11.5px]" onClick={() => onChange({ ...field, color: "" })}>
                {tx(locale, "Reset", "Сбросить")}
              </Button>
            ) : null}
          </div>
        </Field>
        <div className="flex h-9 items-center justify-end sm:col-span-2 lg:col-span-1">
          <RowAction label={tx(locale, "Remove field", "Удалить поле")} icon={<Trash2 />} tone="danger" onClick={onRemove} />
        </div>
      </div>
      {field.type === "select" ? (
        <Field label={tx(locale, "Options", "Варианты")} htmlFor={`${id}-options`} hint={tx(locale, "Comma separated.", "Через запятую.")} className="mt-3">
          <Input
            id={`${id}-options`}
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
            placeholder={tx(locale, "Basic, Pro, Enterprise", "Базовый, Pro, Enterprise")}
          />
        </Field>
      ) : (
        <input type="hidden" name="field_options" value="" />
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 [&_label]:text-[13px]">
        <CheckboxInput name="field_required" value={index} defaultChecked={field.required}>{tx(locale, "Required", "Обязательное")}</CheckboxInput>
        <CheckboxInput name="field_bold" value={index} defaultChecked={field.bold}>{tx(locale, "Bold text", "Жирный текст")}</CheckboxInput>
        <CheckboxInput name="field_show" value={index} defaultChecked={field.showInTable}>{tx(locale, "Show in table", "Показывать в таблице")}</CheckboxInput>
        <CheckboxInput name="field_copyable" value={index} defaultChecked={field.copyable}>{tx(locale, "Click to copy", "Копировать по клику")}</CheckboxInput>
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  workspaceId,
  locale = "en",
  takenNames = [],
}: {
  category?: Category;
  workspaceId: number;
  locale?: Locale;
  /** Names already used by the workspace's other categories (lower-cased), to block duplicates before saving. */
  takenNames?: string[];
}) {
  const id = useId();
  const [fields, setFields] = useState<CategoryField[]>(category?.fields || []);
  const [name, setName] = useState(category?.name || "");
  const nameTaken = Boolean(name.trim()) && takenNames.includes(name.trim().toLowerCase());
  const [identifierField, setIdentifierField] = useState(
    () => category?.identifierField ?? defaultIdentifierField(category?.name, category?.fields || []),
  );
  const identifierValue = fields.some((field) => field.id === identifierField) ? identifierField : "";

  function updateField(index: number, field: CategoryField) {
    setFields((current) => current.map((candidate, candidateIndex) => (candidateIndex === index ? field : candidate)));
  }

  return (
    <form action={saveCategoryAction} className="grid gap-6">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem_8rem]">
        <Field
          label={tx(locale, "Name", "Название")}
          htmlFor={`${id}-name`}
          required
          error={nameTaken ? tx(locale, "A category with this name already exists.", "Категория с таким названием уже есть.") : undefined}
        >
          <Input
            id={`${id}-name`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameTaken || undefined}
            placeholder={tx(locale, "Category name", "Название категории")}
          />
        </Field>
        <Field label={tx(locale, "Icon", "Иконка")}>
          <IconPicker name="icon" defaultValue={category?.icon || "Sparkles"} locale={locale} />
        </Field>
        <Field label={tx(locale, "Colour", "Цвет")} htmlFor={`${id}-color`}>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-1.5">
            <ColorSwatch id={`${id}-color`} name="color" defaultValue={category?.color || "#38bdf8"} label={tx(locale, "Colour", "Цвет")} />
            <span className="text-xs text-zinc-500">{tx(locale, "Accent", "Акцент")}</span>
          </div>
        </Field>
      </div>

      <Fieldset legend={t(locale, "fields")}>
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
        {!fields.length ? (
          <p className="rounded-lg border border-dashed border-white/10 px-4 py-3 text-xs text-zinc-500">
            {tx(locale, "No custom fields yet.", "Дополнительных полей пока нет.")}
          </p>
        ) : null}
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setFields((current) => [...current, blankField(locale)])}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {tx(locale, "Add field", "Добавить поле")}
          </Button>
        </div>
      </Fieldset>

      <Fieldset
        legend={tx(locale, "Identifier", "Идентификатор")}
        description={tx(locale, "The field shown in the Identifier column of tables, such as a server IP or a domain name.", "Поле для столбца «Идентификатор» в таблицах: например, IP сервера или доменное имя.")}
      >
        <input type="hidden" name="identifierField" value={identifierValue} />
        <NativeSelect
          value={identifierValue}
          onChange={setIdentifierField}
          ariaLabel={tx(locale, "Identifier field", "Поле-идентификатор")}
          className="max-w-xs"
        >
          <option value="">{tx(locale, "None", "Нет")}</option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>{field.label || tx(locale, "Untitled field", "Поле без названия")}</option>
          ))}
        </NativeSelect>
      </Fieldset>

      <div className="flex justify-end border-t border-white/[0.06] pt-4">
        <Button type="submit" size="sm" disabled={nameTaken || !name.trim()}>
          {category ? <Save className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          {category ? tx(locale, "Save category", "Сохранить категорию") : t(locale, "createCategory")}
        </Button>
      </div>
    </form>
  );
}

export function CategoryManager({
  categories,
  workspaceId,
  locale = "en",
  initialSelected,
}: {
  categories: Category[];
  workspaceId: number;
  locale?: Locale;
  /** A category id, or "new" for the empty form; defaults to the first category. */
  initialSelected?: number | "new";
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | "new">(initialSelected ?? categories[0]?.id ?? "new");
  const current = selected === "new" ? undefined : categories.find((category) => category.id === selected);
  const creating = !current;
  const visibleCategories = categories.filter((category) =>
    fuzzyMatch(`${category.name} ${(category.fields || []).map((field) => field.label).join(" ")}`, query),
  );
  const newLabel = t(locale, "createCategory");

  return (
    <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch">
      <SectionCard flush className="flex min-h-[18rem] flex-col lg:min-h-0" bodyClassName="flex min-h-0 flex-1 flex-col">
        <TableToolbar
          className="flex-nowrap"
          end={
            <Tooltip label={newLabel}>
              <Button type="button" size="icon-sm" variant={creating ? "default" : "secondary"} aria-label={newLabel} aria-pressed={creating} onClick={() => setSelected("new")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Tooltip>
          }
        >
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            placeholder={t(locale, "searchCategories")}
            clearLabel={tx(locale, "Clear search", "Очистить поиск")}
            className="min-w-0 flex-1"
          />
        </TableToolbar>
        <Table bare fill>
          <TableHeader>
            <TableRow>
              <TableHead>{t(locale, "categories")}</TableHead>
              <TableHead align="right">{t(locale, "fields")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCategories.map((category) => (
              <TableRow
                key={category.id}
                interactive
                active={current?.id === category.id}
                tabIndex={0}
                onClick={() => setSelected(category.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(category.id);
                  }
                }}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400/40"
              >
                <TableCell primary>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CategoryMark category={category} />
                    <span className="truncate">{category.name}</span>
                  </span>
                </TableCell>
                <TableCell align="right" muted className="tabular-nums">
                  {(category.fields || []).length}
                </TableCell>
              </TableRow>
            ))}
            {!visibleCategories.length ? <TableEmpty colSpan={2} icon={<SearchX />} title={t(locale, "noCategoriesMatch")} /> : null}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title={current ? current.name : newLabel}
        description={current
          ? `${count(locale, (current.fields || []).length, { one: "field", other: "fields", ru: ["поле", "поля", "полей"] })} · ${t(locale, "created").toLowerCase()} ${displayDate(current.createdAt)}`
          : tx(locale, "A template with its own display fields and notification routes.", "Шаблон со своими полями и маршрутами уведомлений.")}
        className="flex min-h-0 flex-col"
        bodyClassName="min-h-0 flex-1 overflow-y-auto"
      >
        <CategoryForm
          key={current?.id ?? "new"}
          category={current}
          workspaceId={workspaceId}
          locale={locale}
          takenNames={categories.filter((candidate) => candidate.id !== current?.id).map((candidate) => candidate.name.trim().toLowerCase())}
        />
      </SectionCard>
    </div>
  );
}
