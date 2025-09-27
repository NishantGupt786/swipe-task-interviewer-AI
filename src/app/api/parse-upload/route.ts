import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import pdf from "pdf-parse"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const name = file.name || ""
    const mime = file.type || ""

    let text = ""

    if (/pdf$/i.test(name) || /pdf/i.test(mime)) {
      const out = await pdf(buf)
      text = out.text || ""
    } else if (/docx$/i.test(name) || /officedocument\.wordprocessingml\.document/i.test(mime)) {
      const out = await mammoth.extractRawText({ arrayBuffer })
      text = out.value || ""
    } else {
      text = new TextDecoder().decode(arrayBuffer)
    }

    const ok =
      typeof text === "string" &&
      text.trim().length > 200 &&
      (text.match(/\w+/g)?.length || 0) > 30

    return NextResponse.json({ ok, text })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Parse failed" }, { status: 500 })
  }
}
