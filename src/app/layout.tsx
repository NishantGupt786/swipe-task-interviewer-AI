import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AppShell } from "@/components/app-shell"
import { Suspense } from "react"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Swipe Task - AI Interviewer",
  description: "AI-powered technical interview platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <AppShell>{children}</AppShell>
        </Suspense>
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  )
}
