import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "cn"
import { Slot } from "radix-ui"

// Pill buttons from the approved artifact: 52px primary CTA, 44px minimum touch target. `inverse` is the aqua
// CTA for dark surfaces (hero cards); never put it on a light background.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled-foreground disabled:border-transparent aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed",
        outline: "border-primary bg-card text-primary hover:bg-secondary",
        secondary: "bg-secondary text-primary hover:bg-secondary-hover",
        neutral: "border-border bg-card text-foreground hover:bg-muted",
        destructive: "bg-danger-solid text-white hover:bg-danger",
        "destructive-soft": "bg-danger-bg text-danger hover:bg-danger-solid/10",
        inverse: "bg-cta text-cta-foreground hover:bg-cta-hover active:bg-cta-pressed",
        ghost: "text-primary hover:bg-secondary",
        link: "h-auto! px-0! text-link underline-offset-4 hover:underline",
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
