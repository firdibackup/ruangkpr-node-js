import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "cn"
import { Slot } from "radix-ui"

// Pill buttons from the approved artifact: 52px primary CTA, 44px minimum touch target.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:bg-border disabled:text-ink-3 disabled:border-transparent aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-dark",
        outline: "border-primary bg-card text-primary hover:bg-secondary",
        secondary: "bg-secondary text-primary hover:bg-[#dbe6f8]",
        neutral: "border-border bg-card text-foreground hover:bg-muted",
        destructive: "bg-brand-red text-white hover:bg-danger-strong",
        "destructive-soft": "bg-danger-bg text-danger-strong hover:bg-[#fbdde1]",
        inverse: "bg-card text-primary hover:bg-secondary",
        ghost: "text-primary hover:bg-secondary",
        link: "h-auto! px-0! text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-13 px-7",
        md: "h-12 px-6",
        sm: "h-11 px-5",
        xs: "h-10 px-4 text-[13px]",
        icon: "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(asChild ? {} : { type: props.type ?? "button" })}
      {...props} />
  );
}

export { Button, buttonVariants }
