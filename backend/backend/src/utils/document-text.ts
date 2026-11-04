import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../middleware/appError.js";

/**
 * Plain text of a PDF, Word (.docx) or text document, so it can be redacted and checked
 * before anything is sent to the AI. Scanned PDFs have no text layer and are rejected.
 */
export async function documentText(buffer: Buffer, fileName: string): Promise<string> {
  const name = fileName.toLowerCase();
  let text: string;
  try {
    if (name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
    } else if (name.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      text = buffer.toString("utf8");
    } else if (name.endsWith(".doc")) {
      throw new AppError("Old Word files (.doc) cannot be read. Save it as .docx or PDF and try again.", 400, "UNSUPPORTED_DOCUMENT");
    } else {
      throw new AppError("Upload a PDF, Word (.docx) or text file.", 400, "UNSUPPORTED_DOCUMENT");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("This document could not be read. It may be damaged or password-protected.", 400, "UNREADABLE_DOCUMENT");
  }
  const cleaned = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length < 50) {
    throw new AppError(
      "No readable text was found. If this is a scanned document, save a text-based PDF or Word version.",
      400,
      "NO_DOCUMENT_TEXT",
    );
  }
  return cleaned;
}
