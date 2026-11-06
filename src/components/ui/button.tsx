import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button. One Aurora `default` per view; everything else secondary / ghost / outline / accent / destructive.
 *
 * @example
 * <Button size="sm" variant="ghost"><Plus className="h-3.5 w-3.5" /> Add</Button>
 * <Button size="icon-sm" variant="ghost" aria-label="Close"><X className="h-4 w-4" /></Button>
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Aurora (globals.css): animated dark glass, the app's one primary style.
        default: "btn-aurora font-semibold",
        accent: "border border-violet-400/20 bg-violet-500/10 text-violet-100 hover:border-violet-400/30 hover:bg-violet-500/15",
        destructive:
          "border border-red-400/20 bg-red-500/10 text-red-100 hover:border-red-400/30 hover:bg-red-500/15",
        secondary:
          "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-zinc-50",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        outline:
          "border border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]",
      },
      size: {
        xs: "h-7 gap-1.5 rounded-md px-2 text-xs",
        sm: "h-8 gap-1.5 rounded-md px-2.5 text-xs",
        default: "h-9 px-3.5",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-xs": "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
