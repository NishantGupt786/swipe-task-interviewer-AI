# 🚀 Swipe Internship — AI Interview Assistant

An **AI-powered technical interview platform** that simulates structured candidate interviews with **resume parsing, timed Q&A, speech-to-text input, AI evaluation, and interviewer dashboards**.

---

## 📌 Features

* 📄 **Resume Parsing**

  * Upload PDF/DOCX/TXT files → Extracts candidate details.
  * Local heuristic parsing with optional Gemini AI enhancement.

* 🎤 **Candidate Experience**

  * Six **timed** technical questions (20s / 60s / 120s).
  * Auto-submit answers when timer runs out.
  * Speech-to-text transcription with **live volume meter**.
  * Text-to-Speech for questions (Google Cloud TTS).
  * Editable transcript + manual submit.

* 🤖 **AI Question Generation & Evaluation**

  * Dynamic question generation with **Gemini API**.
  * Automated answer evaluation (score + rubric + feedback).
  * Final interview report (score, summary, recommendation).

* 🧑‍💻 **Interviewer Dashboard**

  * Search candidates by name/email.
  * Review chat timeline: questions, answers, evaluations.
  * Export full candidate report as **PDF**.
  * Re-evaluate sessions if needed.

* 💾 **Persistence**

  * Sessions and candidates stored in IndexedDB (client-side).
  * Resume where you left off with session chooser modal.

---

## 🛠️ Tech Stack

| Technology                             | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| **Next.js (App Router)**               | Core framework for UI + API routes.                               |
| **React + Zustand**                    | State management for sessions, candidates, and timers.            |
| **Tailwind CSS + shadcn/ui**           | UI components, styling, theming.                                  |
| **Lucide Icons**                       | Modern, consistent icons (mic, volume, stop, etc.).               |
| **Google Cloud Text-to-Speech**        | Question audio playback (MP3 synthesis).                          |
| **Google Gemini API**                  | Question generation, evaluation, and final session summarization. |
| **pdf-parse**                          | Resume PDF text extraction.                                       |
| **IndexedDB (via Zustand middleware)** | Local session persistence across refreshes.                       |
| **Sonner**                             | Toast notifications for feedback/errors.                          |
| **date-fns**                           | Date formatting (e.g. "3 minutes ago").                           |
| **jspdf**                             | Candidate report export as **PDF**.                               |

---

## ⚙️ Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/swipe-interview.git
cd swipe-interview
```

### 2. Install dependencies

```bash
pnpm install
# or
npm install
# or
yarn install
```

### 3. Configure environment variables

Create a `.env.local` file (see `.env.example` below):

```bash
# ==== Google Cloud TTS (Service Account JSON) ====
# Paste the entire JSON string as one line, with escaped \n in private_key
GCP_KEY_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

# ==== Gemini AI ====
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# ==== SMTP CONFIG ====
SMTP_USER=youremail@gmail.com
SMTP_PASS=your app password
```

### 4. Run locally

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

The app will be available at **[http://localhost:3000](http://localhost:3000)**.

---


## ✅ Future Enhancements

* Multi-language support (both questions + TTS).
* Support for more resume formats (LinkedIn, plain HTML).
* Advanced interviewer analytics (per-skill radar charts).

---