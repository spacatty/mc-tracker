import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition", {
  variants: {
    variant: {
      default: "bg-accent/15 text-violet-100 ring-1 ring-accent/25",
      secondary: "bg-surface-raised text-muted-foreground ring-1 ring-border",
      destructive: "bg-destructive/15 text-red-100 ring-1 ring-destructive/25",
      success: "bg-success/15 text-success-foreground ring-1 ring-success/25",
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
