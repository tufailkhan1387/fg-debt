import { z } from "zod";

export const submitAssessmentSchema = z.object({
  values: z.record(z.string(), z.string()).refine((values) => {
    return Boolean(values.firstName?.trim() && values.lastName?.trim());
  }, "Assessment must include the client's name."),
});

export const uploadDocumentSchema = z.object({
  category: z.enum([
    "bank_statement",
    "payslip",
    "benefit_letter",
    "creditor_letter",
    "other_supporting",
    "id_proof",
    "tenancy",
    "utility_bill",
  ]),
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
