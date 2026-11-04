import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { APPRAISAL_CATEGORIES, APPRAISAL_RATINGS, ratedCount } from "./appraisal-form.js";
import type { RequirementStatus, StaffDetail, StaffRecord } from "./training.service.js";

const STATUS_LABELS: Record<RequirementStatus, string> = { missing: "Not done", overdue: "Overdue", due_soon: "Due soon", ok: "Up to date" };

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

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level });
}

function orNone(rows: string[][], header: string[], empty: string) {
  return rows.length ? table(header, rows) : new Paragraph({ text: empty });
}

/** One person's training and competence record for a year (spec section 9). */
export async function buildCompetenceReport(s: StaffDetail, year: string): Promise<Buffer> {
  const training = s.training.filter((t) => t.date?.startsWith(year));
  const hours = training.reduce((sum, t) => sum + t.hours, 0);
  const records = (kind: string) => s.records.filter((r) => r.kind === kind);

  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: `Training and competence record — ${s.name} — ${year}`, heading: HeadingLevel.TITLE }),
    table(
      ["Detail", ""],
      [
        ["Position", s.position || "—"],
        ["Start date", ukDate(s.startDate)],
        ["Supervisor", s.supervisor || "—"],
        ["Induction recorded", s.inductionRecorded ? "Yes" : "No"],
        [`Training hours in ${year}`, String(hours)],
      ],
    ),
    heading("Supervision requirements"),
    new Paragraph({ text: s.supervisionRequirements || "None recorded." }),
    heading("Qualifications"),
    orNone(records("qualification").map((r) => [r.title, ukDate(r.recordDate), ukDate(r.dueDate), r.notes]), ["Qualification", "Obtained", "Renewal / expiry", "Notes"], "None recorded."),
    heading("Induction"),
    orNone(records("induction").map((r) => [r.title, ukDate(r.recordDate), r.notes]), ["Induction", "Date", "Notes"], "No induction recorded."),
    heading(`Training completed in ${year}`),
    orNone(training.map((t) => [ukDate(t.date), t.topic, t.provider, String(t.hours), t.evidence]), ["Date", "Topic", "Provider", "Hours", "Evidence"], "No training recorded for this year."),
    heading("Required training"),
    orNone(
      s.requirements.map((c) => [c.topic, c.everyMonths ? `Every ${c.everyMonths} months` : "Once", ukDate(c.lastCompleted), ukDate(c.nextDue), STATUS_LABELS[c.status]]),
      ["Topic", "Frequency", "Last completed", "Next due", "Status"],
      "The firm has not set any required training.",
    ),
    heading("Individual development plan"),
    orNone(records("development").map((r) => [r.title, ukDate(r.dueDate), r.done ? "Achieved" : "Open", r.notes]), ["Objective", "Target date", "Status", "Notes"], "No objectives recorded."),
  ];

  // Appraisals appear only when the person producing the report may see them (the Principal).
  if (s.canSeeAppraisals) {
    children.push(
      heading("Appraisals"),
      orNone(records("appraisal").map((r) => [ukDate(r.recordDate), r.title, r.score === null ? "—" : r.score.toFixed(2), ukDate(r.dueDate), r.notes]), ["Date", "Appraisal", "Score (out of 5)", "Next due", "Notes"], "No appraisals recorded."),
    );
  }

  children.push(
    heading("Certificates held"),
    orNone(records("certificate").map((r) => [r.title, ukDate(r.recordDate), r.file?.name ?? "—"]), ["Certificate", "Date", "File"], "None uploaded."),
  );

  const doc = new Document({ creator: "FG Compliance", title: `Competence record ${s.name} ${year}`, sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Firm-wide summary for the year: one line per active member of staff. */
export async function buildTrainingSummaryReport(staff: StaffDetail[], year: string): Promise<Buffer> {
  const rows = staff.map((s) => {
    const training = s.training.filter((t) => t.date?.startsWith(year));
    const gaps = s.requirements.filter((c) => c.status === "missing" || c.status === "overdue").map((c) => c.topic);
    return [
      s.name,
      s.position || "—",
      String(training.reduce((sum, t) => sum + t.hours, 0)),
      String(training.length),
      s.inductionRecorded ? "Yes" : "No",
      ukDate(s.lastAppraisal),
      ukDate(s.nextAppraisal),
      gaps.length ? gaps.join(", ") : "None",
    ];
  });
  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: `Training and competence summary — ${year}`, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `${staff.length} active staff. Training hours and courses count training completed in ${year}; missing or overdue training is as at the date of this report.` }),
    orNone(rows, ["Name", "Position", "Hours", "Courses", "Induction", "Last appraisal", "Next appraisal", "Missing or overdue training"], "No staff recorded."),
  ];
  const doc = new Document({ creator: "FG Compliance", title: `Training summary ${year}`, sections: [{ children }] });
  return Packer.toBuffer(doc);
}

const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Yes" : "No");

/** The firm's performance appraisal form (Master Register "Performance Evaluation" sheet), filled in. */
export async function buildAppraisalReport(name: string, supervisor: string, record: StaffRecord): Promise<Buffer> {
  const f = record.form;
  const label = (score: number | null | undefined) => (score ? `${score} – ${APPRAISAL_RATINGS.find((r) => r.score === score)?.label ?? ""}` : "Not rated");
  const lines = (text: string | undefined) => (text?.trim() ? text.split(/\n/).filter((l) => l.trim()).map((l) => new Paragraph({ text: l })) : [new Paragraph({ text: "—" })]);
  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: "Performance Appraisal — Legal Professionals", heading: HeadingLevel.TITLE }),
    table(
      ["", ""],
      [
        ["Employee name", name],
        ["Job title", f?.jobTitle || "—"],
        ["Department", f?.department || "—"],
        ["Supervisor", supervisor || "—"],
        ["Evaluation period", f?.evaluationPeriod || "—"],
        ["Date completed", ukDate(record.recordDate)],
        ["Goals updated / completed", `${yesNo(f?.goalsUpdated ?? null)}${f?.goalsDate ? ` (${ukDate(f.goalsDate)})` : ""}`],
        ["Annual compliance training completed", `${yesNo(f?.complianceTrainingDone ?? null)}${f?.complianceTrainingDate ? ` (${ukDate(f.complianceTrainingDate)})` : ""}`],
      ],
    ),
    new Paragraph({ text: "Performance summary", heading: HeadingLevel.HEADING_1 }),
    table(
      ["Category", "Rating", "Comments, justification or examples"],
      APPRAISAL_CATEGORIES.map((c) => [c.title, label(f?.ratings[c.key]?.score), f?.ratings[c.key]?.comment || ""]),
    ),
    new Paragraph({
      children: [
        new TextRun({
          text:
            record.score !== null
              ? `Total employee performance evaluation score: ${record.score.toFixed(2)} out of a possible 5.00`
              : `Total score not yet available: ${ratedCount(f)} of ${APPRAISAL_CATEGORIES.length} categories rated.`,
          bold: true,
        }),
      ],
    }),
    new Paragraph({ text: "Performance plan for next year", heading: HeadingLevel.HEADING_2 }),
    ...lines(f?.performancePlan),
    new Paragraph({ text: "Development needs and additional comments", heading: HeadingLevel.HEADING_2 }),
    ...lines(f?.developmentNeeds),
    new Paragraph({ text: "Organisation participation (projects or teams)", heading: HeadingLevel.HEADING_2 }),
    ...lines(f?.participation),
    new Paragraph({ text: "Employee's comments", heading: HeadingLevel.HEADING_2 }),
    ...lines(f?.employeeComments),
    new Paragraph({ text: "Signatures", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      text: `My supervisor has presented my performance evaluation to me and I have been given a chance to include my feedback. I ${
        f?.employeeAgrees === "agree" ? "AGREE" : f?.employeeAgrees === "disagree" ? "DISAGREE" : "agree / disagree"
      } with the rating score.`,
    }),
    table(
      ["", "Signature", "Date"],
      [
        ["Supervisor / evaluator", "", ""],
        ["Department head", "", ""],
        ["Employee", "", ""],
      ],
    ),
    new Paragraph({ text: "Ratings explained", heading: HeadingLevel.HEADING_2 }),
    table(["Score", "Rating", "Description"], APPRAISAL_RATINGS.map((r) => [String(r.score), r.label, r.description])),
  ];
  const doc = new Document({ creator: "FG Compliance", title: `Performance appraisal ${name}`, sections: [{ children }] });
  return Packer.toBuffer(doc);
}
