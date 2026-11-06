/**
 * Empty state. Default: a dashed panel for empty pages/sections. `compact`: borderless, for inside tables/lists.
 *
 * @example
 * <EmptyState icon={<Inbox />} title="No invoices yet" description="Invoices appear when you mark a payment as paid." />
 * <EmptyState compact icon={<Search />} title="Nothing matches" action={<Button size="sm" variant="ghost">Clear filters</Button>} />
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** For use inside tables and lists: smaller, no dashed border or fill. */
  compact?: boolean;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, compact, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "min-h-40 px-6 py-8"
          : "min-h-56 rounded-lg border border-dashed border-white/10 bg-surface-muted px-6 py-10",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-500",
            compact ? "mb-3 size-9 [&_svg]:size-4" : "mb-4 size-10 [&_svg]:size-5",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h2 className={cn("font-semibold text-zinc-100", compact ? "text-sm" : "text-base")}>{title}</h2>
      {description ? (
        <p className={cn("mt-1.5 max-w-md text-zinc-500", compact ? "text-xs leading-5" : "text-[13px] leading-6")}>{description}</p>
      ) : null}
      {action ? <div className={cn("flex flex-wrap items-center justify-center gap-2", compact ? "mt-4" : "mt-5")}>{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
