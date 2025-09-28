"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useInterviewStore } from "@/lib/state"
import { formatDistanceToNow } from "date-fns"

function WelcomeBackModal() {
  const sessions = useInterviewStore((s) => s.sessions)
  const candidates = useInterviewStore((s) => s.candidates)
  const [open, setOpen] = useState(false)

  const inProgressOrPaused = useMemo(
    () => Object.values(sessions).filter((sess) => sess.status === "in-progress" || sess.status === "paused"),
    [sessions],
  )

  useEffect(() => {
    if (inProgressOrPaused.length > 0) {
      setOpen(true)
    }
  }, [inProgressOrPaused.length])

  const deleteSession = useInterviewStore((s) => s.deleteSession)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <Card className="w-full max-w-2xl bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-balance">Welcome back</CardTitle>
          <CardDescription>You have unfinished sessions. Resume, delete, or export before continuing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {inProgressOrPaused.map((sess) => {
              const cand = candidates[sess.candidateId]
              return (
                <div key={sess.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-pretty">
                      {cand?.name || "Unnamed Candidate"} · {sess.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Progress {sess.currentQuestionIndex}/6 · Updated{" "}
                      {formatDistanceToNow(new Date(sess.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href="/interviewee">
                      <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
                        Resume
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // Simple JSON export
                        const dataStr =
                          "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sess, null, 2))
                        const a = document.createElement("a")
                        a.href = dataStr
                        a.download = `${cand?.name || "candidate"}-session.json`
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                      }}
                    >
                      Export
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteSession(sess.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Page() {
  return (
    <main className="mx-auto my-16 max-w-5xl p-6">
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-balance text-4xl font-semibold">Swipe Internship — AI Interview Assistant</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Upload a resume, conduct a timed, structured interview with AI-generated questions, and review results on an
          interviewer dashboard. Fully local persistence with optional Gemini API integration.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/interviewee">
            <Button className="bg-primary text-primary-foreground hover:opacity-90">Start Interview</Button>
          </Link>
          <Link href="/interviewer">
            <Button variant="secondary">Open Dashboard</Button>
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidate experience</CardTitle>
            <CardDescription>Upload resume, answer six timed questions, get evaluated.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            - Resume parsing with local heuristics and optional Gemini help.
            <br />- Timers per difficulty: 20s / 60s / 120s with auto-submit.
            <br />- Pause/Resume and export session.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Interviewer dashboard</CardTitle>
            <CardDescription>Search, sort, and review detailed breakdowns.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            - Candidate list with score, progress, last activity.
            <br />- Full chat, per-question breakdown, and re-evaluate actions.
          </CardContent>
        </Card>
      </section>

      <Suspense>
        <WelcomeBackModal />
      </Suspense>
    </main>
  )
}
