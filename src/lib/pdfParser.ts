import pdf from "pdf-parse"

export async function parsePdf(buffer: Buffer) {
  const data = await pdf(buffer)
  return data.text
}
