"use client";

/**
 * Compact select with the app's themed menu (Radix/shadcn Select), keeping the simple `<option>` API.
 * `onChange` receives the value string; `className` sizes the trigger wrapper. Empty-string values are allowed.
 *
 * @example
 * <NativeSelect value={status} onChange={setStatus} ariaLabel="Status" size="sm" className="w-40">
 *   <option value="all">All</option>
 * </NativeSelect>
 */
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Radix reserves "" for "no value"; empty options are stored under this key instead. */
const EMPTY = "__mc_empty__";
const toKey = (value: string) => (value === "" ? EMPTY : value);
const fromKey = (value: string) => (value === EMPTY ? "" : value);

type OptionData = { value: string; label: React.ReactNode; disabled?: boolean };

/** Flattens <option> children (through fragments, arrays and conditionals) into plain data. */
function readOptions(children: React.ReactNode): OptionData[] {
  const options: OptionData[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    if (child.type === React.Fragment) {
      options.push(...readOptions(props.children));
      return;
    }
    if (child.type !== "option") return;
    const label = props.children;
    const value = props.value !== undefined ? String(props.value) : typeof label === "string" ? label : "";
    options.push({ value, label, disabled: props.disabled });
  });
  return options;
}

export interface NativeSelectProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
  invalid?: boolean;
  /** sm = h-8 (toolbars, inline), md = h-9 (forms). */
  size?: "sm" | "md";
  className?: string;
  /** Extra classes for the trigger button. */
  selectClassName?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Open the menu on mount (inline editors). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const NativeSelect = React.forwardRef<HTMLButtonElement, NativeSelectProps>(
  ({ value, onChange, children, ariaLabel, invalid, size = "md", className, selectClassName, id, name, disabled, required, placeholder, defaultOpen, onOpenChange }, ref) => {
    const options = readOptions(children);
    return (
      <SelectPrimitive.Root value={toKey(value)} onValueChange={(next) => onChange(fromKey(next))} name={name} disabled={disabled} required={required} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex w-full min-w-0 items-center justify-between gap-2 border border-white/10 bg-white/[0.03] pl-2.5 pr-2 text-left text-foreground outline-none transition-colors hover:border-white/15 focus-visible:border-white/20 focus-visible:ring-2 focus-visible:ring-violet-400/25 data-[state=open]:border-white/20 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-zinc-500",
            size === "sm" ? "h-8 rounded-md text-[13px]" : "h-9 rounded-lg text-sm",
            invalid && "border-red-400/70 focus-visible:ring-red-400/30",
            className,
            selectClassName,
          )}
        >
          <span className="min-w-0 truncate">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            align="start"
            className="suggest-in relative z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-white/10 bg-[#18181c] text-zinc-100 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={toKey(option.value)}
                  value={toKey(option.value)}
                  disabled={option.disabled}
                  className="relative flex h-8 w-full cursor-default select-none items-center rounded-md pl-2 pr-7 text-[13px] text-zinc-300 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-white/[0.06] data-[state=checked]:text-zinc-50 data-[highlighted]:text-zinc-50 data-[disabled]:opacity-40"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                    <Check className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);
NativeSelect.displayName = "NativeSelect";
