"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Checkbox } from "./checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export function CheckboxInput({
  name,
  value = "on",
  defaultChecked = false,
  children,
  id,
}: {
  name: string;
  value?: string | number;
  defaultChecked?: boolean;
  children?: ReactNode;
  id?: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300">
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => setChecked(next === true)} />
      {checked ? <input type="hidden" name={name} value={String(value)} /> : null}
      {children}
    </label>
  );
}

export function SelectInput({
  name,
  defaultValue,
  options,
  placeholder = "Select",
  onValueChange,
  triggerClassName,
  triggerId,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: ReactNode }>;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  triggerClassName?: string;
  triggerId?: string;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue || options[0]?.value || "");

  function handleValueChange(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger id={triggerId} aria-label={ariaLabel} className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
