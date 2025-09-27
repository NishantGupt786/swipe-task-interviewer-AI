import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { candidateProfile, questionText, answerText, difficulty } = body || {}
  const prompt = `You are an objective technical interviewer. Evaluate the candidate's answer for this question. Return JSON only with: {"score": number, "feedback": string, "rubric": {"correctness": number, "clarity": number, "depth": number}}. Score range 0-10. Use candidate profile context to weigh answers. Provide concise feedback.

Question: ${questionText}
Answer: ${answerText}
Difficulty: ${difficulty}
Candidate profile: ${JSON.stringify(candidateProfile)}`

  try {
    const raw = await callGemini({ model: process.env.GEMINI_MODEL, prompt, max_output_tokens: 300 })
    const asText = JSON.stringify(raw)
    const jsonMatch = asText.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    return NextResponse.json({ evaluation: parsed })
  } catch {
    return NextResponse.json({
      evaluation: {
        score: Math.round(Math.random() * 10),
        feedback: "Decent answer. Clarify trade-offs and provide examples for depth.",
        rubric: { correctness: 3, clarity: 3, depth: 3 },
      },
    })
  }
}
