import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium transition", {
  variants: {
    variant: {
      default: "bg-violet-500/10 text-violet-200 ring-1 ring-inset ring-violet-400/20",
      secondary: "bg-white/[0.04] text-zinc-400 ring-1 ring-inset ring-white/10",
      destructive: "bg-red-500/10 text-red-200 ring-1 ring-inset ring-red-400/20",
      success: "bg-emerald-500/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/20",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
