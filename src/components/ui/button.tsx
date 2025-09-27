import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive"
  size?: "sm" | "md"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
    const variants = {
      default: "bg-primary text-primary-foreground hover:opacity-90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
      destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
    }
    const sizes = { sm: "h-8 px-3", md: "h-9 px-4" }
    return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  },
)
Button.displayName = "Button"
