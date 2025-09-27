import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const resumeText = body?.resumeText
  if (!resumeText || typeof resumeText !== "string") {
    return NextResponse.json({ error: "resumeText required" }, { status: 400 })
  }

  const localEmail = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null
  const localPhone = resumeText.match(/(\+?\d[\d\s\-().]{6,}\d)/)?.[0] ?? null

  const prompt = `You are a JSON extractor. Input is a candidate resume text delimited by triple backticks. Extract the candidate's name, primary email, and primary phone number. If a field is missing put null. Respond with a strict JSON object and nothing else in the response. Example output: {"name":"Aisha Khan","email":"aisha.khan@example.com","phone":"+91 98765 43210"}

Resume text:
\`\`\`${resumeText}\`\`\``

  try {
    const payload = { model: process.env.GEMINI_MODEL, prompt, max_output_tokens: 512 }
    const geminiRaw = await callGemini(payload)
    const asText = JSON.stringify(geminiRaw)
    const jsonMatch = asText.match(/\{[\s\S]*\}/)
    let parsed: any = {}
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        parsed = {}
      }
    }
    const name = parsed?.name ?? null
    const email = parsed?.email ?? localEmail
    const phone = parsed?.phone ?? localPhone
    return NextResponse.json({ name, email, phone, source: "mixed", geminiRaw })
  } catch {
    return NextResponse.json({ name: null, email: localEmail, phone: localPhone, source: "local", geminiRaw: null })
  }
}
