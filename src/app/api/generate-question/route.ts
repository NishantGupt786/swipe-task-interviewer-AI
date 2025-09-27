import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { candidateProfile, difficulty, previousQuestions } = body || {}
  const prompt = `You are an interviewer assistant tasked with generating a single question for a React + Node full-stack role. Output exactly one JSON object with these fields: id, text, difficulty (easy|medium|hard), hint, expected_key_points (array). Difficulty should match the requested difficulty. Keep text concise and focused on developer skills and real-world tradeoffs. Return JSON only.

Context: candidate profile: ${JSON.stringify(candidateProfile)}. Previously asked questions: ${JSON.stringify(
    previousQuestions || [],
  )}`

  try {
    const raw = await callGemini({ model: process.env.GEMINI_MODEL, prompt, max_output_tokens: 400 })
    const asText = JSON.stringify(raw)
    const jsonMatch = asText.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    return NextResponse.json({ question: parsed })
  } catch {
    // Provide a mocked question in preview
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
