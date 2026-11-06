/**
 * Text inputs. `Input` / `Textarea` are plain styled controls; `SearchInput` is the table-toolbar search
 * with a leading icon, a clear button when non-empty, and Escape-to-clear.
 *
 * @example
 * <Input id="name" name="name" defaultValue={entry.name} />
 * <SearchInput value={query} onChange={setQuery} placeholder="Search entries" size="sm" className="max-w-sm flex-1" />
 */
import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground hover:border-white/15 focus:border-white/20 focus:ring-2 focus:ring-violet-400/25 disabled:cursor-not-allowed disabled:opacity-50";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn("flex h-9 px-3 py-2", fieldBase, type === "color" && "h-10 cursor-pointer rounded-full p-1", className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea className={cn("flex min-h-24 resize-y px-3 py-2", fieldBase, className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size" | "type"> {
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  /** Accessible label for the clear button. */
  clearLabel?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, size = "md", className, clearLabel = "Clear search", placeholder, onKeyDown, ...props }, ref) => (
    <div className={cn("relative w-full min-w-0", className)}>
      <Search
        className={cn("pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500", size === "sm" ? "left-2.5" : "left-3")}
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={props["aria-label"] ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === "Escape" && value && !event.defaultPrevented) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
        className={cn(
          fieldBase,
          "flex pr-8 [&::-webkit-search-cancel-button]:hidden",
          size === "sm" ? "h-8 pl-8 text-[13px]" : "h-9 pl-9",
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={(event) => {
            onChange("");
            event.currentTarget.parentElement?.querySelector("input")?.focus();
          }}
          className="absolute right-1.5 top-1/2 inline-grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
