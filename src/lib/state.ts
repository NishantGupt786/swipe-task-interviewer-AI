"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { createIndexedDBStorage } from "@/lib/idbStorage";
import { persist } from "zustand/middleware";
import type {
  Answer,
  CandidateProfile,
  Difficulty,
  Evaluation,
  Question,
  Session,
} from "./types";
import { postJson } from "./net";

type ChatItem =
  | ({ type: "question" } & Question & { timestamp: string })
  | ({ type: "answer" } & Answer)
  | ({ type: "evaluation" } & Evaluation);

interface StoreState {
  candidates: Record<string, CandidateProfile>;
  sessions: Record<string, Session>;
  currentSessionId: string | null;
  bootIfNeeded: () => void;
  updateCandidate: (id: string, patch: Partial<CandidateProfile>) => void;
  createSession: () => string;
  setSessionInProgress: (sessionId: string) => void;
  getCurrentQuestion: (sessionId: string) => Question | undefined;
  generateNextQuestion: (sessionId: string) => Promise<void>;
  submitAnswer: (
    sessionId: string,
    text: string,
    auto: boolean
  ) => Promise<void>;
  getChatTimeline: (sessionId: string) => ChatItem[];
  pauseSession: (sessionId: string) => void;
  endSession: (sessionId: string) => void;
  reEvaluateSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => void;
}

const DEFAULT_SEQUENCE: { difficulty: Difficulty; seconds: number }[] = [
  { difficulty: "easy", seconds: 20 },
  { difficulty: "easy", seconds: 20 },
  { difficulty: "medium", seconds: 60 },
  { difficulty: "medium", seconds: 60 },
  { difficulty: "hard", seconds: 120 },
  { difficulty: "hard", seconds: 120 },
];

export const useInterviewStore = create<StoreState>()(
  persist(
    (set, get) => ({
      candidates: {},
      sessions: {},
      currentSessionId: null,

      bootIfNeeded: () => {
        const state = get();
        if (state.currentSessionId && state.sessions[state.currentSessionId])
          return;

        // Create a blank candidate + session on first visit
        const candId = nanoid();
        const now = new Date().toISOString();
        const candidate: CandidateProfile = {
          id: candId,
          name: null,
          email: null,
          phone: null,
          createdAt: now,
          updatedAt: now,
        };
        const sessId = nanoid();
        const session: Session = {
          id: sessId,
          candidateId: candId,
          questionSequence: [],
          currentQuestionIndex: 0,
          answers: [],
          evaluations: [],
          status: "not-started",
          timers: {},
          extraTimeTokens: 0,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          candidates: { ...s.candidates, [candId]: candidate },
          sessions: { ...s.sessions, [sessId]: session },
          currentSessionId: sessId,
        }));
      },

      updateCandidate: (id, patch) =>
        set((s) => ({
          candidates: {
            ...s.candidates,
            [id]: {
              ...s.candidates[id],
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          },
        })),

      createSession: () => {
        const candId = nanoid();
        const now = new Date().toISOString();
        const candidate: CandidateProfile = {
          id: candId,
          name: null,
          email: null,
          phone: null,
          createdAt: now,
          updatedAt: now,
        };
        const sessId = nanoid();
        const session: Session = {
          id: sessId,
          candidateId: candId,
          questionSequence: [],
          currentQuestionIndex: 0,
          answers: [],
          evaluations: [],
          status: "not-started",
          timers: {},
          extraTimeTokens: 0,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          candidates: { ...s.candidates, [candId]: candidate },
          sessions: { ...s.sessions, [sessId]: session },
          currentSessionId: sessId,
        }));
        return sessId;
      },

      setSessionInProgress: (sessionId) =>
        set((s) => {
          const sess = s.sessions[sessionId];
          if (!sess) return {};
          // Initialize timers for sequence slots
          const timers: Session["timers"] = { ...sess.timers };
          DEFAULT_SEQUENCE.forEach((slot, idx) => {
            const id = `qslot_${idx}`;
            if (!timers[id]) {
              timers[id] = {
                remainingSeconds: slot.seconds,
                lastTickAt: new Date().toISOString(),
              };
            }
          });
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...sess,
                status: "in-progress",
                timers,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      getCurrentQuestion: (sessionId) => {
        const sess = get().sessions[sessionId];
        if (!sess) return undefined;
        return sess.questionSequence[sess.currentQuestionIndex];
      },

      generateNextQuestion: async (sessionId) => {
        const s = get();
        const sess = s.sessions[sessionId];
        if (!sess) return;
        const idx = sess.currentQuestionIndex;
        if (idx >= 6) return;

        const slot = DEFAULT_SEQUENCE[idx];
        // call server to generate question
        const candidate = s.candidates[sess.candidateId];
        let question: Question;
        try {
          const resp = await postJson("/api/generate-question", {
            candidateProfile: candidate,
            difficulty: slot.difficulty,
            previousQuestions: sess.questionSequence,
          });
          const q = resp?.question;
          question = {
            id: q?.id || nanoid(),
            text: q?.text || `Sample ${slot.difficulty} question #${idx + 1}`,
            difficulty: q?.difficulty || slot.difficulty,
            index: idx,
            hint: q?.hint || "Think about trade-offs and constraints.",
          };
        } catch {
          question = {
            id: nanoid(),
            text: `Sample ${slot.difficulty} question #${idx + 1}`,
            difficulty: slot.difficulty,
            index: idx,
            hint: "Consider complexity and performance.",
          };
        }

        set((state) => {
          const prev = state.sessions[sessionId];
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...prev,
                questionSequence: [...prev.questionSequence, question],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      submitAnswer: async (sessionId, text, autoSubmitted) => {
        const state = get();
        const sess = state.sessions[sessionId];
        if (!sess) return;
        const question = sess.questionSequence[sess.currentQuestionIndex];
        if (!question) return;

        // compute time taken
        const timer = sess.timers[question.id] || {
          remainingSeconds: 0,
          lastTickAt: new Date().toISOString(),
        };
        const answer: Answer = {
          id: nanoid(),
          questionId: question.id,
          candidateId: sess.candidateId,
          text,
          submittedAt: new Date().toISOString(),
          timeTakenSeconds: Math.max(
            0,
            DEFAULT_SEQUENCE[question.index]?.seconds -
              (timer.remainingSeconds ?? 0)
          ),
          autoSubmitted,
        };

        // optimistic add answer
        set((s) => {
          const prev = s.sessions[sessionId];
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...prev,
                answers: [...prev.answers, answer],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });

        // call evaluation
        const candidate = state.candidates[sess.candidateId];
        let evaluation: Evaluation;
        try {
          const resp = await postJson("/api/evaluate-answer", {
            candidateProfile: candidate,
            questionText: question.text,
            answerText: text,
            difficulty: question.difficulty,
          });
          const e = resp?.evaluation;
          evaluation = {
            id: nanoid(),
            answerId: answer.id,
            score:
              typeof e?.score === "number"
                ? e.score
                : Math.round(Math.random() * 10),
            feedback:
              e?.feedback ||
              "Thanks. Consider discussing trade-offs and examples.",
            rubric: e?.rubric || { correctness: 3, clarity: 3, depth: 3 },
            evaluatedAt: new Date().toISOString(),
          };
        } catch {
          evaluation = {
            id: nanoid(),
            answerId: answer.id,
            score: Math.round(Math.random() * 10),
            feedback:
              "Pending evaluation due to an error. This is a temporary local score.",
            rubric: { correctness: 0, clarity: 0, depth: 0 },
            evaluatedAt: new Date().toISOString(),
          };
        }

        // store evaluation and advance
        set((s) => {
          const prev = s.sessions[sessionId];
          const nextIndex = Math.min(prev.currentQuestionIndex + 1, 6);
          const status = nextIndex >= 6 ? "completed" : prev.status;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...prev,
                evaluations: [...prev.evaluations, evaluation],
                currentQuestionIndex: nextIndex,
                updatedAt: new Date().toISOString(),
                status,
              },
            },
          };
        });

        // generate next question if still in progress
        const after = get().sessions[sessionId];
        if (after.status !== "completed") {
          await get().generateNextQuestion(sessionId);
        } else {
          // finalize
          try {
            const report = await postJson("/api/finalize-session", {
              session: after,
            });
            set((s) => {
              const prev = s.sessions[sessionId];
              return {
                sessions: {
                  ...s.sessions,
                  [sessionId]: {
                    ...prev,
                    finalReport: report,
                    updatedAt: new Date().toISOString(),
                  },
                },
              };
            });
          } catch {
            // keep as is if finalize fails
          }
        }
      },

      getChatTimeline: (sessionId) => {
        const s = get();
        const sess = s.sessions[sessionId];
        if (!sess) return [];
        const arr: ChatItem[] = [];
        for (let i = 0; i < sess.questionSequence.length; i++) {
          const q = sess.questionSequence[i];
          arr.push({ type: "question", ...q, timestamp: sess.updatedAt });
          const ans = sess.answers.find((a) => a.questionId === q.id);
          if (ans) arr.push({ type: "answer", ...ans });
          const ev = sess.evaluations.find((e) => e.answerId === ans?.id);
          if (ev) arr.push({ type: "evaluation", ...ev });
        }
        return arr;
      },

      pauseSession: (sessionId) =>
        set((s) => {
          const sess = s.sessions[sessionId];
          if (!sess) return {};
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...sess,
                status: "paused",
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      endSession: (sessionId) =>
        set((s) => {
          const sess = s.sessions[sessionId];
          if (!sess) return {};
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...sess,
                status: "completed",
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      reEvaluateSession: async (sessionId) => {
        const s = get();
        const sess = s.sessions[sessionId];
        if (!sess) return;
        // Simply re-run evaluate on each answer (mock)
        const newEvals: Evaluation[] = [];
        for (const ans of sess.answers) {
          newEvals.push({
            id: nanoid(),
            answerId: ans.id,
            score: Math.round(Math.random() * 10),
            feedback: "Re-evaluated. Consider adding details and examples.",
            rubric: { correctness: 3, clarity: 3, depth: 3 },
            evaluatedAt: new Date().toISOString(),
          });
        }
        set((state) => ({
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...sess,
              evaluations: newEvals,
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      deleteSession: (sessionId) =>
        set((s) => {
          const { [sessionId]: _, ...rest } = s.sessions;
          return {
            sessions: rest,
            currentSessionId:
              s.currentSessionId === sessionId ? null : s.currentSessionId,
          };
        }),
    }),
    {
      name: "swipe-interview-store",
      storage: createIndexedDBStorage<StoreState>("swipe-interview-store"),
      // Using localStorage here for simplicity; can be swapped for IndexedDB/localForage.
    }
  )
);
