"use client";

/**
 * Switch: an on/off toggle (role="switch"). Controlled via `checked` + `onCheckedChange`, or uncontrolled via
 * `defaultChecked`. With `name` it also submits "on" in a native form (server actions), like a checkbox.
 *
 * @example
 * <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Email reminders" />
 * <Switch name="premium" defaultChecked={user.premium} aria-label="Premium" />
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultChecked" | "type"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** When set, a hidden input submits `value` (default "on") while the switch is on. */
  name?: string;
  value?: string;
  size?: "sm" | "md";
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, defaultChecked = false, onCheckedChange, name, value = "on", size = "md", className, disabled, onClick, ...props }, ref) => {
    const [internal, setInternal] = React.useState(defaultChecked);
    const isOn = checked ?? internal;
    return (
      <>
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={isOn}
          data-state={isOn ? "checked" : "unchecked"}
          disabled={disabled}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            if (checked === undefined) setInternal(!isOn);
            onCheckedChange?.(!isOn);
          }}
          className={cn(
            "group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent bg-white/[0.08] transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-violet-500/70 data-[state=checked]:hover:bg-violet-500/80",
            size === "sm" ? "h-4 w-7" : "h-5 w-9",
            className,
          )}
          {...props}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none block rounded-full bg-zinc-200 shadow-sm transition-transform translate-x-0.5",
              size === "sm" ? "h-3 w-3 group-data-[state=checked]/switch:translate-x-3" : "h-4 w-4 group-data-[state=checked]/switch:translate-x-4",
            )}
          />
        </button>
        {name && isOn ? <input type="hidden" name={name} value={value} /> : null}
      </>
    );
  },
);
Switch.displayName = "Switch";
