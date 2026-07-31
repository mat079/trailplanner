import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tp-sage)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[var(--tp-forest-mid)] to-[var(--tp-forest-light)] text-white shadow-[0_4px_14px_rgba(45,138,88,0.35)] hover:from-[var(--tp-forest-light)] hover:to-[var(--tp-sage)] hover:shadow-[0_4px_20px_rgba(45,138,88,0.5)] hover:-translate-y-0.5",
        destructive:
          "bg-[rgba(239,68,68,0.15)] text-[var(--tp-red)] border border-[rgba(239,68,68,0.25)] hover:bg-[rgba(239,68,68,0.25)]",
        outline:
          "border border-[var(--tp-border)] bg-[var(--tp-glass)] text-[var(--tp-text)] hover:bg-[var(--tp-glass-hover)]",
        secondary:
          "bg-[var(--tp-forest-mid)] text-white hover:bg-[var(--tp-forest-light)]",
        ghost:
          "bg-[var(--tp-glass)] text-[var(--tp-text)] border border-[var(--tp-border)] hover:bg-[var(--tp-glass-hover)]",
        link: "text-[var(--tp-sage)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
