import { policyLibraryService } from "../policy-library/policy-library.service.js";
import { runAssistantTool, type AssistantActor, type SourceRegistry } from "../compliance-assistant/assistant.tools.js";

/** How many in-force policies are read in full, and how much of each, for the policy and regulatory analyses. */
const POLICIES_READ = 10;
const POLICY_CHARS = 6_000;

export type InsightKey = "overall" | "sqm" | "policies" | "risks" | "file_reviews" | "training" | "finance" | "complaints" | "regulatory";

interface Gather {
  actor: AssistantActor;
  sources: SourceRegistry;
}

export interface InsightKind {
  key: InsightKey;
  title: string;
  /** What the analysis does, shown on the page. */
  description: string;
  /** Spec section the AI function comes from. */
  spec: string;
  /** The analysis needs a regulatory update pasted in by the Principal. */
  needsText?: boolean;
  task: string;
  gather: (g: Gather) => Promise<string>;
}

/** Runs read-only tools (the same ones the assistant uses: redacted, restricted entries never included). */
async function records(g: Gather, calls: Array<[string, Record<string, unknown>]>): Promise<string> {
  const parts: string[] = [];
  for (const [name, args] of calls) {
    const label = [name, ...Object.values(args).filter((v) => typeof v === "string")].join(" ");
    parts.push(`<records source="${label}">\n${await runAssistantTool(name, args, g.actor, g.sources)}\n</records>`);
  }
  return parts.join("\n\n");
}

async function policyTexts(g: Gather): Promise<string> {
  const inForce = (await policyLibraryService.list(g.actor)).policies.filter((p) => !p.archived && p.currentVersion).slice(0, POLICIES_READ);
  return records(g, inForce.map((p) => ["policy_text", { policy: p.title, limit: POLICY_CHARS }] as [string, Record<string, unknown>]));
}

const register = (key: string): [string, Record<string, unknown>] => ["register_entries", { register: key, open_only: false }];

export const INSIGHT_KINDS: InsightKind[] = [
  {
    key: "overall",
    title: "Compliance priorities",
    description: "Reads the headline position across every area and recommends what the Principal should deal with first.",
    spec: "Dashboard (section 15)",
    task: "Give the Principal a prioritised view of the firm's compliance position across all areas: what is most urgent, what is drifting, and the next actions, most important first.",
    gather: (g) => records(g, [["firm_overview", {}], ["deadlines", { window: "overdue" }], ["deadlines", { window: "next_30_days" }], ["sqm_requirements", { filter: "gaps", section: null }], ["risks", { filter: "high" }]]),
  },
  {
    key: "sqm",
    title: "SQM evidence and gaps",
    description: "Checks each SQM requirement for missing policies, missing evidence of practice and overdue reviews, and suggests the evidence to gather.",
    spec: "SQM checklist (section 5)",
    task: "Assess the firm's SQM readiness from the requirements, their linked policies and evidence. Identify requirements with weak or missing evidence, policies linked but not in force, and overdue reviews, and recommend the evidence or work needed for each. Do not invent SQM requirements: work only from those listed.",
    gather: (g) => records(g, [["sqm_requirements", { filter: "all", section: null }], ["policies", { filter: "all" }]]),
  },
  {
    key: "policies",
    title: "Policy review",
    description: "Reads the policies in force for inconsistencies between them, outdated or missing content, and reviews that are due.",
    spec: "Policy library (section 6)",
    task: "Review the firm's policies. Look for inconsistencies between policies (for example different timescales or responsibilities for the same thing), content that looks outdated or incomplete, policies the firm appears to lack, and reviews that are due or overdue. Recommend specific updates. Only the policies in force listed in the records were read in full (and only the first part of long ones); say so where it matters.",
    gather: async (g) => `${await records(g, [["policies", { filter: "all" }]])}\n\n${await policyTexts(g)}`,
  },
  {
    key: "risks",
    title: "Risk review",
    description: "Looks for risks the register may be missing (from complaints, incidents and breaches), weak controls and overdue reviews, and recommends controls.",
    spec: "Risk register (section 7)",
    task: "Review the firm's risk register. Identify risks that may be missing given the complaints, incidents and data breaches recorded, risks whose controls look weak for their level, and reviews that are overdue or awaiting approval. Recommend controls or further actions for each. Suggested new risks are suggestions for the Principal to consider, not entries.",
    gather: (g) => records(g, [["risks", { filter: "all" }], register("complaints"), register("incidents"), register("data_breaches"), register("corrective_actions")]),
  },
  {
    key: "file_reviews",
    title: "File review trends",
    description: "Finds recurring issues across file reviews and corrective actions, likely causes and training or process changes.",
    spec: "File reviews and supervision (section 8)",
    task: "Analyse the firm's file reviews. Identify recurring issues, the matters or areas they cluster in, likely causes, and whether corrective actions are being closed. Recommend supervision, training or process changes.",
    gather: (g) => records(g, [["file_reviews", {}], register("corrective_actions"), register("file_reviews")]),
  },
  {
    key: "training",
    title: "Training plan and competence",
    description: "Builds a training plan from missing and overdue training, appraisals and file-review issues, as a basis for the annual competence report.",
    spec: "Staff training and competence (section 9)",
    task: "Prepare a training plan for the coming year and the main points for an annual competence report. For each member of staff with gaps, say what training is missing or overdue and whether appraisals or induction are outstanding. Link training needs to recurring file-review issues where the records support it. Do not invent required training: work from the firm's list and the records.",
    gather: (g) => records(g, [["training_status", {}], register("training"), ["file_reviews", {}]]),
  },
  {
    key: "finance",
    title: "Financial and business review",
    description: "Reviews the business plan, budget variances, financial reviews and continuity tests for what is overdue or needs attention.",
    spec: "Financial and business compliance (section 10)",
    task: "Review the firm's financial and business compliance activities: what is overdue or due soon, budget quarters not signed off and flagged variances, and the business continuity position. Recommend actions and points to cover in the next financial review.",
    gather: (g) => records(g, [["business_activities", {}], register("bcp_tests"), register("management_reviews"), register("performance")]),
  },
  {
    key: "complaints",
    title: "Complaints and feedback",
    description: "Looks for causes and patterns in complaints, incidents and client feedback, and suggests improvements.",
    spec: "Registers (section 11)",
    task: "Analyse complaints, incidents and client feedback. Identify common causes, patterns over time, how quickly complaints are handled, and improvements to service or procedures. Restricted entries are not included; say so if that may change the picture.",
    gather: (g) => records(g, [register("complaints"), register("incidents"), register("client_feedback"), register("corrective_actions")]),
  },
  {
    key: "regulatory",
    title: "Regulatory change impact",
    description: "Paste an SRA, SQM or legal update: the AI reads it against the firm's policies and risks and lists what may need to change.",
    spec: "Phase 4 (regulatory monitoring)",
    needsText: true,
    task: "The Principal has supplied a regulatory update (in <update>). Explain in plain terms what it changes, then identify which of the firm's policies, risks or SQM requirements may be affected and what may need updating. Base the description of the update only on the text supplied; do not add requirements it does not contain. Where a policy was not read in full, say its impact could not be checked.",
    gather: async (g) => `${await records(g, [["policies", { filter: "all" }], ["risks", { filter: "all" }], ["sqm_requirements", { filter: "all", section: null }]])}\n\n${await policyTexts(g)}`,
  },
];

export function insightKind(key: string): InsightKind | undefined {
  return INSIGHT_KINDS.find((k) => k.key === key);
}
