"use client";

import { useEffect, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Rows3, SlidersHorizontal } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { tx } from "./capture/shared";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/*
 * Table settings, saved in localStorage the moment they change:
 * - the app-wide table look lives on <html data-table-style>, so every table (entries, dashboard, archive, admin)
 *   restyles from globals.css without prop plumbing;
 * - the entries table's column order and visibility, read through `useEntryColumns()` + `arrangeColumns()`.
 */

export type TableStyle = "current" | "sheet";

/** Column ids the entries table knows; category fields use `field:<fieldId>`. */
export type EntryColumnsConfig = { order: string[]; hidden: string[] };
export type ColumnOption = { id: string; label: string };

const STYLE_KEY = "mc-tracker-table-style";
const COLUMNS_KEY = "mc-tracker-entry-columns";
const STYLES: TableStyle[] = ["current", "sheet"];
const CHANGE_EVENT = "mc-table-config";
/** Category shows as an icon before the name by default; its column is opt-in. */
const DEFAULT_COLUMNS: EntryColumnsConfig = { order: [], hidden: ["category"] };

function readStyle(): TableStyle {
  try {
    const stored = localStorage.getItem(STYLE_KEY) as TableStyle | null;
    return stored && STYLES.includes(stored) ? stored : "current";
  } catch {
    return "current";
  }
}

function readColumns(): EntryColumnsConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(COLUMNS_KEY) || "null") as Partial<EntryColumnsConfig> & { category?: boolean } | null;
    if (!stored) return DEFAULT_COLUMNS;
    // Earlier saves were `{ category: boolean }`.
    if (!Array.isArray(stored.order) && !Array.isArray(stored.hidden)) {
      return { order: [], hidden: stored.category ? [] : ["category"] };
    }
    return { order: Array.isArray(stored.order) ? stored.order : [], hidden: Array.isArray(stored.hidden) ? stored.hidden : [] };
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function applyStyle(style: TableStyle) {
  if (style === "current") delete document.documentElement.dataset.tableStyle;
  else document.documentElement.dataset.tableStyle = style;
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the choice still applies for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Applies the saved style on load; mounted once in the app shell. */
export function TableStyleSync() {
  useEffect(() => {
    applyStyle(readStyle());
  }, []);
  return null;
}

/** The saved entry column order and visibility (defaults until mounted, so server and first client render agree). */
export function useEntryColumns(): EntryColumnsConfig {
  const [columns, setColumns] = useState<EntryColumnsConfig>(DEFAULT_COLUMNS);
  useEffect(() => {
    const sync = () => setColumns(readColumns());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);
  return columns;
}

/** Orders the columns available in the current view by the saved order; columns never placed keep their default spot. */
export function arrangeColumns<T extends ColumnOption>(available: T[], config: EntryColumnsConfig): Array<T & { visible: boolean }> {
  const rank = new Map(config.order.map((id, index) => [id, index]));
  const defaults = new Map(available.map((column, index) => [column.id, index]));
  return [...available]
    .sort((a, b) => {
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra === undefined && rb === undefined) return (defaults.get(a.id) ?? 0) - (defaults.get(b.id) ?? 0);
      // One saved, one new: keep the new column next to its default neighbours.
      return (defaults.get(a.id) ?? 0) - (defaults.get(b.id) ?? 0);
    })
    .map((column) => ({ ...column, visible: !config.hidden.includes(column.id) }));
}

function styleLabel(style: TableStyle, locale: Locale) {
  if (style === "sheet") return tx(locale, "Sheet", "Сетка");
  return tx(locale, "Default", "Обычный");
}

function styleHint(style: TableStyle, locale: Locale) {
  if (style === "sheet") return tx(locale, "Gridlines, compact rows", "Сетка, компактные строки");
  return tx(locale, "Default spacing and dividers", "Обычные отступы и линии");
}

function SortableColumn({ column, onToggle, dragLabel }: { column: ColumnOption & { visible: boolean }; onToggle: (visible: boolean) => void; dragLabel: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md pl-1 pr-2 text-[13px] transition-colors hover:bg-white/[0.04]",
        isDragging && "relative z-10 bg-[#202026] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${dragLabel}: ${column.label}`}
        className="grid h-6 w-5 cursor-grab place-items-center rounded text-zinc-600 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <Checkbox checked={column.visible} onCheckedChange={(checked) => onToggle(checked === true)} />
        <span className={cn("truncate", column.visible ? "text-zinc-200" : "text-zinc-500")}>{column.label}</span>
      </label>
    </li>
  );
}

/**
 * The "Table" button: style plus, when `columns` is given, the entries columns (drag to reorder, tick to show).
 * Name, selection and actions are fixed and not listed.
 */
export function TableStyleSelect({ locale, columns }: { locale: Locale; columns?: ColumnOption[] }) {
  const config = useEntryColumns();
  const arranged = columns ? arrangeColumns(columns, config) : [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function saveColumns(next: EntryColumnsConfig) {
    save(COLUMNS_KEY, JSON.stringify(next));
  }

  /** Saves the full order of every column ever seen, so columns from other category views keep their place. */
  function reorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = arranged.map((column) => column.id);
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const others = config.order.filter((id) => !moved.includes(id));
    saveColumns({ ...config, order: [...moved, ...others] });
  }

  function toggle(id: string, visible: boolean) {
    const hidden = new Set(config.hidden);
    if (visible) hidden.delete(id);
    else hidden.add(id);
    saveColumns({ ...config, hidden: [...hidden] });
  }

  const hiddenCount = arranged.filter((column) => !column.visible).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-zinc-300 data-[state=open]:bg-white/[0.06] data-[state=open]:text-zinc-100" aria-label={tx(locale, "Table settings", "Настройки таблицы")}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {tx(locale, "Table", "Таблица")}
          {hiddenCount ? (
            <span className="rounded bg-white/[0.07] px-1.5 py-px text-[10.5px] font-medium tabular-nums leading-4 text-zinc-400">
              {tx(locale, `${hiddenCount} hidden`, `скрыто: ${hiddenCount}`)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 overflow-hidden rounded-xl border-white/10 bg-[#18181c] p-0">
        {arranged.length ? (
          <div className="p-1">
            <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{tx(locale, "Columns", "Столбцы")}</p>
              <button
                type="button"
                onClick={() => saveColumns(DEFAULT_COLUMNS)}
                className="inline-flex items-center gap-1 rounded px-1 text-[11px] text-zinc-500 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                {tx(locale, "Reset", "Сбросить")}
              </button>
            </div>
            <DndContext id="entry-columns" sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
              <SortableContext items={arranged.map((column) => column.id)} strategy={verticalListSortingStrategy}>
                <ul className="max-h-72 overflow-y-auto">
                  {arranged.map((column) => (
                    <SortableColumn
                      key={column.id}
                      column={column}
                      onToggle={(visible) => toggle(column.id, visible)}
                      dragLabel={tx(locale, "Move column", "Переместить столбец")}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <p className="px-2 pb-1.5 pt-1 text-[11px] leading-4 text-zinc-500">
              {tx(locale, "Drag to reorder. With Category hidden, its icon shows before the name.", "Перетащите, чтобы изменить порядок. Без столбца «Категория» её иконка стоит перед названием.")}
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Table style switch for the profile menu, next to the language switch. Applies to every table in the app. */
export function TableStyleToggle({ locale }: { locale: Locale }) {
  const [style, setStyle] = useState<TableStyle>("current");
  useEffect(() => {
    const sync = () => setStyle(readStyle());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);
  function choose(next: TableStyle) {
    applyStyle(next);
    setStyle(next);
    save(STYLE_KEY, next);
  }
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5">
      <span className="flex items-center gap-2 text-[13px] text-zinc-300">
        <Rows3 className="h-3.5 w-3.5 text-zinc-500" />
        {tx(locale, "Tables", "Таблицы")}
      </span>
      <span className="inline-flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
        {STYLES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            aria-pressed={style === option}
            title={styleHint(option, locale)}
            className={cn(
              "h-6 rounded-md px-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
              style === option ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {styleLabel(option, locale)}
          </button>
        ))}
      </span>
    </div>
  );
}
