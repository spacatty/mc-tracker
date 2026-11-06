"use client";

/**
 * Toolbar filter dropdown in the segmented-control look (soft pill, no border), for filters that sit next to a
 * SegmentedControl/SegmentedLinks. Each option can carry an icon and a muted value on the right (a count, a total).
 *
 * @example
 * <FilterSelect
 *   ariaLabel="Period"
 *   value={period}
 *   onChange={setPeriod}
 *   options={[{ value: "7", label: "Next 7 days", meta: "$120.00" }, { value: "30", label: "Next 30 days", meta: "$410.00" }]}
 * />
 */
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterSelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Leading icon, shown in the menu and on the trigger. */
  icon?: React.ReactNode;
  /** Muted value on the right of the menu row. */
  meta?: React.ReactNode;
  /** A thin divider above this option. */
  separated?: boolean;
}

export interface FilterSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<FilterSelectOption<T>>;
  ariaLabel: string;
  /** Small label before the value on the trigger, e.g. "Period". */
  prefix?: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
}

export function FilterSelect<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  prefix,
  align = "end",
  className,
  contentClassName,
}: FilterSelectProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <SelectPrimitive.Root value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.04] pl-2.5 pr-2 text-xs font-medium text-zinc-200 outline-none transition hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-violet-400/40 data-[state=open]:bg-white/[0.08] data-[state=open]:text-white [&_svg]:shrink-0",
          className,
        )}
      >
        {prefix ? <span className="font-normal text-zinc-500">{prefix}</span> : null}
        {current?.icon ? <span className="inline-flex">{current.icon}</span> : null}
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          align={align}
          className={cn(
            "suggest-in relative z-50 max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[max(var(--radix-select-trigger-width),13rem)] overflow-hidden rounded-xl border border-white/10 bg-[#18181c] text-zinc-100 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]",
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <React.Fragment key={option.value}>
                {option.separated ? <SelectPrimitive.Separator className="-mx-1 my-1 h-px bg-white/[0.06]" /> : null}
                <SelectPrimitive.Item
                  value={option.value}
                  className="group relative flex h-8 cursor-default select-none items-center gap-2 rounded-md pl-2 pr-2 text-[13px] text-zinc-300 outline-none data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-zinc-50 data-[state=checked]:text-zinc-50"
                >
                  <span className="grid w-3.5 shrink-0 place-items-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  {option.icon ? <span className="inline-flex shrink-0">{option.icon}</span> : null}
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  {option.meta !== undefined ? (
                    <span className="ml-auto pl-6 text-xs tabular-nums text-zinc-500 group-data-[highlighted]:text-zinc-400">{option.meta}</span>
                  ) : null}
                </SelectPrimitive.Item>
              </React.Fragment>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
