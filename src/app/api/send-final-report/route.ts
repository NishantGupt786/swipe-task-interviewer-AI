import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { to, filename, pdfBase64 } = body || {}

    if (!to || !pdfBase64) {
      return NextResponse.json({ ok: false, message: "Missing 'to' or 'pdfBase64'." }, { status: 400 })
    }

    const host = "smtp.gmail.com"
    const port = 465
    const secure = true
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const from = process.env.SMTP_USER

    if (!host || !user || !pass || !from) {
      return NextResponse.json(
        { ok: false, message: "SMTP env vars missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM." },
        { status: 500 },
      )
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })

    const info = await transporter.sendMail({
      from,
      to,
      subject: "Your Interview Final Report",
      text: "Attached is your final interview report in PDF format.",
      attachments: [
        {
          filename: filename || "final-report.pdf",
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    })

    return NextResponse.json({ ok: true, message: "Email sent", id: info.messageId })
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || "Failed to send email" }, { status: 500 })
  }
}
