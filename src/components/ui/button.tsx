import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
  {
    variants: {
      variant: {
        default: "bg-violet-500 text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400",
        destructive: "bg-red-500 text-white shadow-lg shadow-red-950/30 hover:bg-red-400",
        secondary: "border border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1]",
        ghost: "text-zinc-300 hover:bg-white/[0.08] hover:text-white",
        outline: "border border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.08]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6",
        icon: "h-10 w-10",
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
