import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function NativeSelect({
  value,
  onChange,
  children,
  ariaLabel,
  invalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block h-9 w-full", className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-full w-full appearance-none rounded-md border border-border bg-surface-muted py-1.5 pl-2.5 pr-8 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-focus-ring/50",
          invalid && "border-red-400/70 focus:ring-red-400/30",
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </span>
  );
}
