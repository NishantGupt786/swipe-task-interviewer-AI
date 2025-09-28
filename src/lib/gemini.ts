import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

type GeminiPayload = {
  model?: string
  prompt: string
  max_output_tokens?: number
}

export async function callGemini({ model, prompt, max_output_tokens }: GeminiPayload) {
  const useModel = model || process.env.GEMINI_MODEL || "gemini-2.5-flash"

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY")
  }

  const geminiModel = genAI.getGenerativeModel({
    model: useModel,
    generationConfig: {
      maxOutputTokens: max_output_tokens || 2048,
    },
  })

  const result = await geminiModel.generateContent(prompt)
  console.log("Gemini result:", JSON.stringify(result))

  // Try text first
  let text = result.response.text()

  // Fallback: candidates -> parts
  if (!text || !text.trim()) {
    const parts = result.response.candidates?.[0]?.content?.parts
    text = parts?.map((p: any) => p.text).join("\n") || ""
    console.log("Gemini parts:", text)
  }

  return text
}
