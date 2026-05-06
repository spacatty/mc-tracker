import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition", {
  variants: {
    variant: {
      default: "bg-violet-500/15 text-violet-100 ring-1 ring-violet-400/20",
      secondary: "bg-white/[0.06] text-zinc-300 ring-1 ring-white/10",
      destructive: "bg-red-500/15 text-red-100 ring-1 ring-red-400/20",
      success: "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/20",
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
