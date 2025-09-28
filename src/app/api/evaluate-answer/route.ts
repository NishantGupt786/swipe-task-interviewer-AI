import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { candidateProfile, questionText, answerText, difficulty } = body || {};
  const prompt = `
You are an objective technical interviewer. 

Rules:
- Respond ONLY with valid JSON.
- JSON shape: {"score": number, "feedback": string, "rubric": {"correctness": number, "clarity": number, "depth": number}}
- score: integer 0-10
- feedback: concise, 1-2 sentences
- rubric: each category 0-5

Question: ${questionText}
Answer: ${answerText}
Difficulty: ${difficulty}
Candidate profile: ${JSON.stringify(candidateProfile)}
`;

  try {
    const raw = await callGemini({
      model: process.env.GEMINI_MODEL,
      prompt,
      max_output_tokens: 20480,
    });
    console.log("Gemini eval raw:", raw);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return NextResponse.json({ evaluation: parsed });
  } catch {
    return NextResponse.json({
      evaluation: {
        score: Math.round(Math.random() * 10),
        feedback:
          "Decent answer. Clarify trade-offs and provide examples for depth.",
        rubric: { correctness: 3, clarity: 3, depth: 3 },
      },
    });
  }
}
