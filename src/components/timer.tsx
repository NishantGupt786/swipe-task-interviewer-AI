"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export function Countdown({ seconds, warnAt = 10 }: { seconds: number; warnAt?: number }) {
  const [blink, setBlink] = useState(false)
  const prev = useRef<number>(seconds)

  useEffect(() => {
    if (seconds <= warnAt) {
      setBlink((b) => !b)
    } else {
      setBlink(false)
    }
    prev.current = seconds
  }, [seconds, warnAt])

  return (
    <div
      className={cn(
        "rounded-md px-3 py-1 text-sm",
        seconds <= 0 && "bg-red-600 text-white",
        seconds > 0 && seconds <= warnAt && (blink ? "bg-yellow-500 text-black" : "bg-yellow-300 text-black"),
        seconds > warnAt && "bg-muted text-foreground",
      )}
      aria-live="polite"
    >
      {Math.max(0, seconds)}s
    </div>
  )
}
