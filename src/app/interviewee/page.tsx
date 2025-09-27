"use client";

import { useEffect, useRef, useState } from "react";
import { shallow } from "zustand/shallow"
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const candidate = useInterviewStore((s) =>
    session ? s.candidates[session.candidateId] : undefined
  );
  const updateCandidate = useInterviewStore((s) => s.updateCandidate);
  const setSessionInProgress = useInterviewStore((s) => s.setSessionInProgress);
  const generateNextQuestion = useInterviewStore((s) => s.generateNextQuestion);

  const [resumeText, setResumeText] = useState(candidate?.resumeText || "");
  const fileInput = useRef<HTMLInputElement | null>(null);

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

  async function parseWithGemini() {
    if (!resumeText.trim() || !candidate) return;
    try {
      const parsed = await postJson("/api/parse-resume", {
        resumeText,
        candidateId: candidate.id,
      });
      updateCandidate(candidate.id, {
        name: parsed.name ?? candidate.name,
        email: parsed.email ?? candidate.email,
        phone: parsed.phone ?? candidate.phone,
        resumeText,
      });
    } catch {
      const local = localExtract(resumeText);
      updateCandidate(candidate.id, { ...local, resumeText });
    }
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
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // For preview: read as text. In production, add pdf/docx parsers.
                const text = await file.text();
                setResumeText(text);
                updateCandidate(candidate.id, { resumeFilename: file.name });
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                fileInput.current?.click();
              }}
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const local = localExtract(resumeText);
              updateCandidate(candidate.id, { ...local, resumeText });
            }}
          >
            Run local parse
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={parseWithGemini}
          >
            Parse with AI
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            Progress {progress}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="bg-primary text-primary-foreground"
            onClick={async () => {
              // Ensure required fields
              if (!candidate.name || !candidate.email || !candidate.phone) {
                alert("Please provide Name, Email, and Phone to start.");
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
    </Card>
  );
}

function QuestionCard() {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  const [now, setNow] = useState(Date.now());
  const tick = useRef<number | null>(null);
  const submitAnswer = useInterviewStore((s) => s.submitAnswer);
  const getCurrentQuestion = useInterviewStore((s) => s.getCurrentQuestion);

  const currentQuestion = currentSessionId
    ? getCurrentQuestion(currentSessionId)
    : undefined;

  const remaining = useInterviewStore((s) =>
    currentSessionId && currentQuestion
      ? s.sessions[currentSessionId]?.timers[currentQuestion.id]
          ?.remainingSeconds ?? 0
      : 0
  );

  const [speakEnabled, setSpeakEnabled] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    tick.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, []);

  useEffect(() => {
    if (!speakEnabled || !currentQuestion) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(currentQuestion.text);
      u.rate = 1;
      u.pitch = 1;
      u.lang = "en-US";
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.log("[v0] TTS error:", e);
      toast.error("Unable to speak the question on this browser.");
    }
  }, [speakEnabled, currentQuestion]);

  if (!session || !currentQuestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
          <CardDescription>
            Start interview to receive questions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const difficulty = currentQuestion.difficulty;
  const hint = currentQuestion.hint;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Question {currentQuestion.index + 1} / 6</span>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs",
              difficulty === "easy" &&
                "bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-200",
              difficulty === "medium" &&
                "bg-yellow-100 text-yellow-800 dark:bg-yellow-600/20 dark:text-yellow-200",
              difficulty === "hard" &&
                "bg-red-100 text-red-800 dark:bg-red-600/20 dark:text-red-200"
            )}
          >
            {difficulty}
          </span>
        </CardTitle>
        <CardDescription className="text-pretty">
          {currentQuestion.text}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Countdown seconds={remaining} warnAt={10} />
          <div className="flex items-center gap-2">
            <Button
              variant={speakEnabled ? "default" : "secondary"}
              onClick={() => {
                setSpeakEnabled((v) => !v);
                if (speakEnabled) {
                  try {
                    window.speechSynthesis.cancel();
                  } catch {}
                }
              }}
            >
              {speakEnabled ? "Speaking On" : "Speak Question"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  window.speechSynthesis.cancel();
                } catch {}
              }}
            >
              Stop Speaking
            </Button>

            <Button
              variant="secondary"
              onClick={() => alert("Hint: " + (hint || "No hint available"))}
            >
              Hint
            </Button>
            <Button
              variant="secondary"
              onClick={() => alert("Marking for review…")}
            >
              Mark for review
            </Button>
            <Button
              variant="secondary"
              onClick={() => alert("Requesting extra time…")}
            >
              Extra time
            </Button>
          </div>
        </div>
        <AnswerInput
          onSubmit={async (text) => {
            await submitAnswer(session.id, text, false);
          }}
        />
      </CardContent>
    </Card>
  );
}

function AnswerInput({
  onSubmit,
}: {
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (typeof window !== "undefined" && (window as any).SpeechRecognition) ||
      (typeof window !== "undefined" &&
        (window as any).webkitSpeechRecognition);
    setIsSupported(!!SpeechRecognition);
  }, []);

  function startRecording() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    try {
      const recog = new SpeechRecognition();
      recog.lang = "en-US";
      recog.continuous = true;
      recog.interimResults = true;

      recog.onstart = () => {
        setIsRecording(true);
        toast.message("Listening… Speak your answer.");
      };
      recog.onresult = (e: any) => {
        let finalTranscript = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            setText((prev) => {
              return transcript.length > prev.length ? transcript : prev;
            });
          }
        }
        if (finalTranscript.trim()) {
          setText((prev) =>
            prev.trim()
              ? prev + " " + finalTranscript.trim()
              : finalTranscript.trim()
          );
        }
      };
      recog.onerror = (err: any) => {
        console.log("[v0] SpeechRecognition error:", err);
        toast.error(
          "Microphone error. Please check permissions and try again."
        );
        setIsRecording(false);
      };
      recog.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recog;
      recog.start();
    } catch (e) {
      console.log("[v0] Failed to start SpeechRecognition:", e);
      toast.error("Unable to start recording.");
    }
  }

  function stopRecording() {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => (isRecording ? stopRecording() : startRecording())}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </Button>
        {!isSupported && (
          <span className="text-sm text-muted-foreground">
            Browser doesn&apos;t support speech recognition. Please type your
            answer.
          </span>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          You can edit before submitting
        </div>
      </div>

      <Textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Speak or type your answer… Press Ctrl/Cmd+Enter to submit"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            onSubmit(text).then(() => setText(""));
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setText("")}>
          Clear
        </Button>
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => onSubmit(text).then(() => setText(""))}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}

function ChatTimeline() {
  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );
  
const getChatTimeline = useInterviewStore((s) => s.getChatTimeline)
const chat = currentSessionId ? getChatTimeline(currentSessionId) : []

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
                <div className="text-xs opacity-80">
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
                className="rounded-md bg-green-100 p-3 dark:bg-green-900/20"
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

export default function IntervieweePage() {
  const boot = useInterviewStore((s) => s.bootIfNeeded);

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot]);

  const currentSessionId = useInterviewStore((s) => s.currentSessionId);
  const session = useInterviewStore((s) =>
    currentSessionId ? s.sessions[currentSessionId] : undefined
  );

  return (
    <main className="mx-auto max-w-6xl p-4">
      {session && <PrivacyConsent candidateId={session.candidateId} />}
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-3 space-y-4">
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

        <div className="md:col-span-6">
          <ChatTimeline />
        </div>

        <div className="md:col-span-3">
          <QuestionCard />
        </div>
      </div>
    </main>
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
