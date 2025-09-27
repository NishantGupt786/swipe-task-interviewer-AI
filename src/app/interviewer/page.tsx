"use client";

import { useMemo, useState } from "react";
import { useInterviewStore } from "@/lib/state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowDownUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "score" | "last" | "name";

export default function InterviewerPage() {
  const candidates = useInterviewStore((s) => s.candidates);
  const sessions = useInterviewStore((s) => s.sessions);
  const reEvaluate = useInterviewStore((s) => s.reEvaluateSession);
  const deleteSession = useInterviewStore((s) => s.deleteSession);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const rows = useMemo(() => {
    const list = Object.values(sessions).map((sess) => {
      const cand = candidates[sess.candidateId];
      const finalEval = sess.evaluations.length
        ? sess.evaluations.reduce((acc, e) => acc + e.score, 0) /
          sess.evaluations.length
        : 0;
      return {
        id: sess.id,
        name: cand?.name || "Unnamed",
        email: cand?.email || "",
        score: Math.round((finalEval / 10) * 100),
        status: sess.status,
        progress: `${sess.currentQuestionIndex}/6`,
        last: new Date(sess.updatedAt).getTime(),
      };
    });

    const filtered = list.filter(
      (r) =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.email.toLowerCase().includes(query.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "last") return b.last - a.last;
      return a.name.localeCompare(b.name);
    });

    return sorted;
  }, [sessions, candidates, query, sortBy]);

  const selectedSession = selected ? sessions[selected] : null;
  const selectedCand = selectedSession
    ? candidates[selectedSession.candidateId]
    : null;

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-7">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Candidates</CardTitle>
                <CardDescription>
                  Search, sort, and review candidates
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    setSortBy((prev) =>
                      prev === "score"
                        ? "last"
                        : prev === "last"
                        ? "name"
                        : "score"
                    )
                  }
                  aria-label="Toggle sort"
                >
                  <ArrowDownUp className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <div className="grid grid-cols-6 px-2 pb-2 text-xs text-muted-foreground">
                <div className="col-span-2">Name</div>
                <div>Email</div>
                <div>Score</div>
                <div>Status</div>
                <div>Progress</div>
              </div>
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={cn(
                    "grid w-full grid-cols-6 items-center gap-2 px-2 py-3 text-left hover:bg-accent",
                    selected === r.id && "bg-accent"
                  )}
                >
                  <div className="col-span-2 truncate font-medium">
                    {r.name}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {r.email}
                  </div>
                  <div>{r.score}</div>
                  <div className="text-sm">{r.status}</div>
                  <div className="text-sm">{r.progress}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Candidate Details</CardTitle>
              <CardDescription>Overview and actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedSession && (
                <div className="text-sm text-muted-foreground">
                  Select a candidate session from the list.
                </div>
              )}
              {selectedSession && selectedCand && (
                <>
                  <div className="grid gap-1">
                    <div className="text-sm text-muted-foreground">Name</div>
                    <div className="font-medium">{selectedCand.name}</div>
                  </div>
                  <div className="grid gap-1">
                    <div className="text-sm text-muted-foreground">Email</div>
                    <div className="font-medium">{selectedCand.email}</div>
                  </div>
                  <div className="grid gap-1">
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <div className="font-medium">{selectedCand.phone}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      className="bg-primary text-primary-foreground"
                      onClick={() => reEvaluate(selectedSession.id)}
                    >
                      Re-evaluate
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteSession(selectedSession.id)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete session
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
