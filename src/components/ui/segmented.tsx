/**
 * Segmented pill groups. `SegmentedControl` switches local state (radio group, arrow keys move between options);
 * `SegmentedLinks` is the same look for URL-driven filters (server-safe, renders next/link).
 *
 * @example
 * <SegmentedControl
 *   ariaLabel="Status"
 *   value={status}
 *   onChange={setStatus}
 *   options={[{ value: "all", label: "All", count: 42 }, { value: "overdue", label: "Overdue", count: 3 }]}
 * />
 * <SegmentedLinks ariaLabel="Period" value={period}
 *   options={[{ value: "month", label: "Month", href: "?period=month" }, { value: "year", label: "Year", href: "?period=year" }]} />
 */
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type SegmentedSize = "sm" | "md";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedLinkOption<T extends string = string> extends Omit<SegmentedOption<T>, "disabled"> {
  href: string;
}

const groupClass = "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-white/[0.04] p-0.5";

function itemClass(active: boolean, size: SegmentedSize) {
  return cn(
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0",
    size === "sm" ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-xs",
    active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-zinc-200",
  );
}

function ItemContent({ option, active }: { option: SegmentedOption | SegmentedLinkOption; active: boolean }) {
  return (
    <>
      {option.icon}
      {option.label}
      {option.count !== undefined ? (
        <span className={cn("text-[11px] tabular-nums", active ? "text-zinc-300" : "text-zinc-500")}>{option.count}</span>
      ) : null}
    </>
  );
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  size?: SegmentedSize;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const enabled = options.filter((option) => !option.disabled);
    if (!enabled.length) return;
    const current = enabled.indexOf(options[index]);
    const next = enabled[(current + step + enabled.length) % enabled.length];
    onChange(next.value);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[role=radio]");
    buttons?.[options.indexOf(next)]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn(groupClass, className)}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            data-state={active ? "on" : "off"}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={itemClass(active, size)}
          >
            <ItemContent option={option} active={active} />
          </button>
        );
      })}
    </div>
  );
}
SegmentedControl.displayName = "SegmentedControl";

export interface SegmentedLinksProps<T extends string = string> {
  value: T;
  options: ReadonlyArray<SegmentedLinkOption<T>>;
  size?: SegmentedSize;
  ariaLabel: string;
  className?: string;
  /** Passed to every link (e.g. keep scroll position on filter changes). */
  scroll?: boolean;
}

export function SegmentedLinks<T extends string = string>({ value, options, size = "md", ariaLabel, className, scroll }: SegmentedLinksProps<T>) {
  return (
    <nav aria-label={ariaLabel} className={cn(groupClass, className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Link
            key={option.value}
            href={option.href}
            scroll={scroll}
            aria-current={active ? "page" : undefined}
            data-state={active ? "on" : "off"}
            className={itemClass(active, size)}
          >
            <ItemContent option={option} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
SegmentedLinks.displayName = "SegmentedLinks";
