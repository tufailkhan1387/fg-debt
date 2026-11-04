import ExcelJS from "exceljs";
import JSZip from "jszip";
import path from "node:path";
import { query } from "../../db/pool.js";
import { readEncryptedFile } from "../../utils/encrypted-store.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { REGISTERS } from "../registers/registers.catalog.js";
import { todayIso } from "../registers/registers.helpers.js";
import { registersService, type RegisterActor } from "../registers/registers.service.js";
import { buildRegisterWorkbook } from "../registers/registers.workbook.js";
import { riskRegisterService } from "../risk-register/risk-register.service.js";
import { sqmService } from "../sqm/sqm.service.js";
import { trainingService } from "../training/training.service.js";

const FIRM_NAME = "Frantz Gregory & Co";

export interface PackOptions {
  policies: boolean;
  registers: boolean;
  /** Restricted register entries (complaints, breaches, safeguarding…) are left out unless asked for. */
  includeRestricted: boolean;
  riskRegister: boolean;
  training: boolean;
}

interface EvidenceFileRow {
  id: string;
  requirement_id: string;
  title: string;
  evidence_date: string;
  file_name: string | null;
  storage_path: string | null;
  sha256: string | null;
}

interface PolicyFileRow {
  policy_id: string;
  title: string;
  version_number: number;
  approved_on: string | null;
  file_name: string;
  storage_path: string;
  sha256: string;
}

interface PackEntry {
  path: string;
  source: string;
  description: string;
}

/** Windows-safe file or folder name. */
function safe(name: string, max = 90): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, max).trim();
}

/** Adds "(2)", "(3)"… so two files never share a path. */
function uniquePath(taken: Set<string>, wanted: string): string {
  const ext = path.posix.extname(wanted);
  const base = wanted.slice(0, wanted.length - ext.length);
  let candidate = wanted;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

async function evidenceFiles(): Promise<EvidenceFileRow[]> {
  return (
    await query<EvidenceFileRow>(
      `SELECT id, requirement_id, title, evidence_date::text AS evidence_date, file_name, storage_path, sha256
       FROM compliance_sqm_evidence ORDER BY evidence_date DESC, added_at DESC`,
    )
  ).rows;
}

/** The current approved version of every policy in force. */
async function policyFiles(): Promise<PolicyFileRow[]> {
  return (
    await query<PolicyFileRow>(
      `SELECT p.id AS policy_id, p.title, v.version_number, v.approved_on::text AS approved_on, v.file_name, v.storage_path, v.sha256
       FROM compliance_policies p JOIN compliance_policy_versions v ON v.id = p.current_version_id
       WHERE NOT p.archived ORDER BY LOWER(p.title)`,
    )
  ).rows;
}

async function registerEntries(actor: RegisterActor, includeRestricted: boolean) {
  return Promise.all(
    REGISTERS.map(async (def) => {
      const all = await registersService.list(def.key, actor);
      const entries = includeRestricted ? all : all.filter((e) => !e.restricted);
      return { def, entries, withheld: all.length - entries.length };
    }),
  );
}

export const auditPackService = {
  /** What a pack would contain, so the Principal can see it before building one. */
  async summary(actor: RegisterActor) {
    const [overview, evidence, policies, registers] = await Promise.all([sqmService.overview(), evidenceFiles(), policyFiles(), registerEntries(actor, true)]);
    return {
      requirements: overview.overall.total,
      readiness: overview.overall.readiness,
      missingEvidence: overview.missingEvidence,
      evidenceItems: evidence.length,
      evidenceFiles: evidence.filter((e) => e.storage_path).length,
      policiesInForce: policies.length,
      registerEntries: registers.reduce((s, r) => s + r.entries.length, 0),
      restrictedEntries: registers.reduce((s, r) => s + r.entries.filter((e) => e.restricted).length, 0),
    };
  },

  async build(options: PackOptions, actor: RegisterActor): Promise<{ buffer: Buffer; fileName: string }> {
    const today = todayIso();
    const zip = new JSZip();
    const taken = new Set<string>();
    const contents: PackEntry[] = [];
    const problems: string[] = [];
    const add = (wanted: string, data: Buffer, source: string, description: string) => {
      const p = uniquePath(taken, wanted);
      zip.file(p, data);
      contents.push({ path: p, source, description });
      return p;
    };

    // 01 — SQM readiness report.
    const overview = await sqmService.overview();
    add("01 SQM readiness report.xlsx", await sqmService.exportReadiness(actor), "SQM Checklist", "Readiness by section and requirement, with the evidence list");

    // 02 — Evidence files, by section and requirement.
    const sectionTitle = new Map(overview.sections.map((s) => [s.letter, s.title]));
    const byId = new Map(overview.requirements.map((r) => [r.id, r]));
    const evidencePaths = new Map<string, string>();
    for (const e of await evidenceFiles()) {
      if (!e.storage_path || !e.sha256) continue;
      const req = byId.get(e.requirement_id);
      if (!req) continue;
      const folder = `02 SQM evidence/Section ${req.section}${sectionTitle.get(req.section) ? ` - ${safe(sectionTitle.get(req.section)!, 50)}` : ""}`;
      const ext = path.extname(e.file_name ?? "") || "";
      try {
        const data = await readEncryptedFile(e.storage_path, e.sha256);
        evidencePaths.set(e.id, add(`${folder}/${safe(`${req.ref} - ${e.title}`)}${ext}`, data, `SQM ${req.ref}`, `${e.title} (${e.evidence_date})`));
      } catch {
        problems.push(`Evidence "${e.title}" for ${req.ref} could not be read or failed its integrity check, so it is not in the pack.`);
      }
    }

    // 03 — Policies in force.
    const policyPaths = new Map<string, string>();
    if (options.policies) {
      for (const p of await policyFiles()) {
        const ext = path.extname(p.file_name) || "";
        try {
          const data = await readEncryptedFile(p.storage_path, p.sha256);
          policyPaths.set(p.policy_id, add(`03 Policies/${safe(`${p.title} v${p.version_number}`)}${ext}`, data, "Policy Library", `Version ${p.version_number}${p.approved_on ? `, approved ${p.approved_on}` : ""}`));
        } catch {
          problems.push(`Policy "${p.title}" could not be read or failed its integrity check, so it is not in the pack.`);
        }
      }
    }

    // 04 — Registers.
    const withheld: string[] = [];
    if (options.registers) {
      for (const { def, entries, withheld: hidden } of await registerEntries(actor, options.includeRestricted)) {
        if (!entries.length && !hidden) continue;
        add(`04 Registers/${safe(def.title)}.xlsx`, await buildRegisterWorkbook(def, entries), "Compliance Registers", `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
        if (hidden) withheld.push(`${def.title}: ${hidden} restricted entr${hidden === 1 ? "y" : "ies"} left out`);
      }
    }

    // 05 — Risk register and training.
    if (options.riskRegister) add("05 Risk register.xlsx", await riskRegisterService.exportWorkbook(actor), "Risk Register", "All risks with ratings, controls and review dates");
    if (options.training) {
      const year = today.slice(0, 4);
      const report = await trainingService.summaryReport(year, actor);
      add(`05 Training and competence summary ${year}.docx`, report.buffer, "Staff Training", `Active staff, training hours and gaps for ${year}`);
    }

    // 00 — Index, written last so it lists everything.
    zip.file("00 Index.xlsx", await buildIndex({ overview, evidencePaths, policyPaths, contents, problems, withheld, options, actor, today }));

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await recordAccessLog({
      userId: actor.userId,
      userEmail: actor.email,
      action: "audit_pack.generated",
      entityType: "audit_pack",
      entityId: `SQM audit pack ${today}`,
      details: { files: contents.length + 1, options, problems: problems.length, restrictedIncluded: options.includeRestricted },
      ip: actor.ip ?? null,
    });
    return { buffer, fileName: `SQM audit pack ${today}.zip` };
  },
};

async function buildIndex(args: {
  overview: Awaited<ReturnType<typeof sqmService.overview>>;
  evidencePaths: Map<string, string>;
  policyPaths: Map<string, string>;
  contents: PackEntry[];
  problems: string[];
  withheld: string[];
  options: PackOptions;
  actor: RegisterActor;
  today: string;
}): Promise<Buffer> {
  const { overview, evidencePaths, policyPaths, contents, problems, withheld, options, actor, today } = args;
  const wb = new ExcelJS.Workbook();
  wb.creator = "FG Compliance";

  const about = wb.addWorksheet("About this pack");
  const lines: Array<[string, string]> = [
    ["Firm", FIRM_NAME],
    ["Prepared", today],
    ["Prepared by", actor.email],
    ["SQM requirements", String(overview.overall.total)],
    ["Readiness (requirements marked met)", overview.overall.readiness === null ? "Not yet assessed" : `${overview.overall.readiness}%`],
    ["Applicable requirements without evidence", String(overview.missingEvidence)],
    ["Policies included", options.policies ? "Yes — current version of each policy in force" : "No"],
    ["Registers included", options.registers ? (options.includeRestricted ? "Yes — including restricted entries" : "Yes — restricted entries left out") : "No"],
    ["Risk register included", options.riskRegister ? "Yes" : "No"],
    ["Training summary included", options.training ? "Yes" : "No"],
    ["Note", "Statuses are the firm's own assessment recorded in the system. This pack does not certify compliance."],
  ];
  for (const [k, v] of lines) about.addRow([k, v]);
  for (const note of [...withheld, ...problems]) about.addRow(["Not included", note]);
  about.getColumn(1).width = 40;
  about.getColumn(2).width = 100;
  about.getColumn(1).font = { bold: true };

  const index = wb.addWorksheet("Evidence index");
  index.addRow(["Section", "Ref", "Requirement", "Status", "Responsible", "Policies (file in pack)", "Evidence", "Evidence file in pack", "Gaps"]).font = { bold: true };
  const evidence = await evidenceFiles();
  const GAP_LABELS: Record<string, string> = {
    no_policy: "No linked policy",
    policy_not_in_force: "Linked policy not in force",
    no_evidence: "No evidence of practice",
    no_responsible: "No responsible person",
    review_overdue: "Review overdue",
    not_assessed: "Not assessed",
  };
  for (const r of overview.requirements) {
    const policies = r.policies.map((p) => `${p.title}${p.inForce ? "" : " (not in force)"}${policyPaths.has(p.id) ? ` → ${policyPaths.get(p.id)}` : ""}`).join("\n");
    const items = evidence.filter((e) => e.requirement_id === r.id);
    const status = r.status.replace(/_/g, " ");
    if (!items.length) {
      index.addRow([r.section, r.ref, r.requirement, status, r.responsible, policies, "None", "", r.gaps.map((g) => GAP_LABELS[g] ?? g).join(", ")]);
      continue;
    }
    for (const [i, e] of items.entries()) {
      index.addRow([
        i === 0 ? r.section : "",
        i === 0 ? r.ref : "",
        i === 0 ? r.requirement : "",
        i === 0 ? status : "",
        i === 0 ? r.responsible : "",
        i === 0 ? policies : "",
        `${e.title} (${e.evidence_date})`,
        evidencePaths.get(e.id) ?? (e.storage_path ? "Could not be included" : "No file (described only)"),
        i === 0 ? r.gaps.map((g) => GAP_LABELS[g] ?? g).join(", ") : "",
      ]);
    }
  }
  [8, 10, 50, 14, 20, 45, 40, 55, 30].forEach((w, i) => (index.getColumn(i + 1).width = w));
  index.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));

  const list = wb.addWorksheet("Contents");
  list.addRow(["File in pack", "From", "Description"]).font = { bold: true };
  for (const c of contents) list.addRow([c.path, c.source, c.description]);
  list.getColumn(1).width = 80;
  list.getColumn(2).width = 22;
  list.getColumn(3).width = 60;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
