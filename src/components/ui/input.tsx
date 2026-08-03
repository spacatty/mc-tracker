import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-subtle-foreground hover:border-border-strong focus:border-border-strong focus:ring-2 focus:ring-focus-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        type === "color" && "h-10 cursor-pointer rounded-full p-1",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full resize-y rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-subtle-foreground hover:border-border-strong focus:border-border-strong focus:ring-2 focus:ring-focus-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
