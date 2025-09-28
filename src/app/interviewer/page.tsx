"use client";

import type React from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { useMemo, useState } from "react";
import { useInterviewStore } from "@/lib/state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function InterviewerPage() {
  const candidates = useInterviewStore((s) => s.candidates);
  const sessions = useInterviewStore((s) => s.sessions);
  const reEvaluate = useInterviewStore((s) => s.reEvaluateSession);
  const deleteSession = useInterviewStore((s) => s.deleteSession);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    return Object.values(sessions).map((sess: any) => {
      const cand = candidates[sess.candidateId];
      const avg =
        sess.evaluations.length > 0
          ? sess.evaluations.reduce((a: number, e: any) => a + e.score, 0) /
            sess.evaluations.length
          : 0;
      return {
        id: sess.id,
        name: cand?.name || "Unnamed",
        email: cand?.email || "",
        status: sess.status,
        score: avg,
        progress: `${sess.currentQuestionIndex}/${
          (sess.questionSequence || []).length || 6
        }`,
      };
    });
  }, [candidates, sessions]);

  const filtered = rows.filter((r) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const selectedSession = selectedId ? (sessions as any)[selectedId] : null;
  const selectedCand = selectedSession
    ? (candidates as any)[selectedSession.candidateId]
    : null;
  const overall =
    selectedSession && selectedSession.evaluations.length > 0
      ? (
          selectedSession.evaluations.reduce(
            (a: number, e: any) => a + e.score,
            0
          ) / selectedSession.evaluations.length
        ).toFixed(1)
      : "—";

  // PDF generation handler with robust toasts
  async function handleDownloadPdf() {
    if (!selectedSession || !selectedCand) {
      toast.error("No session selected.");
      return;
    }

    try {
      toast.message("Generating PDF report...");

      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const margin = 40;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const line = 18;
      let y = margin;

      const ensureSpace = (extra = 0) => {
        if (y > pageHeight - margin - extra) {
          doc.addPage();
          y = margin;
        }
      };

      const textBlock = (txt: string, size = 11, bold = false) => {
        ensureSpace();
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const lines = doc.splitTextToSize(txt, contentWidth);
        lines.forEach((ln: string) => {
          ensureSpace();
          doc.text(ln, margin, y);
          y += line;
        });
      };

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Interview Session Report", margin, y);
      y += line * 1.2;

      // Candidate and session meta
      textBlock(`Candidate: ${selectedCand.name || "Unnamed"}`, 12, true);
      textBlock(`Email: ${selectedCand.email || "—"}`);
      textBlock(`Session ID: ${selectedSession.id}`);
      textBlock(`Status: ${selectedSession.status}`);
      const avg =
        selectedSession.evaluations.length > 0
          ? selectedSession.evaluations.reduce(
              (a: number, e: any) => a + e.score,
              0
            ) / selectedSession.evaluations.length
          : 0;
      textBlock(`Overall (avg): ${avg.toFixed(1)} / 10`);
      const totalQs = (selectedSession.questionSequence || []).length || 6;
      textBlock(`Progress: ${selectedSession.currentQuestionIndex}/${totalQs}`);
      y += line * 0.5;

      // Final report (if available)
      if (selectedSession.finalReport) {
        ensureSpace(line);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Final Evaluation", margin, y);
        y += line;

        const fr = selectedSession.finalReport;
        textBlock(`Final Score: ${fr.finalScore} / 100`, 12, true);
        if (fr.summary) textBlock(`Summary: ${fr.summary}`);
        if (fr.recommendation)
          textBlock(`Recommendation: ${fr.recommendation}`);

        if (
          Array.isArray(fr.perQuestionScores) &&
          fr.perQuestionScores.length > 0
        ) {
          y += line * 0.5;
          textBlock("Per-question Scores:", 12, true);
          fr.perQuestionScores.forEach((p: any, idx: number) => {
            const q = (selectedSession.questionSequence || []).find(
              (qq: any) => qq.id === p.questionId
            );
            textBlock(`Q${idx + 1}: ${q?.text || "—"}`);
            textBlock(`Score: ${p.score}`);
            y += line * 0.3;
          });
        }

        y += line * 0.5;
      }

      // Answers & Feedback
      ensureSpace(line);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Answers & Feedback", margin, y);
      y += line;

      const answers = selectedSession.answers || [];
      answers.forEach((ans: any, idx: number) => {
        const q = (selectedSession.questionSequence || []).find(
          (qq: any) => qq.id === ans.questionId
        );
        const ev = (selectedSession.evaluations || []).find(
          (e: any) => e.answerId === ans.id
        );

        textBlock(`Q${idx + 1}: ${q?.text || "—"}`, 12, true);
        if (ans?.text) textBlock(`Answer: ${ans.text}`);
        if (ev) {
          textBlock(`Score: ${ev.score} / 10`);
          if (ev.feedback) textBlock(`Feedback: ${ev.feedback}`);
        }
        y += line * 0.5;
      });

      const safeName = (selectedCand.name || "Candidate").replace(/\s+/g, "_");
      const filename = `${safeName}-session-${selectedSession.id}.pdf`;
      doc.save(filename);
      toast.success("PDF downloaded.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF.");
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 md:grid-cols-12">
      {/* Left: Sessions table */}
      <section className="md:col-span-7">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-balance">Interview Sessions</CardTitle>
              <CardDescription>
                Browse and select a session to view details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, or status"
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Avg Score</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setSelectedId(row.id)}
                    aria-selected={selectedId === row.id}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="truncate">{row.email}</TableCell>
                    <TableCell>
                      <Button
                        variant={
                          row.status === "completed"
                            ? "default"
                            : row.status === "paused"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {row.status}
                      </Button>
                    </TableCell>
                    <TableCell>{Number(row.score).toFixed(1)} / 10</TableCell>
                    <TableCell>{row.progress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Right: Detail panel */}
      <section className="md:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-balance">Session Details</CardTitle>
            <CardDescription>
              Select a session to see a detailed breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedSession || !selectedCand ? (
              <div className="text-muted-foreground">No session selected.</div>
            ) : (
              <>
                {/* Candidate header */}
                <div className="flex flex-col gap-1">
                  <div className="text-lg font-semibold">
                    {selectedCand.name || "Unnamed"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedCand.email}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Stat title="Overall" value={`${overall} / 10`} />
                  <Stat
                    title="Status"
                    value={
                      <Button
                        variant={
                          selectedSession.status === "completed"
                            ? "default"
                            : selectedSession.status === "paused"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {selectedSession.status}
                      </Button>
                    }
                  />
                  <Stat
                    title="Progress"
                    value={`${selectedSession.currentQuestionIndex}/${
                      (selectedSession.questionSequence || []).length || 6
                    }`}
                  />
                </div>

                <Separator />

                {/* Final report */}
                {selectedSession.finalReport ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Final Evaluation</div>
                    <div className="text-2xl font-bold">
                      {selectedSession.finalReport.finalScore} / 100
                    </div>
                    <div className="text-sm">
                      {selectedSession.finalReport.summary}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Recommendation:</span>{" "}
                      {selectedSession.finalReport.recommendation}
                    </div>
                    {/* <div className="grid grid-cols-1 gap-2">
                      {selectedSession.finalReport.perQuestionScores?.map(
                        (p: any, idx: number) => {
                          const q = selectedSession.questionSequence.find(
                            (qq: any) => qq.id === p.questionId
                          );
                          return (
                            <div
                              key={p.questionId}
                              className="rounded-md border p-2"
                            >
                              <div className="text-sm font-medium">
                                Q{idx + 1}: {q?.text}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Score: {p.score}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div> */}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No final report available.
                  </div>
                )}

                <Separator />

                {/* Answers + feedback */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Answers & Feedback</div>
                  <div className="space-y-2">
                    {selectedSession.answers.map((ans: any, idx: number) => {
                      const ev = selectedSession.evaluations.find(
                        (e: any) => e.answerId === ans.id
                      );
                      const q = selectedSession.questionSequence.find(
                        (qq: any) => qq.id === ans.questionId
                      );
                      return (
                        <div key={ans.id} className="rounded-md border p-3">
                          <div className="text-sm font-semibold">
                            Q{idx + 1}: {q?.text}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            A: {ans.text}
                          </div>
                          {ev && (
                            <div className="mt-2 text-sm">
                              <span className="font-medium">Score:</span>{" "}
                              {ev.score} / 10
                              <br />
                              <span className="font-medium">
                                Feedback:
                              </span>{" "}
                              {ev.feedback}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {/* Download PDF action */}
                  <Button
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={!selectedSession || !selectedCand}
                  >
                    Download PDF
                  </Button>

                  <Button
                    onClick={async () => {
                      if (!selectedSession) return;
                      try {
                        toast.message("Re-evaluating session...");
                        await reEvaluate(selectedSession.id);
                        toast.success("Session re-evaluated.");
                      } catch (e: any) {
                        toast.error(
                          e?.message || "Failed to re-evaluate session."
                        );
                      }
                    }}
                  >
                    Re-evaluate
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!selectedSession) return;
                      try {
                        toast.message("Deleting session...");
                        await deleteSession(selectedSession.id);
                        setSelectedId(null);
                        toast.success("Session deleted.");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to delete session.");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
