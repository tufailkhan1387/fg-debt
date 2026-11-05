import { Document, Header, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/**
 * Turns plain draft text ("# " / "## " headings, "- " list items, blank-line paragraphs) into a Word document,
 * marked on every page with the note when one is given (e.g. a draft awaiting approval).
 */
export async function draftToDocx(title: string, text: string, note?: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1 }));
    } else if (/^\s*[-*] /.test(line)) {
      paragraphs.push(new Paragraph({ text: line.replace(/^\s*[-*] /, ""), bullet: { level: 0 } }));
    } else {
      paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }

  const doc = new Document({
    creator: "FG Compliance",
    title,
    sections: [
      {
        ...(note
          ? {
              headers: {
                default: new Header({
                  children: [new Paragraph({ children: [new TextRun({ text: note, italics: true, size: 18, color: "B45309" })] })],
                }),
              },
            }
          : {}),
        children: paragraphs,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
