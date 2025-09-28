"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInterviewStore } from "@/lib/state";
import { postJson } from "@/lib/net";
import { Countdown } from "@/components/timer";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { Mic, Square, Volume2 } from "lucide-react";

const DEFAULT_SEQUENCE = [
  { difficulty: "easy", seconds: 20 },
  { difficulty: "easy", seconds: 20 },
  { difficulty: "medium", seconds: 60 },
  { difficulty: "medium", seconds: 60 },
  { difficulty: "hard", seconds: 120 },
  { difficulty: "hard", seconds: 120 },
] as const;

function SessionChooser({
  sessions,
  candidates,
  onChoose,
  onNew,
  title = "Resume or Start New",
  description = "Select a session to open, or start a fresh interview.",
}: {
  sessions: ReturnType<typeof useInterviewStore.getState>["sessions"];
  candidates: ReturnType<typeof useInterviewStore.getState>["candidates"];
  onChoose: (sessionId: string) => void;
  onNew: () => void;
  title?: string;
  description?: string;
}) {
  const sorted = useMemo(
    () =>
      Object.values(sessions).sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [sessions]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <Card className="w-full max-w-2xl bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No sessions yet. Start a new session to begin.
            </div>
          ) : (
            sorted.map((sess) => {
              const cand = candidates[sess.candidateId];
              return (
                <div
                  key={sess.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {cand?.name || "Unnamed Candidate"} · {sess.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Progress {sess.currentQuestionIndex}/6 · Updated{" "}
                      {formatDistanceToNow(new Date(sess.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:opacity-90"
                      onClick={() => onChoose(sess.id)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onNew}>
              Start New Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PrivacyConsent({ candidateId }: { candidateId: string }) {
  const candidate = useInterviewStore((s) => s.candidates[candidateId]);
  const updateCandidate = useInterviewStore((s) => s.updateCandidate);

  const open = !candidate?.privacyConsent?.geminiParsing;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
      <Card className="max-w-lg bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Privacy consent</CardTitle>
          <CardDescription>
            We can parse your resume locally. If you opt-in, we may send your
            resume text to our AI service (Gemini) for better extraction. You
            can continue without opting in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              updateCandidate(candidateId, {
                privacyConsent: { geminiParsing: false, evaluation: false },
              });
            }}
          >
            Continue locally
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => {
              updateCandidate(candidateId, {
                privacyConsent: { geminiParsing: true, evaluation: true },
              });
            }}
          >
            I consent
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ResumeCard() {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const sessions = useInterviewStore((s) => s.sessions);
  const candidates = useInterviewStore((s) => s.candidates);
  const session = currentSessionId ? sessions[currentSessionId] : undefined;
  const candidate = session ? candidates[session.candidateId] : undefined;
  const updateCandidate = useInterviewStore((s) => s.updateCandidate);
  const generateNextQuestion = useInterviewStore((s) => s.generateNextQuestion);
  const setSessionInProgress = useInterviewStore((s) => s.setSessionInProgress);

  const [resumeText, setResumeText] = useState(candidate?.resumeText || "");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const [uploadParsing, setUploadParsing] = useState(false);
  const [startingInterview, setStartingInterview] = useState(false);

  async function extractFromUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/parse-upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload parse failed");
    const data = await res.json();
    return data as { ok: boolean; text: string };
  }

  function localExtract(text: string) {
    const emailMatch =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null;
    const phoneMatch = text.match(/(\+?\d[\d\s\-().]{6,}\d)/)?.[0] ?? null;
    const firstLine =
      text
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) || null;
    return { name: firstLine, email: emailMatch, phone: phoneMatch };
  }

  if (!candidate || !session) return null;

  const hasFinalReport = !!session.finalReport;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Profile</CardTitle>
        <CardDescription>Resume parsing and fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* {hasFinalReport && (
          <div className="rounded-lg border bg-accent/30 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium">
                  Final Evaluation Ready
                </div>
                <div className="text-xs text-muted-foreground">
                  Download a polished report or the raw JSON.
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={() => {}}
                >
                  Download PDF
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const dataStr =
                      "data:text/json;charset=utf-8," +
                      encodeURIComponent(
                        JSON.stringify(session.finalReport, null, 2)
                      );
                    const a = document.createElement("a");
                    a.href = dataStr;
                    a.download = `${
                      candidate.name || "candidate"
                    }-final-report.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  Download JSON
                </Button>
              </div>
            </div>
          </div>
        )} */}

        <div className="grid gap-2">
          <label className="text-sm">Resume file</label>
          <div className="flex gap-2">
            <Input
              type="file"
              ref={fileInput}
              accept=".pdf,.docx,.txt"
              disabled={uploadParsing}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !candidate) return;
                updateCandidate(candidate.id, { resumeFilename: file.name });
                setUploadParsing(true);
                try {
                  const { ok, text } = await extractFromUpload(file);
                  setResumeText(text || "");
                  if (!ok && candidate.privacyConsent?.geminiParsing) {
                    const parsed = await postJson("/api/parse-resume", {
                      resumeText: text || "",
                      candidateId: candidate.id,
                    });
                    updateCandidate(candidate.id, {
                      name: parsed.name ?? candidate.name,
                      email: parsed.email ?? candidate.email,
                      phone: parsed.phone ?? candidate.phone,
                      resumeText: text || "",
                    });
                  } else {
                    const local = localExtract(text || "");
                    updateCandidate(candidate.id, {
                      ...local,
                      resumeText: text || "",
                    });
                  }
                } catch {
                  toast.error(
                    "Failed to parse resume. Try another file or paste text."
                  );
                } finally {
                  setUploadParsing(false);
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              disabled={uploadParsing}
            >
              {uploadParsing ? "Parsing..." : "Replace"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm">Resume text</label>
          <Textarea
            rows={6}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste resume text here for quick parsing..."
            disabled={uploadParsing}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm">Name</label>
            <Input
              value={candidate.name ?? ""}
              onChange={(e) =>
                updateCandidate(candidate.id, { name: e.target.value })
              }
              placeholder="Full name"
              disabled={uploadParsing}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Email</label>
            <Input
              value={candidate.email ?? ""}
              onChange={(e) =>
                updateCandidate(candidate.id, { email: e.target.value })
              }
              placeholder="email@example.com"
              type="email"
              disabled={uploadParsing}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm">Phone</label>
            <Input
              value={candidate.phone ?? ""}
              onChange={(e) =>
                updateCandidate(candidate.id, { phone: e.target.value })
              }
              placeholder="+1 555 555 5555"
              disabled={uploadParsing}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="bg-primary text-primary-foreground"
            disabled={startingInterview || uploadParsing}
            onClick={async () => {
              if (!candidate) return;
              if (!candidate.name || !candidate.email || !candidate.phone) {
                setShowProfileDialog(true);
                return;
              }
              try {
                setStartingInterview(true);
                await setSessionInProgress(session.id);
                useInterviewStore.setState({ currentSessionId: session.id });
                await generateNextQuestion(session.id);
              } catch {
                toast.error("Unable to start interview. Try again.");
              } finally {
                setStartingInterview(false);
              }
            }}
          >
            {startingInterview ? "Starting..." : "Start interview"}
          </Button>

          {!hasFinalReport && (
            <Button
              variant="secondary"
              onClick={() => {
                const filename = `${
                  candidate.name || "candidate"
                }-session.json`;
                const dataStr =
                  "data:text/json;charset=utf-8," +
                  encodeURIComponent(JSON.stringify(session, null, 2));
                const a = document.createElement("a");
                a.href = dataStr;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              disabled={startingInterview || uploadParsing}
            >
              Export Session
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete your details</DialogTitle>
            <DialogDescription>
              We need your name, email, and phone number before starting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={candidate?.name ?? ""}
                onChange={(e) =>
                  updateCandidate(candidate!.id, { name: e.target.value })
                }
                placeholder="Jane Doe"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={candidate?.email ?? ""}
                onChange={(e) =>
                  updateCandidate(candidate!.id, { email: e.target.value })
                }
                placeholder="jane@example.com"
                type="email"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={candidate?.phone ?? ""}
                onChange={(e) =>
                  updateCandidate(candidate!.id, { phone: e.target.value })
                }
                placeholder="+1 555 555 5555"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (
                  !candidate?.name ||
                  !candidate?.email ||
                  !candidate?.phone
                ) {
                  toast.error("Please fill all fields.");
                  return;
                }
                setShowProfileDialog(false);
                try {
                  setStartingInterview(true);
                  await setSessionInProgress(session!.id);
                  useInterviewStore.setState({ currentSessionId: session!.id });
                  await generateNextQuestion(session!.id);
                } finally {
                  setStartingInterview(false);
                }
              }}
              className="bg-primary text-primary-foreground"
              disabled={startingInterview}
            >
              {startingInterview ? "Continuing..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InterviewStage({ blocked }: { blocked?: boolean }) {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const getCurrentQuestion = useInterviewStore((s) => s.getCurrentQuestion);
  const submitAnswer = useInterviewStore((s) => s.submitAnswer);
  const currentQuestion = currentSessionId
    ? getCurrentQuestion(currentSessionId)
    : undefined;

  // submitting state declared before any return
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // local countdown (TTL)
  const [remaining, setRemaining] = useState<number | null>(null);
  const tickRef = useRef<number | null>(null);

  // TTS
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastSpokenKeyRef = useRef<string | null>(null);

  // Recording + transcripts + volume
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [speechSupported, setSpeechSupported] = useState(false);

  async function startSpeaking(text: string) {
    if (!text.trim()) return;
    // stop any existing first
    stopSpeaking();

    setTtsLoading(true);
    setIsSpeaking(false);
    const controller = new AbortController();
    ttsAbortRef.current = controller;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("TTS request failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        audioRef.current = null;
      };
      await audio.play();
      setIsSpeaking(true);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Unable to generate speech audio.");
      }
    } finally {
      setTtsLoading(false);
    }
  }

  function stopSpeaking() {
    try {
      ttsAbortRef.current?.abort();
    } catch {}
    ttsAbortRef.current = null;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }

  useEffect(() => {
    if (blocked) {
      stopSpeaking();
      return;
    }
    if (currentQuestion && autoSpeak) {
      const key = `${currentQuestion.index}:${currentQuestion.text}`;
      if (lastSpokenKeyRef.current !== key) {
        lastSpokenKeyRef.current = key;
        startSpeaking(currentQuestion.text);
      }
    }
  }, [blocked, autoSpeak, currentQuestion]);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  const finalRef = useRef("");
  const interimRef = useRef("");
  useEffect(() => {
    finalRef.current = finalTranscript;
  }, [finalTranscript]);
  useEffect(() => {
    interimRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    // clear any existing
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // guard
    if (!currentQuestion || blocked) {
      setRemaining(null);
      return;
    }

    const idx = currentQuestion.index ?? 0;
    const seconds = DEFAULT_SEQUENCE[idx]?.seconds ?? 60;
    setRemaining(seconds);

    tickRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          // on TTL end: stop record/speak, submit once
          if (!submitLockRef.current) {
            submitLockRef.current = true;
            (async () => {
              try {
                stopRecording();
                stopSpeaking();
                const textToSubmit = (
                  finalRef.current +
                  " " +
                  interimRef.current
                )
                  .trim()
                  .replace(/\s+/g, " ")
                  .trim();
                if (currentSessionId && currentQuestion) {
                  await submitAnswer(currentSessionId, textToSubmit, true);
                }
                setFinalTranscript("");
                setInterimTranscript("");
              } catch {
                // ignore
              } finally {
                // unlock slightly later so next question can set its own lock
                setTimeout(() => {
                  submitLockRef.current = false;
                }, 50);
              }
            })();
          }
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [currentSessionId, currentQuestion, blocked]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // volume analyser
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVolume(Math.min(rms / 50, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // speech recognition
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SR) {
        const recog = new SR();
        recog.lang = "en-US";
        recog.continuous = true;
        recog.interimResults = true;

        recog.onstart = () => setIsRecording(true);

        recog.onresult = (e: any) => {
          let interim = "";
          let final = "";

          for (let i = e.resultIndex; i < e.results.length; i++) {
            const piece = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              final += piece + " ";
            } else {
              interim += piece;
            }
          }

          if (final) {
            setFinalTranscript((prev) => (prev ? prev + " " + final : final));
            setInterimTranscript("");
          } else {
            setInterimTranscript(interim);
          }
        };

        recog.onerror = () =>
          toast.error("Microphone error. Please check permissions.");
        recog.onend = () => setIsRecording(false);

        recognitionRef.current = recog;
        recog.start();
      } else {
        setIsRecording(true);
        toast.message(
          "Recording audio. Browser will not transcribe automatically."
        );
      }
    } catch {
      toast.error("Unable to access microphone.");
    }
  }

  function stopRecording() {
    try {
      recognitionRef.current?.stop?.();
      setIsRecording(false);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setVolume(0);
    } catch {
      // ignore
    }
  }

  if (!session || !currentQuestion || blocked) {
    return (
      <div
        className="flex min-h-[240px] flex-col items-center justify-center gap-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-end gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.2s]" />
          <span className="h-3 w-3 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.1s]" />
          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" />
        </div>
        <div className="text-center text-sm text-muted-foreground">
          Evaluating answer and generating next question…
        </div>
        <span className="sr-only">Processing next question</span>
      </div>
    );
  }

  const combinedTranscript = (finalTranscript + " " + interimTranscript)
    .trim()
    .replace(/\s+/g, " ")
    .trim();

  return (
    <main className="mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Question {currentQuestion.index + 1} / 6</span>
            <div className="flex items-center gap-3">
              <Countdown seconds={remaining ?? 0} warnAt={10} />
            </div>
          </CardTitle>
          <CardDescription className="text-pretty">
            {currentQuestion.text}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={autoSpeak ? "default" : "secondary"}
              disabled={ttsLoading}
              onClick={() => {
                const next = !autoSpeak;
                setAutoSpeak(next);
                if (!next) {
                  stopSpeaking();
                } else {
                  startSpeaking(currentQuestion.text);
                }
              }}
            >
              <Volume2 className="mr-2 h-4 w-4" />
              {ttsLoading
                ? "Loading audio..."
                : autoSpeak
                ? isSpeaking
                  ? "Speaking On"
                  : "Speaking Ready"
                : "Speak Question"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                stopSpeaking();
                setAutoSpeak(false);
              }}
              disabled={ttsLoading && !isSpeaking}
            >
              Stop Speaking
            </Button>
          </div>

          {/* Recorder + mic button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
                isRecording
                  ? "bg-red-600 text-white"
                  : "bg-primary text-primary-foreground"
              }`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              disabled={submitting}
            >
              {isRecording ? (
                <Square className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>

            <div className="flex-1">
              {isRecording && (
                <div className="w-full h-3 mb-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-3 rounded bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all"
                    style={{ width: `${volume * 100}%` }}
                  />
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {isRecording
                  ? "Recording — edit transcript below"
                  : "Press mic to record answer"}
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div className="relative">
            <Textarea
              rows={6}
              value={finalTranscript}
              onChange={(e) => setFinalTranscript(e.target.value)}
              placeholder="Speak your answer, then edit if needed. Press Ctrl/Cmd+Enter to submit."
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  (async () => {
                    if (submitting || submitLockRef.current) return;
                    try {
                      setSubmitting(true);
                      submitLockRef.current = true;
                      if (tickRef.current) {
                        clearInterval(tickRef.current);
                        tickRef.current = null;
                      }
                      stopRecording();
                      stopSpeaking();
                      await submitAnswer(session.id, combinedTranscript, false);
                      setFinalTranscript("");
                      setInterimTranscript("");
                    } catch {
                      // ignore
                    } finally {
                      setSubmitting(false);
                      setTimeout(() => {
                        submitLockRef.current = false;
                      }, 50);
                    }
                  })();
                }
              }}
              disabled={submitting}
            />
            {interimTranscript && (
              <div className="absolute bottom-3 left-4 pointer-events-none text-muted-foreground text-sm opacity-75">
                {interimTranscript}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setFinalTranscript("");
                setInterimTranscript("");
              }}
              disabled={submitting}
            >
              Clear
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={submitting || combinedTranscript.length === 0}
              onClick={async () => {
                if (submitting || submitLockRef.current) return;
                try {
                  setSubmitting(true);
                  submitLockRef.current = true;
                  if (tickRef.current) {
                    clearInterval(tickRef.current);
                    tickRef.current = null;
                  }
                  stopRecording();
                  stopSpeaking();
                  await submitAnswer(session.id, combinedTranscript, false);
                  setFinalTranscript("");
                  setInterimTranscript("");
                } catch {
                  // ignore
                } finally {
                  setSubmitting(false);
                  setTimeout(() => {
                    submitLockRef.current = false;
                  }, 50);
                }
              }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ChatTimeline() {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const getChatTimeline = useInterviewStore((s) => s.getChatTimeline);
  const chat = currentSessionId ? getChatTimeline(currentSessionId) : [];

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            Questions and evaluations appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
        <CardDescription>
          Timeline of questions, answers, and evaluations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chat.map((item) => {
          if (item.type === "question") {
            return (
              <div key={item.id} className="rounded-md bg-primary/10 p-3">
                <div className="text-sm text-muted-foreground">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </div>
                <div className="font-medium">{item.text}</div>
                <div className="text-xs opacity-80 pt-2">
                  Difficulty: {item.difficulty}
                </div>
              </div>
            );
          }
          if (item.type === "answer") {
            return (
              <div
                key={item.id}
                className="rounded-md border border-border p-3"
              >
                <div className="text-sm text-muted-foreground">
                  {new Date(item.submittedAt).toLocaleTimeString()} ·{" "}
                  {item.timeTakenSeconds}s
                </div>
                <div className="whitespace-pre-wrap">{item.text}</div>
                {item.autoSubmitted && (
                  <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-300">
                    Auto-submitted
                  </div>
                )}
              </div>
            );
          }
          if (item.type === "evaluation") {
            return (
              <div key={item.id} className="rounded-md p-3 bg-green-900/20">
                <div className="text-sm text-muted-foreground">
                  Evaluated {new Date(item.evaluatedAt).toLocaleTimeString()}
                </div>
                <div className="font-medium">
                  Score: {item.score.toFixed(1)} / 10
                </div>
                <div className="text-sm text-pretty">{item.feedback}</div>
              </div>
            );
          }
          return null;
        })}
      </CardContent>
    </Card>
  );
}

function PauseAndEnd() {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const pauseSession = useInterviewStore((s) => s.pauseSession);
  const endSession = useInterviewStore((s) => s.endSession);
  const setSessionInProgress = useInterviewStore((s) => s.setSessionInProgress);
  const [pausing, setPausing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [resuming, setResuming] = useState(false);

  if (!session) return null;
  const status = session.status;

  return (
    <>
      {status === "in-progress" && (
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              setPausing(true);
              await pauseSession(session.id);
              toast.message("Interview paused");
            } finally {
              setPausing(false);
            }
          }}
          disabled={pausing || ending || resuming}
        >
          {pausing ? "Pausing..." : "Pause"}
        </Button>
      )}

      {status === "paused" && (
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              setResuming(true);
              await setSessionInProgress(session.id);
              toast.message("Resuming interview");
            } finally {
              setResuming(false);
            }
          }}
          disabled={pausing || ending || resuming}
        >
          {resuming ? "Resuming..." : "Resume"}
        </Button>
      )}

      <Button
        variant="destructive"
        onClick={async () => {
          try {
            setEnding(true);
            await endSession(session.id);
            toast.message("Interview ended");
          } finally {
            setEnding(false);
          }
        }}
        disabled={pausing || ending || resuming}
      >
        {ending ? "Ending..." : "End Interview"}
      </Button>
    </>
  );
}

function createFinalReportPdfDoc(
  session: any,
  candidate: any,
  timeline: any[],
  jsPDFCtor = jsPDF
) {
  const doc = new jsPDFCtor({ unit: "pt" });
  const margin = 48;
  let y = margin;

  const title = "Interview Final Report";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const meta = [
    `Candidate: ${candidate?.name ?? "Unknown"}`,
    `Email: ${candidate?.email ?? "-"}`,
    `Phone: ${candidate?.phone ?? "-"}`,
    `Session ID: ${session.id}`,
    `Completed At: ${new Date(session.updatedAt).toLocaleString()}`,
  ];
  meta.forEach((line) => {
    doc.text(line, margin, y);
    y += 18;
  });
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Summary", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");

  const summaryText =
    typeof session.finalReport?.summary === "string"
      ? session.finalReport.summary
      : JSON.stringify(session.finalReport?.summary ?? {}, null, 2);

  const summaryLines = doc.splitTextToSize(summaryText, 540);
  if (y + summaryLines.length * 16 > 760) {
    doc.addPage();
    y = margin;
  }
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 16 + 16;

  doc.setFont("helvetica", "bold");
  doc.text("Per-Question Details", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");

  let currentQ: string | null = null;
  let currentA: string | null = null;

  for (const item of timeline) {
    if (item.type === "question") {
      currentQ = item.text;
      currentA = null;
    } else if (item.type === "answer") {
      currentA = item.text;
    } else if (item.type === "evaluation") {
      const score =
        typeof item.score === "number" ? item.score.toFixed(1) : "-";
      const feedback = item.feedback ?? "-";
      const qLines = doc.splitTextToSize(`Q: ${currentQ ?? "-"}`, 540);
      const aLines = doc.splitTextToSize(`A: ${currentA ?? "-"}`, 540);
      const sLines = doc.splitTextToSize(`Score: ${score} / 10`, 540);
      const fLines = doc.splitTextToSize(`Feedback: ${feedback}`, 540);

      const blockHeight =
        (qLines.length + aLines.length + sLines.length + fLines.length) * 16 +
        12;
      if (y + blockHeight > 760) {
        doc.addPage();
        y = margin;
      }
      doc.text(qLines, margin, y);
      y += qLines.length * 16;
      doc.text(aLines, margin, y);
      y += aLines.length * 16;
      doc.text(sLines, margin, y);
      y += sLines.length * 16;
      doc.text(fLines, margin, y);
      y += fLines.length * 16 + 12;
    }
  }
  return doc;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export default function IntervieweePage() {
  const boot = useInterviewStore((s) => s.bootIfNeeded);
  const createSession = useInterviewStore((s) => s.createSession);

  const sessions = useInterviewStore((s) => s.sessions);
  const candidates = useInterviewStore((s) => s.candidates);
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const inProgress = !!session?.status && session.status === "in-progress";

  const pause = useInterviewStore((s) => s.pauseSession);
  const setInProgress = useInterviewStore((s) => s.setSessionInProgress);
  const getChatTimeline = useInterviewStore((s) => s.getChatTimeline);

  const [entryChoiceOpen, setEntryChoiceOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const initializedRef = useRef(false);
  const pausedDueToNavRef = useRef(false);

  function downloadFinalReportPdf() {
    const currentSessionId = useInterviewStore.getState().currentSessionId;
    if (!currentSessionId) return;
    const s = useInterviewStore.getState();
    const session = s.sessions[currentSessionId];
    if (!session?.finalReport) return;
    const candidate = s.candidates[session.candidateId];
    const timeline = s.getChatTimeline(currentSessionId);
    const doc = createFinalReportPdfDoc(session, candidate, timeline);
    doc.save(
      `${(candidate?.name || "candidate")
        .toString()
        .replace(/\s+/g, "_")}-final-report.pdf`
    );
  }

  // Place inside IntervieweePage component, near other hooks
  const emailedRef = useRef<Set<string>>(new Set());

  async function emailFinalReportFor(sessionId: string) {
    try {
      const s = useInterviewStore.getState();
      const sess = s.sessions[sessionId];
      if (!sess?.finalReport) {
        toast.error("Final report not available yet.");
        return;
      }
      const candidate = s.candidates[sess.candidateId];
      const to = candidate?.email;
      if (!to) {
        toast.error("No candidate email found to send the report.");
        return;
      }
      const timeline = s.getChatTimeline(sessionId);
      const doc = createFinalReportPdfDoc(sess, candidate, timeline);
      const blob = doc.output("blob") as Blob;
      const base64 = await blobToBase64(blob);
      const filename = `${(candidate?.name || "candidate")
        .toString()
        .replace(/\s+/g, "_")}-final-report.pdf`;

      toast.message(`Sending report to ${to}...`);
      const res = await fetch("/api/send-final-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, filename, pdfBase64: base64 }),
      });
      const ok = res.ok;
      const data = await res.json().catch(() => ({}));
      if (!ok) {
        throw new Error(data?.message || "Email send failed");
      }
      toast.success("Final report emailed successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to email final report.");
    }
  }

  useEffect(() => {
    if (inProgress) setEntryChoiceOpen(false);
  }, [inProgress]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    const onVisibility = async () => {
      if (document.hidden) {
        if (inProgress && currentSessionId) {
          try {
            pausedDueToNavRef.current = true;
            await pause(currentSessionId);
          } catch {}
        }
      } else {
        if (pausedDueToNavRef.current) {
          setResumePromptOpen(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [inProgress, currentSessionId, pause]);

  useEffect(() => {
    if (initializedRef.current) return;
    const all = Object.values(sessions);
    const anyPaused = all.some((s) => s.status === "paused");

    if (inProgress) {
      setEntryChoiceOpen(false);
    } else if (anyPaused) {
      setEntryChoiceOpen(false);
      setResumePromptOpen(true);
    } else {
      setEntryChoiceOpen(true);
    }
    initializedRef.current = true;
  }, [sessions, inProgress]);

  useEffect(() => {
    const prev = (IntervieweePage as any).__prevStatus ?? null;
    const curr = session?.status ?? null;
    // Only re-open chooser if we just transitioned to completed from an active state
    if (
      prev &&
      curr === "completed" &&
      (prev === "in-progress" || prev === "paused")
    ) {
      setEntryChoiceOpen(true);
      useInterviewStore.setState({ currentSessionId: null });
    }
    (IntervieweePage as any).__prevStatus = curr;
  }, [session?.status]);

  useEffect(() => {
    if (session?.status === "paused" && !inProgress) {
      setResumePromptOpen(true);
    }
  }, [session?.status, inProgress]);

  return (
    <main className="min-h-dvh p-4">
      {session?.finalReport && (
        <Card className="mx-auto mb-4 max-w-7xl border-primary/40">
          <CardHeader>
            <CardTitle>Final Evaluation Ready</CardTitle>
            <CardDescription>
              Your interview has been fully evaluated. Download or email your
              report.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              className="bg-primary text-primary-foreground"
              onClick={downloadFinalReportPdf}
            >
              Download PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (session?.id) emailFinalReportFor(session.id);
              }}
            >
              Email PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const candidate = session
                  ? candidates[session.candidateId]
                  : undefined;
                const filename = `${
                  candidate?.name || "candidate"
                }-final-report.json`;
                const dataStr =
                  "data:text/json;charset=utf-8," +
                  encodeURIComponent(
                    JSON.stringify(session.finalReport, null, 2)
                  );
                const a = document.createElement("a");
                a.href = dataStr;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              Download JSON
            </Button>
          </CardContent>
        </Card>
      )}

      {session && <PrivacyConsent candidateId={session.candidateId} />}

      {inProgress ? (
        <InterviewStage blocked={entryChoiceOpen} />
      ) : (
        <div className="mx-auto max-w-7xl">
          {resumePromptOpen && session && session.status === "paused" && (
            <Card className="mb-4 border-amber-500/50">
              <CardHeader>
                <CardTitle>Resume your interview?</CardTitle>
                <CardDescription>
                  You left this interview earlier. Resume now to continue from
                  where you left off.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={async () => {
                    try {
                      if (session) {
                        await setInProgress(session.id);
                        setResumePromptOpen(false);
                        pausedDueToNavRef.current = false;
                      }
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Resume Interview
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResumePromptOpen(false);
                    pausedDueToNavRef.current = false;
                  }}
                >
                  Not now
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-12">
            <div className="space-y-4 md:col-span-4 lg:col-span-4">
              <ResumeCard />
              <Card>
                <CardHeader>
                  <CardTitle>Controls</CardTitle>
                  <CardDescription>Manage session state</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <PauseAndEnd />
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={downloadFinalReportPdf}
                    disabled={!session?.finalReport}
                  >
                    Export Final Report as PDF
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-8 lg:col-span-8">
              <ChatTimeline />
            </div>
          </div>
        </div>
      )}

      {entryChoiceOpen && !resumePromptOpen && (
        <SessionChooser
          sessions={sessions}
          candidates={candidates}
          onChoose={(id) => {
            useInterviewStore.setState({ currentSessionId: id });
            setResumePromptOpen(false); // close any stale resume prompt
            pausedDueToNavRef.current = false;
            setEntryChoiceOpen(false);
          }}
          onNew={() => {
            const id = createSession();
            useInterviewStore.setState({ currentSessionId: id });
            setResumePromptOpen(false); // close any stale resume prompt
            pausedDueToNavRef.current = false;
            setEntryChoiceOpen(false);
          }}
        />
      )}
    </main>
  );
}
