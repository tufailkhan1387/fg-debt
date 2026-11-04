import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { FileReviewDetail } from "./file-reviews.service.js";

const ANSWER_LABELS = { yes: "Yes", no: "No", na: "N/A" } as const;

function cell(text: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
}

function table(header: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) }))],
  });
}

function ukDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** The file review report (spec section 8): details, checklist answers, findings and corrective actions. */
export async function buildFileReviewReport(review: FileReviewDetail): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: `File review report — ${review.ref ?? "DRAFT"}`, heading: HeadingLevel.TITLE }),
    table(
      ["Detail", ""],
      [
        ["Matter reference", review.matterRef],
        ["Matter type", review.matterType || "—"],
        ["Fee earner", review.feeEarner || "—"],
        ["Reviewer", review.reviewer || "—"],
        ["Review date", ukDate(review.reviewDate)],
        ["Status", review.status === "completed" ? `Completed by ${review.completedBy ?? "—"} on ${ukDate(review.completedAt)}` : "Draft — not completed"],
        ["Questions answered \"No\"", String(review.issues)],
      ],
    ),
    new Paragraph({ text: "Checklist", heading: HeadingLevel.HEADING_1 }),
  ];

  const sections = [...new Set(review.checklist.map((c) => c.section))];
  for (const section of sections) {
    children.push(new Paragraph({ text: section || "General", heading: HeadingLevel.HEADING_2 }));
    children.push(
      table(
        ["Question", "Answer", "Comment"],
        review.checklist.filter((c) => c.section === section).map((c) => [c.question, c.answer ? ANSWER_LABELS[c.answer] : "Not answered", c.comment || ""]),
      ),
    );
  }

  children.push(new Paragraph({ text: "Findings", heading: HeadingLevel.HEADING_1 }));
  for (const line of (review.findings || "None recorded.").split(/\n/).filter((l) => l.trim())) {
    children.push(new Paragraph({ text: line }));
  }

  children.push(new Paragraph({ text: "Corrective actions", heading: HeadingLevel.HEADING_1 }));
  if (review.status === "completed") {
    children.push(
      review.correctiveActions.length
        ? table(
            ["Ref", "Action", "Responsible", "Due", "Status", "Completed"],
            review.correctiveActions.map((e) => [
              e.ref,
              String(e.data["action"] ?? ""),
              String(e.data["responsible"] ?? ""),
              ukDate(e.data["dueDate"] as string | null),
              String(e.data["status"] ?? ""),
              ukDate(e.data["dateCompleted"] as string | null),
            ]),
          )
        : new Paragraph({ text: "No corrective action required." }),
    );
  } else {
    children.push(
      review.draftActions.length
        ? table(["Action", "Responsible", "Due"], review.draftActions.map((a) => [a.action, a.responsible, ukDate(a.dueDate)]))
        : new Paragraph({ text: "None yet." }),
    );
  }

  const doc = new Document({ creator: "FG Compliance", title: `File review ${review.ref ?? "draft"}`, sections: [{ children }] });
  return Packer.toBuffer(doc);
}
