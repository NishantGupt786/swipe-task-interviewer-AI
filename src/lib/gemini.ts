import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

type GeminiPayload = {
  model?: string
  prompt?: string
  max_output_tokens?: number
  // Optional passthrough for advanced config in case we need it later
  config?: {
    thinkingConfig?: {
      thinkingBudget?: number
    }
    // You can extend this as needed
    [k: string]: any
  }
}

export async function callGemini(payload: GeminiPayload) {
  const model = payload?.model || process.env.GEMINI_MODEL || "gemini-2.5-flash"
  const prompt = payload?.prompt || ""

  if (!process.env.GEMINI_API_KEY) {
    return { mock: true, payload }
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    // Provide a minimal default config aligned with your sample
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      ...(payload?.config || {}),
      // Note: if you want to enforce output token limits with this SDK,
      // add the appropriate generation config here when needed.
    },
  })

  const text = (response as any)?.text ?? JSON.stringify(response)
  return text
}
