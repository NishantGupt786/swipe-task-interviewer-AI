import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { candidateProfile, difficulty, previousQuestions } = body || {}

  const prompt = `You are an interviewer assistant tasked with generating a single unique question for a React + Node full-stack role.

Rules:
- Output exactly one JSON object with fields: id, text, difficulty (easy|medium|hard), hint, expected_key_points (array).
- Difficulty must match: ${difficulty}.
- The question must NOT be semantically similar to any of the previous questions.
- Do not repeat or paraphrase previous questions.
- Keep text concise, realistic, and focused on developer skills and trade-offs.

Context:
- Candidate profile: ${JSON.stringify(candidateProfile)}.
- Previously asked questions: ${JSON.stringify(previousQuestions || [])}.

Return only the JSON object.`

  try {
    const rawText = await callGemini({
      model: process.env.GEMINI_MODEL,
      prompt,
      max_output_tokens: 20480,
    })

    console.log("Gemini raw text:", rawText)

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    return NextResponse.json({ question: parsed })
  } catch (err) {
    console.error("Gemini error:", err)
    return NextResponse.json({
      question: {
        id: `q_${Math.random().toString(36).slice(2)}`,
        text: "Explain how you would design a pagination API for a large dataset in a Next.js + Node app.",
        difficulty: difficulty || "medium",
        hint: "Consider limit/offset vs cursor-based, caching, and consistency.",
        expected_key_points: ["cursor-based", "caching", "indexes"],
      },
    })
  }
}
