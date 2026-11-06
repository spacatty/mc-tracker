"use client";

/**
 * Checkbox (16px). Pass `checked="indeterminate"` for a partial selection (renders a Minus).
 *
 * @example
 * <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all" />
 */
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "group/checkbox peer inline-grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-white/20 bg-white/[0.02] text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-500 data-[state=indeterminate]:border-violet-500 data-[state=indeterminate]:bg-violet-500",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3 w-3 group-data-[state=indeterminate]/checkbox:hidden" strokeWidth={3} aria-hidden="true" />
        <Minus className="hidden h-3 w-3 group-data-[state=indeterminate]/checkbox:block" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = "Checkbox";
