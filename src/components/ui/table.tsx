/**
 * Table primitives. The `.mc-table` CSS in globals.css owns row hover / selected / active backgrounds, so do not
 * put `bg-*` hover classes on rows or cells. Server-compatible (no hooks); pass handlers only from client components.
 *
 * @example
 * <SectionCard title="Entries" flush>
 *   <TableToolbar end={<Button size="sm">Add</Button>}>
 *     <SearchInput size="sm" value={q} onChange={setQ} placeholder="Search" className="max-w-sm flex-1" />
 *   </TableToolbar>
 *   <Table bare stickyHeader minWidth={960}>
 *     <TableHeader>
 *       <TableRow>
 *         <TableSelectHead checked={allState} onCheckedChange={toggleAll} label="Select all" />
 *         <TableHead sortable sorted={sort === "name" ? dir : false} onSort={() => sortBy("name")}>Name</TableHead>
 *         <TableHead align="right">Amount</TableHead>
 *         <TableHead align="right" className="w-[1%]"><span className="sr-only">Actions</span></TableHead>
 *       </TableRow>
 *     </TableHeader>
 *     <TableBody>
 *       {rows.map((row) => (
 *         <TableRow key={row.id} interactive selected={selected.has(row.id)} active={openId === row.id} onClick={() => open(row)}>
 *           <TableSelectCell checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} label={`Select ${row.name}`} />
 *           <TableCell primary>{row.name}</TableCell>
 *           <TableCell align="right" className="font-semibold text-zinc-100 tabular-nums">{row.amount}</TableCell>
 *           <TableCell align="right"><RowActions>…</RowActions></TableCell>
 *         </TableRow>
 *       ))}
 *       {!rows.length ? <TableEmpty colSpan={4} title="No entries" /> : null}
 *     </TableBody>
 *   </Table>
 *   <SelectionBar count={selected.size} onClear={clear} locale={locale}>…</SelectionBar>
 *   <TablePagination page={page} totalPages={pages} pageSize={size} total={rows.length} onPage={setPage} onPageSize={setSize} locale={locale} />
 * </SectionCard>
 */
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Checkbox, type CheckboxProps } from "./checkbox";
import { EmptyState } from "./empty-state";
import { NativeSelect } from "./native-select";

// Local copy of capture's tx(): that module is a client module, and this file must stay server-compatible.
function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

export type TableAlign = "left" | "center" | "right";

const ALIGN: Record<TableAlign, string> = { left: "text-left", center: "text-center", right: "text-right" };

/* ------------------------------------------------------------------------------------------------ Table */

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Drop the card frame (border, radius, bg) for tables that already sit inside a SectionCard/Surface. */
  bare?: boolean;
  /** compact = tighter body rows (py-1.5). */
  density?: "default" | "compact";
  /** Header cells stick to the top of the scroll container (give it a max height via `containerClassName`). */
  stickyHeader?: boolean;
  /** Minimum table width before the container scrolls horizontally, e.g. 1120 or "70rem". */
  minWidth?: number | string;
  /** Classes for the scroll container (e.g. `max-h-[70vh]`). */
  containerClassName?: string;
  /**
   * Fill the remaining height of a flex-column parent and scroll inside it (implies `stickyHeader`).
   * The page root needs `flex h-full min-h-0 flex-col`, and every wrapper down to the table `flex min-h-0 flex-1 flex-col`.
   */
  fill?: boolean;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, bare, density = "default", stickyHeader, minWidth, containerClassName, fill, style, ...props }, ref) => (
    <div className={cn("relative w-full overflow-auto", fill && "min-h-0 flex-1", !bare && "rounded-xl border border-white/[0.06] bg-surface", containerClassName)}>
      <table
        ref={ref}
        data-density={density}
        data-sticky-header={stickyHeader || fill ? "" : undefined}
        className={cn("mc-table w-full caption-bottom text-sm", density === "compact" && "[--mc-cell-py:0.375rem]", className)}
        style={minWidth !== undefined ? { minWidth, ...style } : style}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

/* ---------------------------------------------------------------------------------------- Sections */

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&>tr]:border-b [&>tr]:border-white/[0.06]", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("divide-y divide-white/[0.05]", className)} {...props} />,
);
TableBody.displayName = "TableBody";

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Stays at the bottom of the scroll container (totals under a `fill` table). */
  sticky?: boolean;
}

export const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, sticky, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        "border-t border-white/[0.06] bg-white/[0.015] font-medium text-zinc-300",
        sticky && "sticky bottom-0 z-10 [&>tr>td]:bg-surface [&>tr>th]:bg-surface",
        className,
      )}
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

/* --------------------------------------------------------------------------------------------- Row */

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** The row opens something on click: pointer cursor. */
  interactive?: boolean;
  /** Part of the current selection: violet wash. */
  selected?: boolean;
  /** The row whose drawer/details are open: violet wash + a 2px accent edge. */
  active?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, interactive, selected, active, ...props }, ref) => (
    <tr
      ref={ref}
      data-interactive={interactive ? "" : undefined}
      data-selected={selected ? "" : undefined}
      data-active={active ? "" : undefined}
      aria-selected={selected || undefined}
      className={cn("group", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

/* -------------------------------------------------------------------------------------------- Head */

export interface TableHeadProps extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "align" | "width"> {
  align?: TableAlign;
  /** Makes the whole header cell a sort toggle (with a focusable button inside for keyboards). */
  sortable?: boolean;
  sorted?: "asc" | "desc" | false;
  onSort?: () => void;
  /** CSS width, e.g. 160, "12rem" or "1%". */
  width?: number | string;
  sticky?: "left" | "right";
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, align = "left", sortable, sorted = false, onSort, width, sticky, style, onClick, children, ...props }, ref) => {
    const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
    return (
      <th
        ref={ref}
        scope="col"
        aria-sort={sortable ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}
        onClick={
          sortable
            ? (event) => {
                onClick?.(event);
                if (!event.defaultPrevented) onSort?.();
              }
            : onClick
        }
        style={width !== undefined ? { width, ...style } : style}
        className={cn(
          "h-9 whitespace-nowrap px-3 align-middle text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500 first:pl-4 last:pr-4",
          ALIGN[align],
          sortable && "cursor-pointer select-none transition-colors hover:text-zinc-300",
          sorted && "text-zinc-300",
          sticky === "left" && "sticky left-0 z-20 bg-surface",
          sticky === "right" && "sticky right-0 z-20 bg-surface",
          className,
        )}
        {...props}
      >
        {sortable ? (
          // No handler of its own: the click (or Enter/Space) bubbles to the <th>.
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
          >
            {children}
            <SortIcon className={cn("h-3 w-3 shrink-0", sorted ? "text-violet-300" : "opacity-50")} aria-hidden="true" />
          </button>
        ) : (
          children
        )}
      </th>
    );
  },
);
TableHead.displayName = "TableHead";

/* -------------------------------------------------------------------------------------------- Cell */

export interface TableCellProps extends Omit<React.TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: TableAlign;
  /** Dimmer text (zinc-500), for secondary columns. */
  muted?: boolean;
  /** Name-cell styling: font-medium text-zinc-100. */
  primary?: boolean;
  /** Pin the cell while scrolling horizontally. Carries bg-surface; the row hover still paints over it. */
  sticky?: "left" | "right";
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align, muted, primary, sticky, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-3 py-[var(--mc-cell-py,0.625rem)] align-middle text-[13px] text-zinc-400 first:pl-4 last:pr-4",
        align && ALIGN[align],
        muted && "text-zinc-500",
        primary && "font-medium text-zinc-100",
        sticky === "left" && "sticky left-0 z-[1] bg-surface",
        sticky === "right" && "sticky right-0 z-[1] bg-surface",
        className,
      )}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

/* --------------------------------------------------------------------------------- Selection column */

export interface TableSelectProps extends Omit<CheckboxProps, "aria-label"> {
  /** Accessible label, e.g. `Select ${row.name}` / "Select all". */
  label: string;
  sticky?: boolean;
  cellClassName?: string;
}

/** Header cell with the select-all checkbox (w-12; the following cell drops its left padding). */
export function TableSelectHead({ label, sticky, cellClassName, ...props }: TableSelectProps) {
  return (
    <TableHead data-select="" className={cn("w-12 min-w-12 max-w-12 pl-6 pr-2", cellClassName)} sticky={sticky ? "left" : undefined}>
      <span className="flex items-center">
        <Checkbox aria-label={label} {...props} />
      </span>
    </TableHead>
  );
}
TableSelectHead.displayName = "TableSelectHead";

/** Body cell with the row checkbox (w-12). Clicks on it never reach the row's onClick. */
export function TableSelectCell({ label, sticky, cellClassName, ...props }: TableSelectProps) {
  return (
    <TableCell data-select="" className={cn("w-12 min-w-12 max-w-12 pl-6 pr-2", cellClassName)} sticky={sticky ? "left" : undefined} onClick={(event) => event.stopPropagation()}>
      <span className="flex items-center">
        <Checkbox aria-label={label} {...props} />
      </span>
    </TableCell>
  );
}
TableSelectCell.displayName = "TableSelectCell";

/* ------------------------------------------------------------------------------------------- Empty */

export interface TableEmptyProps {
  colSpan: number;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function TableEmpty({ colSpan, icon, title, description, action, className }: TableEmptyProps) {
  return (
    <tr data-empty="">
      <td colSpan={colSpan} className="p-0">
        <EmptyState compact icon={icon} title={title} description={description} action={action} className={className} />
      </td>
    </tr>
  );
}
TableEmpty.displayName = "TableEmpty";

/* ----------------------------------------------------------------------------------------- Toolbar */

export interface TableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Right-aligned controls (primary action, view options). */
  end?: React.ReactNode;
}

export const TableToolbar = React.forwardRef<HTMLDivElement, TableToolbarProps>(({ className, end, children, ...props }, ref) => (
  <div ref={ref} className={cn("flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3", className)} {...props}>
    {children}
    {end ? <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div> : null}
  </div>
));
TableToolbar.displayName = "TableToolbar";

/* -------------------------------------------------------------------------------------- Pagination */

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizes?: number[];
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  total: number;
  locale: Locale;
  className?: string;
}

export function TablePagination({
  page,
  totalPages,
  pageSize,
  pageSizes = [10, 20, 50, 100],
  onPage,
  onPageSize,
  total,
  locale,
  className,
}: TablePaginationProps) {
  const pages = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), pages);
  const from = total ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(current * pageSize, total);
  const sizes = pageSizes.includes(pageSize) ? pageSizes : [...pageSizes, pageSize].sort((a, b) => a - b);
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5 text-xs text-zinc-500", className)}>
      <span className="tabular-nums">{tx(locale, `${from}–${to} of ${total}`, `${from}–${to} из ${total}`)}</span>
      <div className="flex items-center gap-3">
        {onPageSize ? (
          <label className="flex items-center gap-2">
            <span>{tx(locale, "Rows", "Строк")}</span>
            <NativeSelect
              size="sm"
              value={String(pageSize)}
              onChange={(value) => onPageSize(Number(value))}
              ariaLabel={tx(locale, "Rows per page", "Строк на странице")}
              className="w-[4.5rem]"
            >
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={current <= 1}
            onClick={() => onPage(current - 1)}
            aria-label={tx(locale, "Previous page", "Предыдущая страница")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-12 text-center tabular-nums text-zinc-400">
            {current} / {pages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={current >= pages}
            onClick={() => onPage(current + 1)}
            aria-label={tx(locale, "Next page", "Следующая страница")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
TablePagination.displayName = "TablePagination";

/* ----------------------------------------------------------------------------------- Selection bar */

export interface SelectionBarProps {
  count: number;
  onClear: () => void;
  locale: Locale;
  /** Bulk action buttons (size="sm"). */
  children?: React.ReactNode;
  className?: string;
}

/** Sticky bar at the bottom of the table card while rows are selected. Renders nothing when count is 0. */
export function SelectionBar({ count, onClear, locale, children, className }: SelectionBarProps) {
  if (count <= 0) return null;
  return (
    <div
      role="region"
      aria-label={tx(locale, "Selection actions", "Действия с выбранными")}
      className={cn(
        "suggest-in sticky bottom-0 z-20 flex shrink-0 flex-wrap items-center gap-3 border-t border-white/[0.06] bg-[#101013]/95 px-4 py-2.5 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-medium tabular-nums text-zinc-100" aria-live="polite">
          {tx(locale, `${count} selected`, `Выбрано: ${count}`)}
        </span>
        <span className="text-zinc-600" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded-sm text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
        >
          {tx(locale, "Clear", "Снять выбор")}
        </button>
      </div>
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
SelectionBar.displayName = "SelectionBar";
