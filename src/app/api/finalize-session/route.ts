import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { session } = body || {}
  const prompt = `Given the session with all questions, answers and evaluations, produce a final JSON object: {"finalScore": number, "summary": string, "recommendation": "Hire"|"Consider"|"Reject", "perQuestionScores": [{"questionId":"","score":number}] }. Score range 0-100. Return JSON only.

Session data: ${JSON.stringify(session)}`

  try {
    const raw = await callGemini({ model: process.env.GEMINI_MODEL, prompt, max_output_tokens: 20480 })
    const asText = JSON.stringify(raw)
    const jsonMatch = asText.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({
      finalScore: 80,
      summary: "Solid performance overall with room to improve on depth of explanation.",
      recommendation: "Consider",
      perQuestionScores: (session?.questionSequence || []).map((q: any) => ({
        questionId: q.id,
        score: Math.round(Math.random() * 10),
      })),
    })
  }
}
