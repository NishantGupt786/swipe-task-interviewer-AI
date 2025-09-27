import { NextRequest, NextResponse } from "next/server"
import textToSpeech from "@google-cloud/text-to-speech"
import fs from "fs"
import util from "util"

// Ensure credentials are loaded
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./google-tts-key.json"

const client = new textToSpeech.TextToSpeechClient()

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 })
    }

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "en-US",
        ssmlGender: "NEUTRAL",
      },
      audioConfig: { audioEncoding: "MP3" },
    })

    const audioContent = response.audioContent as Buffer
    const uint8 = new Uint8Array(audioContent)
    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": uint8.length.toString(),
      },
    })
  } catch (err: any) {
    console.error("TTS error:", err)
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 })
  }
}
