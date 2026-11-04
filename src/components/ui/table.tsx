import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement> & { bare?: boolean }>(
  ({ className, bare, ...props }, ref) => (
    // `bare` drops the frame for tables that already sit inside a Surface.
    <div className={cn("w-full overflow-auto", !bare && "rounded-xl border border-white/[0.08] bg-surface")}>
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("divide-y divide-white/[0.05]", className)} {...props} />,
);
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={cn("border-border transition-colors hover:bg-white/[0.02]", className)} {...props} />,
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <th ref={ref} className={cn("h-9 px-4 text-left align-middle font-semibold first:pl-5 last:pr-5", className)} {...props} />,
);
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn("px-4 py-2.5 align-middle text-[13px] text-zinc-400 first:pl-5 last:pr-5", className)} {...props} />,
);
TableCell.displayName = "TableCell";
