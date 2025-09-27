import type * as React from "react"
import { cn } from "@/lib/utils"

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-border bg-muted/50 p-4 text-sm", className)} {...props} />
}
