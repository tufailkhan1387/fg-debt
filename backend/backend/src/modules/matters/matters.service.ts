import { query } from "../../db/pool.js";

import { AppError } from "../../middleware/appError.js";

import type {

  MatterCreateContext,

  MatterDecisionInput,
  MatterCloseInput,

  MatterDetailData,

  MatterFull,

  MatterRow,

  MatterStatus,

  MatterSummary,

  RiskLevel,

  VulnerabilityFlag,

} from "./matters.types.js";

import type { CreateMatterInput } from "./matters.validators.js";
import type { AssessmentValues } from "../client/assessment-mapper.js";
import { analyzeMatterForRecommendation } from "../ai/recommendation-engine.js";
import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterMessage } from "../messages/messages.types.js";
import { createWelcomeMessage } from "../messages/messages.helpers.js";
import {
  buildAdvicePackage,
  createClientTaskForReject,
  createDecisionClientMessage,
  nextActionForDecision,
  resolveFinalSolution,
} from "../advice/advice.helpers.js";
import { buildReferralLetterDocument } from "../advice/advice.generator.js";
import type { MatterTask } from "../tasks/tasks.types.js";
import { computeTaskMetrics } from "../tasks/tasks.helpers.js";
import type { MatterReferral, ReferralStatus } from "../referrals/referrals.types.js";
import type { MatterNote } from "../notes/notes.types.js";
import {
  assertCanCloseMatter,
  buildClosingLetterDocument,
  buildClosureRecord,
  closureNextAction,
  createClosureClientMessage,
  outcomeAuditLabel,
} from "../closure/closure.helpers.js";

export interface ClientAssessmentMatterInput {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  niNumber: string;
  dob: string;
  employmentStatus: string;
  employerName: string;
  monthlyNetIncome: number;
  benefitsIncome: number;
  totalIncome: number;
  monthlyExpenses: number;
  disposableIncome: number;
  priorityDebtTotal: number;
  nonPriorityDebtTotal: number;
  totalDebt: number;
  riskLevel: RiskLevel;
  vulnerability: VulnerabilityFlag;
  vulnerabilityNotes?: string;
  nextRequiredAction: string;
  debts: unknown[];
  assets: unknown[];
  assessmentValues: AssessmentValues;
}



function asDateString(value: Date | string | null): string {

  if (!value) return "";

  if (typeof value === "string") return value.slice(0, 10);

  return value.toISOString().slice(0, 10);

}



function asTimestampString(value: Date | string | null | undefined): string {

  if (!value) return new Date().toISOString().replace("T", " ").substring(0, 16);

  if (typeof value === "string") return value.replace("T", " ").substring(0, 16);

  return value.toISOString().replace("T", " ").substring(0, 16);

}



function emptyDetail(): MatterDetailData {
  return {
    aiReasoning: [],
    alternativeSolutions: [],
    rejectedSolutions: [],
    debts: [],
    assets: [],
    documents: [],
    tasks: [],
    auditHistory: [],
    referrals: [],
    notes: [],
    messages: [],
  };
}

export function toMatterSummary(row: MatterRow): MatterSummary {
  return {
    id: row.id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    assignedSolicitor: row.assigned_solicitor,
    status: row.status,
    riskLevel: row.risk_level,
    vulnerability: row.vulnerability,
    totalDebt: Number(row.total_debt),
    disposableIncome: Number(row.disposable_income),
    aiRecommendedSolution: row.ai_recommended_solution,
    aiConfidenceScore: row.ai_confidence_score,
    nextRequiredAction: row.next_required_action ?? "",
    dueDate: asDateString(row.due_date),
    createdAt: asDateString(row.created_at),
    updatedAt: asDateString(row.updated_at),
    hasUrgentPendingTask: row.has_urgent_pending_task,
    hasTaskSentToClient: row.has_task_sent_to_client,
    documentsNeedingReview: row.documents_needing_review,
    overdueTaskCount: row.overdue_task_count,
  };
}

function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

async function generateMatterId(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const id = `MAT-${year}-${suffix}`;
    const existing = await query<{ id: string }>("SELECT id FROM matters WHERE id = $1 LIMIT 1", [id]);
    if (existing.rows.length === 0) {
      return id;
    }
  }
  throw new AppError("Could not generate a unique matter ID.", 500, "MATTER_ID_GENERATION_FAILED");
}

async function findClientUserId(clientEmail: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND role = 'client' LIMIT 1",
    [clientEmail],
  );
  return result.rows[0]?.id ?? null;
}

async function getDefaultSolicitor(): Promise<{ name: string; email: string }> {
  const result = await query<{ first_name: string; last_name: string; email: string }>(
    `SELECT first_name, last_name, email
     FROM users
     WHERE role = 'solicitor'
     ORDER BY created_at ASC
     LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError("No solicitor account is configured.", 500, "NO_SOLICITOR");
  }
  return {
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
  };
}

function buildAssessmentDetailData(
  input: ClientAssessmentMatterInput,
  existing: MatterFull | null,
  solicitorName: string,
  clientName: string,
): MatterDetailData {
  const submittedAt = asTimestampString(new Date());
  const auditRecord = {
    id: `AUD-${Date.now()}`,
    user: clientName,
    role: "Client",
    timestamp: submittedAt,
    section: "Assessment",
    previousValue: existing?.status ?? "None",
    newValue: "Awaiting Review",
    reason: "Client submitted debt assessment.",
  };

  const task = {
    id: `T-${Date.now()}`,
    title: "Review submitted client assessment",
    assignee: solicitorName,
    type: "solicitor_review",
    dueDate: defaultDueDate(),
    priority: "high",
    status: "pending",
    description: "Client assessment submitted and requires solicitor triage.",
  };

  return {
    ...emptyDetail(),
    clientPhone: input.clientPhone,
    clientAddress: input.clientAddress,
    niNumber: input.niNumber,
    dob: input.dob,
    employmentStatus: input.employmentStatus,
    employerName: input.employerName,
    monthlyNetIncome: input.monthlyNetIncome,
    benefitsIncome: input.benefitsIncome,
    totalIncome: input.totalIncome,
    monthlyExpenses: input.monthlyExpenses,
    vulnerabilityNotes: input.vulnerabilityNotes,
    priorityDebtTotal: input.priorityDebtTotal,
    nonPriorityDebtTotal: input.nonPriorityDebtTotal,
    aiReasoning: existing?.aiReasoning ?? [],
    alternativeSolutions: existing?.alternativeSolutions ?? [],
    rejectedSolutions: existing?.rejectedSolutions ?? [],
    solicitorDecision: existing?.solicitorDecision,
    debts: input.debts,
    assets: input.assets,
    documents: existing?.documents ?? [],
    tasks: [task, ...(existing?.tasks ?? [])],
    auditHistory: [auditRecord, ...(existing?.auditHistory ?? [])],
    referrals: existing?.referrals ?? [],
    notes: existing?.notes ?? [],
    messages: existing?.messages ?? [],
    assessmentSubmittedAt: submittedAt,
    assessmentValues: input.assessmentValues,
  };
}



function toMatterFull(row: MatterRow & { detail_data: MatterDetailData | null }): MatterFull {

  const summary = toMatterSummary(row);

  const detail = row.detail_data ?? emptyDetail();



  return {

    ...summary,

    clientPhone: detail.clientPhone ?? "",

    clientAddress: detail.clientAddress ?? "",

    niNumber: detail.niNumber ?? "",

    dob: detail.dob ?? "",

    employmentStatus: detail.employmentStatus ?? "",

    employerName: detail.employerName ?? "",

    monthlyNetIncome: detail.monthlyNetIncome ?? 0,

    benefitsIncome: detail.benefitsIncome ?? 0,

    totalIncome: detail.totalIncome ?? 0,

    monthlyExpenses: detail.monthlyExpenses ?? 0,

    vulnerabilityNotes: detail.vulnerabilityNotes,

    priorityDebtTotal: detail.priorityDebtTotal ?? 0,

    nonPriorityDebtTotal: detail.nonPriorityDebtTotal ?? 0,

    aiReasoning: detail.aiReasoning ?? [],

    alternativeSolutions: detail.alternativeSolutions ?? [],

    rejectedSolutions: detail.rejectedSolutions ?? [],

    solicitorDecision: detail.solicitorDecision,

    debts: detail.debts ?? [],

    assets: detail.assets ?? [],

    documents: detail.documents ?? [],

    tasks: detail.tasks ?? [],

    auditHistory: detail.auditHistory ?? [],

    referrals: detail.referrals ?? [],

    notes: detail.notes ?? [],

    messages: detail.messages ?? [],

    assessmentSubmittedAt: detail.assessmentSubmittedAt,

    assessmentValues: detail.assessmentValues,

    aiRecommendationDetail: detail.aiRecommendationDetail,

    adviceDocuments: detail.adviceDocuments ?? [],

    matterClosure: detail.matterClosure,

    complianceAlertResolutions: detail.complianceAlertResolutions,

    identityVerification: detail.identityVerification,

  };

}

function snapshotDetailFromMatter(matter: MatterFull): MatterDetailData {
  return {
    clientPhone: matter.clientPhone,
    clientAddress: matter.clientAddress,
    niNumber: matter.niNumber,
    dob: matter.dob,
    employmentStatus: matter.employmentStatus,
    employerName: matter.employerName,
    monthlyNetIncome: matter.monthlyNetIncome,
    benefitsIncome: matter.benefitsIncome,
    totalIncome: matter.totalIncome,
    monthlyExpenses: matter.monthlyExpenses,
    vulnerabilityNotes: matter.vulnerabilityNotes,
    priorityDebtTotal: matter.priorityDebtTotal,
    nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
    aiReasoning: matter.aiReasoning,
    alternativeSolutions: matter.alternativeSolutions,
    rejectedSolutions: matter.rejectedSolutions,
    aiRecommendationDetail: matter.aiRecommendationDetail,
    solicitorDecision: matter.solicitorDecision,
    debts: matter.debts,
    assets: matter.assets,
    documents: matter.documents,
    tasks: matter.tasks,
    auditHistory: matter.auditHistory,
    referrals: matter.referrals,
    notes: matter.notes,
    messages: matter.messages,
    assessmentSubmittedAt: matter.assessmentSubmittedAt,
    assessmentValues: matter.assessmentValues,
    adviceDocuments: matter.adviceDocuments,
    matterClosure: matter.matterClosure,
    complianceAlertResolutions: matter.complianceAlertResolutions,
    identityVerification: matter.identityVerification,
  };
}



function statusForDecision(action: MatterDecisionInput["action"]): MatterStatus {

  switch (action) {

    case "approve":

      return "approved";

    case "amend":

      return "amended";

    case "reject":

      return "client_response_required";

    case "override":

      return "overridden";

  }

}



export const mattersService = {

  async listForSolicitor(solicitorEmail: string): Promise<MatterSummary[]> {

    const result = await query<MatterRow>(

      `SELECT * FROM matters

       WHERE LOWER(assigned_solicitor_email) = LOWER($1)

       ORDER BY

         CASE

           WHEN status = 'urgent_review' THEN 0

           WHEN risk_level = 'critical' THEN 1

           WHEN status = 'awaiting_review' THEN 2

           ELSE 3

         END,

         due_date ASC NULLS LAST,

         updated_at DESC`,

      [solicitorEmail],

    );

    return result.rows.map(toMatterSummary);

  },



  async listFullForSolicitor(solicitorEmail: string): Promise<MatterFull[]> {

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(

      `SELECT * FROM matters

       WHERE LOWER(assigned_solicitor_email) = LOWER($1)

       ORDER BY

         CASE

           WHEN status = 'urgent_review' THEN 0

           WHEN risk_level = 'critical' THEN 1

           WHEN status = 'awaiting_review' THEN 2

           ELSE 3

         END,

         due_date ASC NULLS LAST,

         updated_at DESC`,

      [solicitorEmail],

    );

    return result.rows.map(toMatterFull);

  },



  async getByIdForSolicitor(solicitorEmail: string, matterId: string): Promise<MatterFull> {

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(

      `SELECT * FROM matters

       WHERE id = $1 AND LOWER(assigned_solicitor_email) = LOWER($2)`,

      [matterId, solicitorEmail],

    );



    if (result.rows.length === 0) {

      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");

    }



    return toMatterFull(result.rows[0]);

  },



  async recordDecision(

    solicitorEmail: string,

    matterId: string,

    input: MatterDecisionInput,

  ): Promise<MatterFull> {

    const existing = await this.getByIdForSolicitor(solicitorEmail, matterId);

    const previousStatus = existing.status;

    const nextStatus = statusForDecision(input.action);

    const decidedAt = asTimestampString(new Date());

    const finalSolution = resolveFinalSolution(existing, input.action, input.amendedSolution);

    const adviceDocuments = buildAdvicePackage(existing, finalSolution, decidedAt, input.action);

    const decisionMessage = createDecisionClientMessage(

      input.solicitorName,

      existing.clientName,

      input.action,

      finalSolution,

    );

    const rejectTask =

      input.action === "reject" ? createClientTaskForReject(input.solicitorName, input.notes) : null;



    const auditRecord = {

      id: `AUD-${Date.now()}`,

      user: input.solicitorName,

      role: "Solicitor",

      timestamp: decidedAt,

      section: "Solicitor Decision",

      previousValue: previousStatus,

      newValue: nextStatus,

      reason: input.notes,

    };



    const note = {

      id: `N-${Date.now()}`,

      author: input.solicitorName,

      role: "Solicitor",

      date: decidedAt,

      content: `Solicitor Action [${input.action.toUpperCase()}]: ${input.notes}`,

      isInternal: true,

    };



    const nextDetail: MatterDetailData = {

      clientPhone: existing.clientPhone,

      clientAddress: existing.clientAddress,

      niNumber: existing.niNumber,

      dob: existing.dob,

      employmentStatus: existing.employmentStatus,

      employerName: existing.employerName,

      monthlyNetIncome: existing.monthlyNetIncome,

      benefitsIncome: existing.benefitsIncome,

      totalIncome: existing.totalIncome,

      monthlyExpenses: existing.monthlyExpenses,

      vulnerabilityNotes: existing.vulnerabilityNotes,

      priorityDebtTotal: existing.priorityDebtTotal,

      nonPriorityDebtTotal: existing.nonPriorityDebtTotal,

      aiReasoning: existing.aiReasoning,

      alternativeSolutions: existing.alternativeSolutions,

      rejectedSolutions: existing.rejectedSolutions,

      solicitorDecision: {

        action: input.action,

        solicitorName: input.solicitorName,

        decidedAt,

        notes: input.notes,

        amendedSolution: input.amendedSolution,

      },

      adviceDocuments,

      debts: existing.debts,

      assets: existing.assets,

      documents: existing.documents,

      tasks: rejectTask ? [rejectTask, ...existing.tasks] : existing.tasks,

      auditHistory: [auditRecord, ...existing.auditHistory],

      referrals: existing.referrals,

      notes: [note, ...existing.notes],

      messages: [...(existing.messages ?? []), decisionMessage],

      assessmentSubmittedAt: existing.assessmentSubmittedAt,

      assessmentValues: existing.assessmentValues,

      aiRecommendationDetail: existing.aiRecommendationDetail,

    };



    const solutionChanged =

      input.action === "amend" || input.action === "override" ? finalSolution : existing.aiRecommendedSolution;



    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(

      `UPDATE matters

       SET

         status = $3,

         ai_recommended_solution = $4,

         next_required_action = $5,

         has_task_sent_to_client = $6,

         has_urgent_pending_task = $7,

         detail_data = $8::jsonb,

         updated_at = NOW()

       WHERE id = $1 AND LOWER(assigned_solicitor_email) = LOWER($2)

       RETURNING *`,

      [

        matterId,

        solicitorEmail,

        nextStatus,

        solutionChanged,

        nextActionForDecision(input.action),

        input.action === "reject",

        input.action === "reject",

        JSON.stringify(nextDetail),

      ],

    );



    if (result.rows.length === 0) {

      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");

    }



    return toMatterFull(result.rows[0]);

  },

  async getForClient(clientUserId: string, clientEmail: string): Promise<MatterFull | null> {
    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `SELECT * FROM matters
       WHERE client_user_id = $1 OR LOWER(client_email) = LOWER($2)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [clientUserId, clientEmail],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return toMatterFull(result.rows[0]);
  },

  async createForSolicitor(context: MatterCreateContext, input: CreateMatterInput): Promise<MatterFull> {
    const matterId = await generateMatterId();
    const clientUserId = await findClientUserId(input.clientEmail);
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = input.dueDate ?? defaultDueDate();
    const openedAt = asTimestampString(new Date());

    const detailData: MatterDetailData = {
      ...emptyDetail(),
      clientPhone: input.clientPhone ?? "",
      clientAddress: input.clientAddress ?? "",
      monthlyNetIncome: 0,
      benefitsIncome: 0,
      totalIncome: 0,
      monthlyExpenses: 0,
      priorityDebtTotal: 0,
      nonPriorityDebtTotal: 0,
      auditHistory: [
        {
          id: `AUD-${Date.now()}`,
          user: context.solicitorName,
          role: "Solicitor",
          timestamp: openedAt,
          section: "Matter Status",
          previousValue: "None",
          newValue: "New Matter",
          reason: "Matter opened via solicitor intake.",
        },
      ],
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `INSERT INTO matters (
         id, client_user_id, client_name, client_email, assigned_solicitor, assigned_solicitor_email,
         status, risk_level, vulnerability, total_debt, disposable_income,
         ai_recommended_solution, ai_confidence_score, next_required_action, due_date,
         has_urgent_pending_task, has_task_sent_to_client, documents_needing_review, overdue_task_count,
         created_at, updated_at, detail_data
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         'new', $7, $8, $9, $10,
         $11, $12, $13, $14,
         FALSE, FALSE, 0, 0,
         $15, NOW(), $16::jsonb
       )
       RETURNING *`,
      [
        matterId,
        clientUserId,
        input.clientName,
        input.clientEmail,
        context.solicitorName,
        context.solicitorEmail,
        input.riskLevel ?? "medium",
        input.vulnerability ?? "none",
        input.totalDebt ?? 0,
        input.disposableIncome ?? 0,
        "Pending AI analysis",
        0,
        input.nextRequiredAction ?? "Complete client intake and upload supporting documents",
        dueDate,
        today,
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async applyAiRecommendation(matter: MatterFull): Promise<MatterFull> {
    const recommendation = analyzeMatterForRecommendation(matter);
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: "FG Debt Advisor AI",
      role: "AI Engine",
      timestamp: submittedAt,
      section: "AI Recommendation",
      previousValue: matter.aiRecommendedSolution,
      newValue: recommendation.solution,
      reason: `Recommendation generated at ${recommendation.confidence}% confidence.`,
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: recommendation.reasoning,
      alternativeSolutions: recommendation.alternativeSolutions,
      rejectedSolutions: recommendation.rejectedSolutions,
      solicitorDecision: matter.solicitorDecision,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
      aiRecommendationDetail: {
        summary: recommendation.summary,
        advantages: recommendation.advantages,
        disadvantages: recommendation.disadvantages,
        alternatives: recommendation.alternatives,
      },
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         ai_recommended_solution = $2,
         ai_confidence_score = $3,
         next_required_action = $4,
         has_urgent_pending_task = TRUE,
         updated_at = NOW(),
         detail_data = $5::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matter.id,
        recommendation.solution,
        recommendation.confidence,
        "Review AI recommendation and approve client advice",
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async upsertFromClientAssessment(
    clientUserId: string,
    clientEmail: string,
    input: ClientAssessmentMatterInput,
  ): Promise<MatterFull> {
    const solicitor = await getDefaultSolicitor();
    const existing = await this.getForClient(clientUserId, clientEmail);
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = defaultDueDate();
    const detailData = buildAssessmentDetailData(input, existing, solicitor.name, input.clientName);
    const linkedClientId = clientUserId || (await findClientUserId(input.clientEmail));

    if (existing) {
      const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
        `UPDATE matters
         SET
           client_user_id = COALESCE($2, client_user_id),
           client_name = $3,
           client_email = $4,
           status = 'awaiting_review',
           risk_level = $5,
           vulnerability = $6,
           total_debt = $7,
           disposable_income = $8,
           ai_recommended_solution = 'Pending AI analysis',
           ai_confidence_score = 0,
           next_required_action = $9,
           due_date = $10,
           has_urgent_pending_task = TRUE,
           documents_needing_review = 0,
           updated_at = NOW(),
           detail_data = $11::jsonb
         WHERE id = $1
         RETURNING *`,
        [
          existing.id,
          linkedClientId,
          input.clientName,
          input.clientEmail,
          input.riskLevel,
          input.vulnerability,
          input.totalDebt,
          input.disposableIncome,
          input.nextRequiredAction,
          dueDate,
          JSON.stringify(detailData),
        ],
      );

      return this.applyAiRecommendation(toMatterFull(result.rows[0]));
    }

    const matterId = await generateMatterId();
    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `INSERT INTO matters (
         id, client_user_id, client_name, client_email, assigned_solicitor, assigned_solicitor_email,
         status, risk_level, vulnerability, total_debt, disposable_income,
         ai_recommended_solution, ai_confidence_score, next_required_action, due_date,
         has_urgent_pending_task, has_task_sent_to_client, documents_needing_review, overdue_task_count,
         created_at, updated_at, detail_data
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         'awaiting_review', $7, $8, $9, $10,
         'Pending AI analysis', 0, $11, $12,
         TRUE, FALSE, 0, 0,
         $13, NOW(), $14::jsonb
       )
       RETURNING *`,
      [
        matterId,
        linkedClientId,
        input.clientName,
        input.clientEmail,
        solicitor.name,
        solicitor.email,
        input.riskLevel,
        input.vulnerability,
        input.totalDebt,
        input.disposableIncome,
        input.nextRequiredAction,
        dueDate,
        today,
        JSON.stringify(detailData),
      ],
    );

    const analysed = await this.applyAiRecommendation(toMatterFull(result.rows[0]));
    return this.addMessage(
      analysed.id,
      createWelcomeMessage(solicitor.name, input.clientName),
      solicitor.name,
    );
  },

  async addDocument(matterId: string, document: MatterDocument, clientName: string): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: clientName,
      role: "Client",
      timestamp: submittedAt,
      section: "Documents",
      previousValue: `${matter.documents.length} uploaded`,
      newValue: `${matter.documents.length + 1} uploaded`,
      reason: `Client uploaded ${document.name}.`,
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      debts: matter.debts,
      assets: matter.assets,
      documents: [...matter.documents, document],
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const pendingReviewCount = [...matter.documents, document].filter(
      (doc) => (doc as MatterDocument).verificationStatus === "pending",
    ).length;

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         documents_needing_review = $2,
         has_urgent_pending_task = TRUE,
         next_required_action = $3,
         updated_at = NOW(),
         detail_data = $4::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        pendingReviewCount,
        "Review newly uploaded client documents",
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async verifyDocument(
    solicitorEmail: string,
    matterId: string,
    documentId: string,
    status: "verified" | "flagged",
    solicitorName: string,
    notes?: string,
  ): Promise<MatterFull> {
    const matter = await this.getByIdForSolicitor(solicitorEmail, matterId);
    const documents = matter.documents as MatterDocument[];
    const index = documents.findIndex((doc) => doc.id === documentId);
    if (index === -1) {
      throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
    }

    const current = documents[index]!;
    const updatedDocument: MatterDocument = {
      ...current,
      verificationStatus: status,
      ocrStatus: status === "verified" ? "completed" : "needs_review",
      confidenceScore: status === "verified" ? Math.max(current.confidenceScore, 96) : 72,
      extractedInfo: {
        ...current.extractedInfo,
        ...(status === "flagged" && notes ? { "Review note": notes } : {}),
        ...(status === "verified" ? { "Verified by": solicitorName } : {}),
      },
    };

    const nextDocuments = documents.map((doc, docIndex) => (docIndex === index ? updatedDocument : doc));
    const pendingReviewCount = nextDocuments.filter((doc) => doc.verificationStatus === "pending").length;
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: solicitorName,
      role: "Solicitor",
      timestamp: submittedAt,
      section: "Documents",
      previousValue: current.verificationStatus,
      newValue: status,
      reason: notes?.trim() || `${current.name} marked as ${status}.`,
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      debts: matter.debts,
      assets: matter.assets,
      documents: nextDocuments,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         documents_needing_review = $2,
         has_urgent_pending_task = CASE WHEN $2 > 0 THEN TRUE ELSE has_urgent_pending_task END,
         next_required_action = $3,
         updated_at = NOW(),
         detail_data = $4::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        pendingReviewCount,
        pendingReviewCount > 0
          ? "Review newly uploaded client documents"
          : status === "flagged"
            ? "Follow up flagged document with client"
            : matter.nextRequiredAction,
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async addMessage(matterId: string, message: MatterMessage, actorName: string): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: message.role,
      timestamp: submittedAt,
      section: "Messages",
      previousValue: `${matter.messages.length} messages`,
      newValue: `${matter.messages.length + 1} messages`,
      reason:
        message.sender === "client"
          ? "Client sent a secure message to the assigned solicitor."
          : "Solicitor sent a secure message to the client.",
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages: [...(matter.messages as MatterMessage[]), message],
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         has_task_sent_to_client = CASE WHEN $2 = 'client' THEN TRUE ELSE has_task_sent_to_client END,
         updated_at = NOW(),
         detail_data = $3::jsonb
       WHERE id = $1
       RETURNING *`,
      [matterId, message.sender, JSON.stringify(detailData)],
    );

    return toMatterFull(result.rows[0]);
  },

  async markMessagesRead(matterId: string, reader: "client" | "solicitor"): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const messages = (matter.messages as MatterMessage[]).map((message) => {
      if (reader === "client" && message.sender !== "client") {
        return { ...message, readByClient: true };
      }
      if (reader === "solicitor" && message.sender === "client") {
        return { ...message, readBySolicitor: true };
      }
      return message;
    });

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: matter.auditHistory,
      referrals: matter.referrals,
      notes: matter.notes,
      messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET updated_at = NOW(), detail_data = $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [matterId, JSON.stringify(detailData)],
    );

    return toMatterFull(result.rows[0]);
  },

  async addTask(
    matterId: string,
    task: MatterTask,
    actorName: string,
    notifyMessage?: MatterMessage,
  ): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const tasks = [task, ...(matter.tasks as MatterTask[])];
    const metrics = computeTaskMetrics(tasks);
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: "Solicitor",
      timestamp: submittedAt,
      section: "Tasks",
      previousValue: `${(matter.tasks as MatterTask[]).length} tasks`,
      newValue: `${tasks.length} tasks`,
      reason: `Client task created: ${task.title}`,
    };

    const messages = notifyMessage
      ? [...(matter.messages as MatterMessage[]), notifyMessage]
      : (matter.messages as MatterMessage[]);

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments: matter.adviceDocuments,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const nextStatus =
      matter.status === "approved" || matter.status === "completed"
        ? matter.status
        : "client_response_required";

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         status = $2,
         next_required_action = $3,
         has_task_sent_to_client = TRUE,
         has_urgent_pending_task = TRUE,
         overdue_task_count = $4,
         updated_at = NOW(),
         detail_data = $5::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        nextStatus,
        `Client action required: ${task.title}`,
        metrics.overdueTaskCount,
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async updateTaskStatus(
    matterId: string,
    taskId: string,
    status: "client_completed" | "resolved",
    actorName: string,
    clientResponse?: string,
  ): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const tasks = (matter.tasks as MatterTask[]).map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      const updated: MatterTask = {
        ...task,
        status,
        clientResponse: clientResponse ?? task.clientResponse,
        resolvedAt: status === "resolved" ? asTimestampString(new Date()) : task.resolvedAt,
      };
      return updated;
    });

    const updatedTask = tasks.find((task) => task.id === taskId);
    if (!updatedTask) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }

    const metrics = computeTaskMetrics(tasks);
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: status === "client_completed" ? "Client" : "Solicitor",
      timestamp: submittedAt,
      section: "Tasks",
      previousValue: taskId,
      newValue: status,
      reason:
        status === "client_completed"
          ? "Client marked task complete."
          : "Solicitor resolved client task.",
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments: matter.adviceDocuments,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const openClientTasks = tasks.some((task) => task.status === "sent_to_client");
    const nextStatus = openClientTasks
      ? "client_response_required"
      : matter.status === "client_response_required"
        ? "awaiting_review"
        : matter.status;

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         status = $2,
         has_task_sent_to_client = $3,
         overdue_task_count = $4,
         next_required_action = $5,
         updated_at = NOW(),
         detail_data = $6::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        nextStatus,
        openClientTasks,
        metrics.overdueTaskCount,
        openClientTasks
          ? matter.nextRequiredAction || "Awaiting client task completion"
          : "Review client responses and continue matter review",
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async addReferral(
    matterId: string,
    referral: MatterReferral,
    actorName: string,
    notifyMessage?: MatterMessage,
  ): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const referrals = [referral, ...(matter.referrals as MatterReferral[])];
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: "Solicitor",
      timestamp: submittedAt,
      section: "Referrals",
      previousValue: `${(matter.referrals as MatterReferral[]).length} referrals`,
      newValue: `${referrals.length} referrals`,
      reason: `Referral to ${referral.partner}: ${referral.reason}`,
    };

    const messages = notifyMessage
      ? [...(matter.messages as MatterMessage[]), notifyMessage]
      : (matter.messages as MatterMessage[]);

    const referralLetter = buildReferralLetterDocument(matter, referral);
    const adviceDocuments = [referralLetter, ...(matter.adviceDocuments ?? [])];

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals,
      notes: matter.notes,
      messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const referralStatuses = new Set(["approved", "amended", "overridden", "referrals_in_progress", "completed"]);
    const nextStatus = referralStatuses.has(matter.status) ? "referrals_in_progress" : matter.status;

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         status = $2,
         next_required_action = $3,
         updated_at = NOW(),
         detail_data = $4::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        nextStatus,
        `Referral initiated to ${referral.partner}`,
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async updateReferralStatus(
    matterId: string,
    referralId: string,
    status: ReferralStatus,
    actorName: string,
    notes?: string,
  ): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const referrals = (matter.referrals as MatterReferral[]).map((referral) => {
      if (referral.id !== referralId) {
        return referral;
      }
      return {
        ...referral,
        status,
        notes: notes?.trim() ? notes.trim() : referral.notes,
      };
    });

    if (!referrals.some((referral) => referral.id === referralId)) {
      throw new AppError("Referral not found.", 404, "REFERRAL_NOT_FOUND");
    }

    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: "Solicitor",
      timestamp: submittedAt,
      section: "Referrals",
      previousValue: referralId,
      newValue: status,
      reason: notes?.trim() || `Referral status updated to ${status}.`,
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments: matter.adviceDocuments,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const openReferrals = referrals.some(
      (referral) => referral.status === "initiated" || referral.status === "accepted" || referral.status === "in_progress",
    );

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         status = CASE WHEN $2 THEN 'referrals_in_progress' ELSE status END,
         next_required_action = $3,
         updated_at = NOW(),
         detail_data = $4::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        openReferrals,
        openReferrals ? `Referral in progress with partner` : "Referral pathway closed — review matter outcome",
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]);
  },

  async acknowledgeReferral(matterId: string, referralId: string, actorName: string): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const referrals = (matter.referrals as MatterReferral[]).map((referral) =>
      referral.id === referralId ? { ...referral, clientAcknowledged: true } : referral,
    );

    if (!referrals.some((referral) => referral.id === referralId)) {
      throw new AppError("Referral not found.", 404, "REFERRAL_NOT_FOUND");
    }

    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: "Client",
      timestamp: submittedAt,
      section: "Referrals",
      previousValue: referralId,
      newValue: "acknowledged",
      reason: "Client acknowledged referral in portal.",
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments: matter.adviceDocuments,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters SET updated_at = NOW(), detail_data = $2::jsonb WHERE id = $1 RETURNING *`,
      [matterId, JSON.stringify(detailData)],
    );

    return toMatterFull(result.rows[0]);
  },

  async addNote(matterId: string, note: MatterNote, actorName: string): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const notes = [note, ...(matter.notes as MatterNote[])];
    const submittedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: "Solicitor",
      timestamp: submittedAt,
      section: "Case Notes",
      previousValue: `${(matter.notes as MatterNote[]).length} notes`,
      newValue: `${notes.length} notes`,
      reason: note.isInternal ? "Internal case note added." : "Shared case note added.",
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments: matter.adviceDocuments,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters SET updated_at = NOW(), detail_data = $2::jsonb WHERE id = $1 RETURNING *`,
      [matterId, JSON.stringify(detailData)],
    );

    return toMatterFull(result.rows[0]);
  },

  async closeMatter(
    solicitorEmail: string,
    matterId: string,
    input: MatterCloseInput,
  ): Promise<MatterFull> {
    const matter = await this.getByIdForSolicitor(solicitorEmail, matterId);
    assertCanCloseMatter(matter, input.outcome);

    const closedAt = asTimestampString(new Date());
    const closureRecord = buildClosureRecord(matter, closedAt, input);
    const closingLetter = buildClosingLetterDocument(matter, closedAt, input);
    const existingDocs = (matter.adviceDocuments ?? []) as NonNullable<MatterDetailData["adviceDocuments"]>;
    const adviceDocuments = [
      closingLetter,
      ...existingDocs.filter((doc) => doc.type !== "closing_letter"),
    ];

    const closureMessage = createClosureClientMessage(input.solicitorName, matter.clientName, input.outcome);
    const note = {
      id: `N-${Date.now()}`,
      author: input.solicitorName,
      role: "Solicitor",
      date: closedAt,
      content: `Matter closed [${input.outcome.replace(/_/g, " ").toUpperCase()}]: ${input.reason.trim()}`,
      isInternal: true,
    };

    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: input.solicitorName,
      role: "Solicitor",
      timestamp: closedAt,
      section: "Matter Status",
      previousValue: matter.status,
      newValue: "completed",
      reason: `${outcomeAuditLabel(input.outcome)} — ${input.reason.trim()}`,
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments,
      matterClosure: closureRecord,
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: [note, ...matter.notes],
      messages: [...matter.messages, closureMessage],
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         status = $3,
         next_required_action = $4,
         has_task_sent_to_client = FALSE,
         has_urgent_pending_task = FALSE,
         detail_data = $5::jsonb,
         updated_at = NOW()
       WHERE id = $1 AND LOWER(assigned_solicitor_email) = LOWER($2)
       RETURNING *`,
      [
        matterId,
        solicitorEmail,
        "completed",
        closureNextAction(input.outcome),
        JSON.stringify(detailData),
      ],
    );

    if (result.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    return toMatterFull(result.rows[0]);
  },

  async resolveComplianceAlert(
    solicitorEmail: string,
    matterId: string,
    alertId: string,
    actorName: string,
  ): Promise<MatterFull> {
    const matter = await this.getByIdForSolicitor(solicitorEmail, matterId);
    const resolvedAt = asTimestampString(new Date());

    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: actorName,
      role: "Solicitor",
      timestamp: resolvedAt,
      section: "Compliance",
      previousValue: alertId,
      newValue: "resolved",
      reason: "Compliance alert marked resolved after remediation.",
    };

    const detailData: MatterDetailData = {
      clientPhone: matter.clientPhone,
      clientAddress: matter.clientAddress,
      niNumber: matter.niNumber,
      dob: matter.dob,
      employmentStatus: matter.employmentStatus,
      employerName: matter.employerName,
      monthlyNetIncome: matter.monthlyNetIncome,
      benefitsIncome: matter.benefitsIncome,
      totalIncome: matter.totalIncome,
      monthlyExpenses: matter.monthlyExpenses,
      vulnerabilityNotes: matter.vulnerabilityNotes,
      priorityDebtTotal: matter.priorityDebtTotal,
      nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
      aiReasoning: matter.aiReasoning,
      alternativeSolutions: matter.alternativeSolutions,
      rejectedSolutions: matter.rejectedSolutions,
      aiRecommendationDetail: matter.aiRecommendationDetail,
      solicitorDecision: matter.solicitorDecision,
      adviceDocuments: matter.adviceDocuments,
      matterClosure: matter.matterClosure,
      complianceAlertResolutions: {
        ...(matter.complianceAlertResolutions ?? {}),
        [alertId]: { resolvedAt, resolvedBy: actorName },
      },
      debts: matter.debts,
      assets: matter.assets,
      documents: matter.documents,
      tasks: matter.tasks,
      auditHistory: [auditRecord, ...matter.auditHistory],
      referrals: matter.referrals,
      notes: matter.notes,
      messages: matter.messages,
      assessmentSubmittedAt: matter.assessmentSubmittedAt,
      assessmentValues: matter.assessmentValues,
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET updated_at = NOW(), detail_data = $3::jsonb
       WHERE id = $1 AND LOWER(assigned_solicitor_email) = LOWER($2)
       RETURNING *`,
      [matterId, solicitorEmail, JSON.stringify(detailData)],
    );

    if (result.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    return toMatterFull(result.rows[0]);
  },

  async recordClientIdentityLiveness(matterId: string, clientName: string): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]);
    const completedAt = asTimestampString(new Date());
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: clientName,
      role: "Client",
      timestamp: completedAt,
      section: "Identity Verification",
      previousValue: "Pending",
      newValue: "Liveness passed",
      reason: "Client completed accredited liveness selfie check.",
    };

    const detailData: MatterDetailData = {
      ...snapshotDetailFromMatter(matter),
      identityVerification: {
        livenessStatus: "passed",
        livenessCompletedAt: completedAt,
      },
      auditHistory: [auditRecord, ...(matter.auditHistory as unknown[])],
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET updated_at = NOW(), detail_data = $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [matterId, JSON.stringify(detailData)],
    );

    return toMatterFull(result.rows[0]!);
  },

  async updateClientContactProfile(
    matterId: string,
    input: {
      clientUserId: string;
      clientName: string;
      clientEmail: string;
      clientPhone: string;
      clientAddress: string;
      firstName: string;
      lastName: string;
      actorName: string;
    },
  ): Promise<MatterFull> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const matter = toMatterFull(existing.rows[0]!);
    const submittedAt = asTimestampString(new Date());
    const assessmentValues: Record<string, string> = {
      ...(matter.assessmentValues ?? {}),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.clientPhone,
      address: input.clientAddress,
    };
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: input.actorName,
      role: "Client",
      timestamp: submittedAt,
      section: "Assessment",
      previousValue: `${matter.clientName} · ${matter.clientPhone || "—"}`,
      newValue: `${input.clientName} · ${input.clientPhone || "—"}`,
      reason: "Client updated contact details from profile settings.",
    };

    const detailData: MatterDetailData = {
      ...snapshotDetailFromMatter(matter),
      clientPhone: input.clientPhone,
      clientAddress: input.clientAddress,
      assessmentValues,
      auditHistory: [auditRecord, ...(matter.auditHistory as unknown[])],
    };

    const result = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      `UPDATE matters
       SET
         client_user_id = $2,
         client_name = $3,
         client_email = $4,
         updated_at = NOW(),
         detail_data = $5::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        matterId,
        input.clientUserId,
        input.clientName,
        input.clientEmail,
        JSON.stringify(detailData),
      ],
    );

    return toMatterFull(result.rows[0]!);
  },

  async appendClientAuditEvent(
    matterId: string,
    input: {
      actorName: string;
      section: string;
      previousValue: string;
      newValue: string;
      reason: string;
    },
  ): Promise<void> {
    const existing = await query<MatterRow & { detail_data: MatterDetailData | null }>(
      "SELECT * FROM matters WHERE id = $1 LIMIT 1",
      [matterId],
    );
    if (existing.rows.length === 0) {
      return;
    }

    const matter = toMatterFull(existing.rows[0]!);
    const auditRecord = {
      id: `AUD-${Date.now()}`,
      user: input.actorName,
      role: "Client",
      timestamp: asTimestampString(new Date()),
      section: input.section,
      previousValue: input.previousValue,
      newValue: input.newValue,
      reason: input.reason,
    };

    const detailData: MatterDetailData = {
      ...snapshotDetailFromMatter(matter),
      auditHistory: [auditRecord, ...(matter.auditHistory as unknown[])],
    };

    await query(
      `UPDATE matters SET updated_at = NOW(), detail_data = $2::jsonb WHERE id = $1`,
      [matterId, JSON.stringify(detailData)],
    );
  },

};

