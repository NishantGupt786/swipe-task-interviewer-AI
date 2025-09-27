"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/", label: "Home" },
  { href: "/interviewee", label: "Interviewee" },
  { href: "/interviewer", label: "Interviewer" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div aria-hidden className="h-6 w-6 rounded bg-primary" />
            <span className="font-semibold">Swipe Interview</span>
          </div>
          <nav aria-label="Primary" className="flex items-center gap-1">
            {tabs.map((t) => {
              const active = pathname === t.href
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {t.label}
                </Link>
              )
            })}
          </nav>
          <div className="text-sm text-muted-foreground" aria-label="User settings">
            Settings
          </div>
        </div>
      </header>
      <div>{children}</div>
    </div>
  )
}
