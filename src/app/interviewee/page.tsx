"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function PrivacyConsent({ candidateId }: { candidateId: string }) {
  const candidate = useInterviewStore((s) => s.candidates[candidateId]);
  const updateCandidate = useInterviewStore((s) => s.updateCandidate);

  const open = !candidate?.privacyConsent?.geminiParsing;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
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
  const setSessionInProgress = useInterviewStore((s) => s.setSessionInProgress);
  const generateNextQuestion = useInterviewStore((s) => s.generateNextQuestion);

  const [resumeText, setResumeText] = useState(candidate?.resumeText || "");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  async function extractFromUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/parse-upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload parse failed");
    const data = await res.json();
    return data as { ok: boolean; text: string };
  }

  // async function parseWithGemini() {
  //   if (!resumeText.trim() || !candidate) return;
  //   try {
  //     const parsed = await postJson("/api/parse-resume", {
  //       resumeText,
  //       candidateId: candidate.id,
  //     });
  //     updateCandidate(candidate.id, {
  //       name: parsed.name ?? candidate.name,
  //       email: parsed.email ?? candidate.email,
  //       phone: parsed.phone ?? candidate.phone,
  //       resumeText,
  //     });
  //   } catch {
  //     const local = localExtract(resumeText);
  //     updateCandidate(candidate.id, { ...local, resumeText });
  //   }
  // }

  function localExtract(text: string) {
    const emailMatch =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null;
    const phoneMatch = text.match(/(\+?\d[\d\s\-().]{6,}\d)/)?.[0] ?? null;
    // naive name heuristic: first non-empty line
    const firstLine =
      text
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) || null;
    return { name: firstLine, email: emailMatch, phone: phoneMatch };
  }

  if (!candidate || !session) return null;

  const progress = `${session.currentQuestionIndex}/6`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Profile</CardTitle>
        <CardDescription>Resume parsing and fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <label className="text-sm">Resume file</label>
          <div className="flex gap-2">
            <Input
              type="file"
              ref={fileInput}
              accept=".pdf,.docx,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !candidate) return;
                updateCandidate(candidate.id, { resumeFilename: file.name });
                try {
                  console.log("Extracting text from upload...");
                  const { ok, text } = await extractFromUpload(file);
                  setResumeText(text || "");
                  // If extraction looks poor and user consents, ask Gemini to parse/improve fields from text
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
                } catch (err) {
                  toast.error(
                    "Failed to parse resume. Try another file or paste text."
                  );
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              Replace
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
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="bg-primary text-primary-foreground"
            onClick={async () => {
              if (!candidate) return;
              // Ensure required fields; if missing, open dialog to fill
              if (!candidate.name || !candidate.email || !candidate.phone) {
                setShowProfileDialog(true);
                return;
              }
              setSessionInProgress(session.id);
              await generateNextQuestion(session.id);
            }}
          >
            Start interview
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const dataStr =
                "data:text/json;charset=utf-8," +
                encodeURIComponent(JSON.stringify(session, null, 2));
              const a = document.createElement("a");
              a.href = dataStr;
              a.download = `${candidate.name || "candidate"}-session.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
            }}
          >
            Export report
          </Button>
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
                setSessionInProgress(session!.id);
                await generateNextQuestion(session!.id);
              }}
              className="bg-primary text-primary-foreground"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
function InterviewStage() {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const getCurrentQuestion = useInterviewStore((s) => s.getCurrentQuestion);
  const submitAnswer = useInterviewStore((s) => s.submitAnswer);
  const currentQuestion = currentSessionId
    ? getCurrentQuestion(currentSessionId)
    : undefined;
  const sessions = useInterviewStore((s) => s.sessions);
  const remaining =
    currentSessionId && currentQuestion
      ? sessions[currentSessionId]?.timers[currentQuestion.id]
          ?.remainingSeconds ?? 0
      : 0;

  // === TTS state ===
  const [autoSpeak, setAutoSpeak] = useState(true);

  async function speakQuestion(text: string) {
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      toast.error("Unable to generate speech audio.");
    }
  }

  useEffect(() => {
    if (currentQuestion && autoSpeak) {
      speakQuestion(currentQuestion.text);
    }
  }, [currentQuestion, autoSpeak]);

  // === Recording + transcription + volume meter ===
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [volume, setVolume] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>();

  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // === Setup volume analyser ===
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      function tick() {
        if (analyserRef.current) {
          analyserRef.current.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] - 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          setVolume(Math.min(rms / 50, 1)); // normalize 0–1
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();

      // === Setup SpeechRecognition ===
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
            setFinalTranscript((prev) => prev + final);
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
    } catch (e) {
      toast.error("Unable to access microphone.");
    }
  }

  function stopRecording() {
    try {
      recognitionRef.current?.stop?.();
      setIsRecording(false);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setVolume(0);
    } catch {}
  }

  if (!session || !currentQuestion) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Interview</CardTitle>
            <CardDescription>
              Start the interview to receive your question.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const transcript = (finalTranscript + interimTranscript).trim();

  return (
    <main className="mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Question {currentQuestion.index + 1} / 6</span>
            <Countdown seconds={remaining} warnAt={10} />
          </CardTitle>
          <CardDescription className="text-pretty">
            {currentQuestion.text}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant={autoSpeak ? "default" : "secondary"}
              onClick={() => setAutoSpeak((v) => !v)}
            >
              {autoSpeak ? "Speaking On" : "Speak Question"}
            </Button>
            <Button variant="secondary" onClick={() => setAutoSpeak(false)}>
              Stop Speaking
            </Button>
          </div>

          {/* Recorder + transcript + volume meter */}
          <div className="flex flex-wrap items-center gap-2 w-full">
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => (isRecording ? stopRecording() : startRecording())}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
            {!speechSupported && (
              <span className="text-sm text-muted-foreground">
                Browser won&apos;t transcribe automatically.
              </span>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              Edit before submitting
            </div>
          </div>

          {/* Volume meter */}
          {isRecording && (
            <div className="w-full h-3 bg-muted rounded">
              <div
                className="h-3 rounded bg-green-500 transition-all"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          )}

          <Textarea
            rows={6}
            value={transcript}
            onChange={(e) => setFinalTranscript(e.target.value)}
            placeholder="Speak your answer, then edit if needed. Press Ctrl/Cmd+Enter to submit."
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                submitAnswer(session.id, transcript, false).then(() => {
                  setFinalTranscript("");
                  setInterimTranscript("");
                });
              }
            }}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setFinalTranscript("");
                setInterimTranscript("");
              }}
            >
              Clear
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() =>
                submitAnswer(session.id, transcript, false).then(() => {
                  setFinalTranscript("");
                  setInterimTranscript("");
                })
              }
            >
              Submit
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
              <div
                key={item.id}
                className="rounded-md p-3 bg-green-900/20"
              >
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
  const pauseSession = useInterviewStore((s) => s.pauseSession);
  const endSession = useInterviewStore((s) => s.endSession);
  if (!currentSessionId) return null;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => pauseSession(currentSessionId)}
      >
        Pause
      </Button>
      <Button
        variant="destructive"
        onClick={() => endSession(currentSessionId)}
      >
        End Interview
      </Button>
    </>
  );
}

export default function IntervieweePage() {
  const boot = useInterviewStore((s) => s.bootIfNeeded);

  useEffect(() => {
    boot();
  }, [boot]);

  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const inProgress = !!session?.status && session.status === "in-progress";

  if (inProgress) {
    return (
      <main className="min-h-dvh p-4">
        {session && <PrivacyConsent candidateId={session.candidateId} />}
        <InterviewStage />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4">
      {session && <PrivacyConsent candidateId={session.candidateId} />}
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
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-8 lg:col-span-8">
          <ChatTimeline />
        </div>
      </div>
      
    </main>
  );
}
