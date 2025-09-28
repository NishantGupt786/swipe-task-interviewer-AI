export type Difficulty = "easy" | "medium" | "hard"

export interface CandidateProfile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  resumeFilename?: string
  resumeText?: string
  parsedAt?: string
  privacyConsent?: { geminiParsing: boolean; evaluation: boolean }
  createdAt: string
  updatedAt: string
}

export interface Question {
  id: string
  text: string
  difficulty: Difficulty
  index: number
  hint?: string
}

export interface Answer {
  id: string
  questionId: string
  candidateId: string
  text: string
  submittedAt: string
  timeTakenSeconds: number
  autoSubmitted: boolean
}

export interface Evaluation {
  id: string
  answerId: string
  score: number
  feedback: string
  rubric: { correctness: number; clarity: number; depth: number }
  evaluatedAt: string
}

export interface Session {
  id: string
  candidateId: string
  questionSequence: Question[]
  currentQuestionIndex: number
  answers: Answer[]
  evaluations: Evaluation[]
  status: "not-started" | "in-progress" | "paused" | "completed"
  timers: Record<string, { remainingSeconds: number; lastTickAt: string }>
  extraTimeTokens: number
  createdAt: string
  updatedAt: string
  finalReport?: FinalReport
}

export interface AppState {
  ui: { selectedTab: "interviewee" | "interviewer" }
  candidates: Record<string, CandidateProfile>
  sessions: Record<string, Session>
}

export interface FinalReport {
  finalScore: number
  summary: string
  recommendation: "Hire" | "Consider" | "Reject"
  perQuestionScores: { questionId: string; score: number }[]
}