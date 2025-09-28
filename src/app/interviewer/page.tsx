"use client";

import { useState, useMemo } from "react";
import { useInterviewStore } from "@/lib/state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InterviewerPage() {
  const candidates = useInterviewStore((s) => s.candidates);
  const sessions = useInterviewStore((s) => s.sessions);
  const reEvaluate = useInterviewStore((s) => s.reEvaluateSession);
  const deleteSession = useInterviewStore((s) => s.deleteSession);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return Object.values(sessions).map((sess) => {
      const cand = candidates[sess.candidateId];
      const avg =
        sess.evaluations.length > 0
          ? sess.evaluations.reduce((a, e) => a + e.score, 0) /
            sess.evaluations.length
          : 0;
      return {
        id: sess.id,
        name: cand?.name || "Unnamed",
        email: cand?.email || "",
        phone: cand?.phone || "",
        status: sess.status,
        score: avg.toFixed(1),
        progress: `${sess.currentQuestionIndex}/6`,
      };
    });
  }, [candidates, sessions]);

  const selectedSession = selectedId ? sessions[selectedId] : null;
  const selectedCand = selectedSession
    ? candidates[selectedSession.candidateId]
    : null;

  return (
    <main className="mx-auto max-w-7xl p-4 grid gap-6 md:grid-cols-12">
      <Card className="md:col-span-7">
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>A list of all interview sessions</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedId(row.id)}
                >
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.score}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.progress}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="md:col-span-5">
        <CardHeader>
          <CardTitle>Candidate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedSession && (
            <div>Select a candidate to view their report</div>
          )}
          {selectedSession && selectedCand && (
            <>
              <div>
                <div className="font-medium">{selectedCand.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedCand.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedCand.phone}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Overall Score</div>
                <div className="text-2xl font-bold">
                  {(
                    selectedSession.evaluations.reduce(
                      (a, e) => a + e.score,
                      0
                    ) / (selectedSession.evaluations.length || 1)
                  ).toFixed(1)}{" "}
                  / 10
                </div>
                {selectedSession.finalReport && (
                  <div className="space-y-2">
                    <div className="text-lg font-bold">
                      Final Score: {selectedSession.finalReport.finalScore} /
                      100
                    </div>
                    <div className="text-sm">
                      {selectedSession.finalReport.summary}
                    </div>
                    <div className="font-medium">
                      Recommendation:{" "}
                      {selectedSession.finalReport.recommendation}
                    </div>
                    <div className="space-y-1">
                      {selectedSession.finalReport.perQuestionScores.map(
                        (p) => {
                          const q = selectedSession.questionSequence.find(
                            (q) => q.id === p.questionId
                          );
                          return (
                            <div key={p.questionId} className="text-sm">
                              {q?.text} → {p.score}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {selectedSession.answers.map((ans) => {
                  const ev = selectedSession.evaluations.find(
                    (e) => e.answerId === ans.id
                  );
                  const q = selectedSession.questionSequence.find(
                    (q) => q.id === ans.questionId
                  );
                  return (
                    <div key={ans.id} className="rounded border p-2">
                      <div className="font-medium">Q: {q?.text}</div>
                      <div className="text-sm text-muted-foreground">
                        A: {ans.text}
                      </div>
                      {ev && (
                        <div className="mt-1 text-sm">
                          <span className="font-medium">Score:</span> {ev.score}{" "}
                          / 10
                          <br />
                          <span className="font-medium">Feedback:</span>{" "}
                          {ev.feedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-3">
                <Button onClick={() => reEvaluate(selectedSession.id)}>
                  Re-evaluate
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteSession(selectedSession.id)}
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
