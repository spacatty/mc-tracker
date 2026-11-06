import * as React from "react";
import { cva } from "class-variance-authority";
import { cn, softColor, softFill } from "@/lib/utils";

/**
 * Badge. Ghost (icon + coloured text, no fill) is the default; `outline` adds a hairline ring;
 * `tint` is a filled pill reserved for a few status signals (overdue, error, new).
 *
 * @example
 * <Badge color={category.color} icon={<AppIcon name={category.icon} />}>{category.name}</Badge>
 * <Badge variant="outline">{count} entries</Badge>
 * <Badge variant="tint" tone="danger">Overdue</Badge>
 */

export type BadgeVariant = "ghost" | "outline" | "tint";
export type BadgeTone = "default" | "accent" | "success" | "warning" | "danger" | "info";

const badgeVariants = cva("inline-flex max-w-full items-center gap-1.5 whitespace-nowrap text-xs font-medium leading-5 transition-colors", {
  variants: {
    variant: {
      ghost: "",
      outline: "rounded-md px-1.5 ring-1 ring-inset ring-white/10",
      tint: "rounded-md px-1.5 ring-1 ring-inset",
    },
    tone: {
      default: "",
      accent: "",
      success: "",
      warning: "",
      danger: "",
      info: "",
    },
  },
  compoundVariants: [
    { variant: ["ghost", "outline"], tone: "default", className: "text-zinc-300" },
    { variant: ["ghost", "outline"], tone: "accent", className: "text-violet-300" },
    { variant: ["ghost", "outline"], tone: "success", className: "text-emerald-300" },
    { variant: ["ghost", "outline"], tone: "warning", className: "text-amber-300" },
    { variant: ["ghost", "outline"], tone: "danger", className: "text-red-300" },
    { variant: ["ghost", "outline"], tone: "info", className: "text-sky-300" },
    { variant: "tint", tone: "default", className: "bg-white/[0.06] text-zinc-200 ring-white/10" },
    { variant: "tint", tone: "accent", className: "bg-violet-500/10 text-violet-200 ring-violet-400/20" },
    { variant: "tint", tone: "success", className: "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20" },
    { variant: "tint", tone: "warning", className: "bg-amber-500/10 text-amber-200 ring-amber-400/20" },
    { variant: "tint", tone: "danger", className: "bg-red-500/10 text-red-200 ring-red-400/20" },
    { variant: "tint", tone: "info", className: "bg-sky-500/10 text-sky-200 ring-sky-400/20" },
  ],
  defaultVariants: {
    variant: "ghost",
    tone: "default",
  },
});

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  /** Category colour (any CSS colour). Drives the text colour, plus the ring/fill for outline/tint. */
  color?: string | null;
  /** Leading icon; sized to 12px. */
  icon?: React.ReactNode;
}

function colorStyle(variant: BadgeVariant, color: string): React.CSSProperties {
  const text = softColor(color);
  if (variant === "ghost") return { color: text };
  const ring = `inset 0 0 0 1px ${softFill(color, 28)}`;
  if (variant === "outline") return { color: text, boxShadow: ring };
  return { color: text, boxShadow: ring, backgroundColor: softFill(color, 12) };
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "ghost", tone = "default", color, icon, style, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, tone }), className)}
      style={color ? { ...colorStyle(variant, color), ...style } : style}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0 [&_svg]:size-3" aria-hidden="true">{icon}</span> : null}
      {typeof children === "string" || typeof children === "number" ? <span className="truncate">{children}</span> : children}
    </span>
  ),
);
Badge.displayName = "Badge";

export { badgeVariants };
