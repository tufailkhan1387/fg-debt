import { AppError } from "../../middleware/appError.js";

/**
 * The firm's performance appraisal form for legal professionals, as on the Master Register's
 * "Performance Evaluation" and "Ratings Explanations" sheets. Wording is the firm's own; do not change it here
 * without the Principal's say-so.
 */
export const APPRAISAL_CATEGORIES = [
  {
    key: "jobKnowledge",
    title: "Job Knowledge",
    examples: [
      "Employee demonstrates full working knowledge and skill sets (including technical skills and academic knowledge) to perform job duties as listed in their job description.",
      "Employee displays analytical and problem-solving skills.",
    ],
  },
  {
    key: "planning",
    title: "Planning & Organizational Skills",
    examples: [
      "Employee allocates time to various tasks and assignments in accordance with priorities and workload.",
      "Employee anticipates interruptions and handles schedule changes with composure.",
      "Employee sets goals and outcomes in collaboration with supervisor.",
    ],
  },
  {
    key: "qualityQuantity",
    title: "Quality and Quantity of Work",
    examples: [
      "Employee completes assignments in a thorough and accurate manner.",
      "Employee consistently meets deadlines.",
      "Employee actively seeks ways to streamline and improve processes.",
    ],
  },
  {
    key: "dependability",
    title: "Dependability & Promptness",
    examples: [
      "Employee demonstrates professional accountability and integrity in work.",
      "Employee keeps supervisor informed of both progress made and problems encountered.",
      "Employee observes regular work hours and is reliably present at work and takes/observes appropriate meals/breaks.",
      "Employee advises supervisor ahead of time in the event of a required absence from work.",
    ],
  },
  {
    key: "communication",
    title: "Written & Oral Communication Skills",
    examples: [
      "Employee communicates in a clear, concise and courteous manner.",
      "Employee listens actively.",
      "Employee uses standard grammar in both written and oral communications.",
      "Employee possesses effective presentation skills if required by the position.",
    ],
  },
  {
    key: "customerService",
    title: "Customer Service (Employees, Clients, Vendors)",
    examples: [
      "Employee is courteous to internal and external customers in both personal and electronic interactions.",
      "Employee responds promptly and appropriately to requests for assistance.",
      "Employee treats people with respect and in a manner that shows sensitivity to special needs and circumstances.",
      "Employee uses discretion when dealing with information of a sensitive nature.",
    ],
  },
  {
    key: "cooperation",
    title: "Cooperation & Collaboration",
    examples: [
      "Employee demonstrates a personal sense of responsibility for helping departments across the organization achieve success.",
      "Employee works harmoniously with peers, supervisors and the public.",
      "Employee seeks to resolve conflict at any organizational level.",
      "Employee works well as a member of a team.",
      "Employee readily shares information with colleagues and seeks feedback as needed.",
    ],
  },
  {
    key: "initiative",
    title: "Initiative",
    examples: [
      "Employee anticipates problems and voluntarily takes the appropriate actions.",
      "Employee works independently as appropriate.",
      "Employee accepts new challenges and learns new procedures.",
      "Employee welcomes creativity and innovation in the workplace.",
      "Employee is flexible and adaptable to new situations.",
    ],
  },
  {
    key: "professionalDevelopment",
    title: "Professional Development",
    examples: [
      "Employee completes professional development requirements, including benchmarking and demonstrates continuous learning.",
      "Employee participates in departmental meetings, teams, and projects.",
    ],
  },
  {
    key: "ethicsCompliance",
    title: "Professional Ethics & Administrative Compliance",
    examples: [
      "Employee supports organizational mission and goals and behaves professionally.",
      "Employee observes company policies and procedures.",
      "Employee completes company forms and reports in a thorough and timely fashion.",
      "Employee maintains an orderly, clean and professional office appearance.",
    ],
  },
] as const;

export const APPRAISAL_RATINGS = [
  {
    score: 5,
    label: "Exemplary",
    description:
      "Outstanding and consistent performance that far exceeds all normal expectations for each aspect of the job. Reserved for exceptional performance where the employee demonstrates proficiency at a high level, stays up-to-date with best practices, and serves as a resource to help others achieve success. Extraordinary performance in this category requires an explanation with examples.",
  },
  {
    score: 4,
    label: "Advanced",
    description: "Consistently exceeds normal performance expectations for most key aspects of the job. Describes employees who make significant contributions with minimal supervision.",
  },
  {
    score: 3,
    label: "Proficient",
    description: "Meets normal job requirements in accordance with established standards. Describes expected, skilled performance and denotes that the employee can be counted on to contribute fully.",
  },
  {
    score: 2,
    label: "Developing",
    description:
      "Overall performance is acceptable but improvement is needed in one or more significant aspects of the job. Requires an explanation and suggestions for improvement. May be acceptable for a newer employee or someone taking on a new area of expertise.",
  },
  {
    score: 1,
    label: "Unsatisfactory",
    description:
      "Does not achieve acceptable or satisfactory performance in the major aspects of the job. Indicates a persistent pattern or severity of not meeting expectations that hinders the department in achieving its objectives and requires an explanation from the evaluator.",
  },
] as const;

/** The form's own rule: "only ratings of 5, 2 or 1 must include specific statements to explain the reason for that rating". */
export const SCORES_NEEDING_COMMENT = [5, 2, 1];

export type CategoryKey = (typeof APPRAISAL_CATEGORIES)[number]["key"];

export interface AppraisalForm {
  jobTitle: string;
  department: string;
  evaluationPeriod: string;
  goalsUpdated: boolean | null;
  goalsDate: string | null;
  complianceTrainingDone: boolean | null;
  complianceTrainingDate: string | null;
  ratings: Partial<Record<CategoryKey, { score: number | null; comment: string }>>;
  performancePlan: string;
  developmentNeeds: string;
  participation: string;
  employeeComments: string;
  employeeAgrees: "agree" | "disagree" | null;
}

/** Average of the ten scores, as the workbook works it out; null until every category is rated. */
export function totalScore(form: AppraisalForm | null): number | null {
  if (!form) return null;
  const scores = APPRAISAL_CATEGORIES.map((c) => form.ratings[c.key]?.score ?? null);
  if (scores.some((s) => s === null)) return null;
  return Math.round(((scores as number[]).reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

export function ratedCount(form: AppraisalForm | null): number {
  return form ? APPRAISAL_CATEGORIES.filter((c) => typeof form.ratings[c.key]?.score === "number").length : 0;
}

/** Applies the form's comment rule; throws naming the first category that breaks it. */
export function checkAppraisalForm(form: AppraisalForm) {
  for (const c of APPRAISAL_CATEGORIES) {
    const r = form.ratings[c.key];
    if (r?.score && SCORES_NEEDING_COMMENT.includes(r.score) && !r.comment.trim()) {
      throw new AppError(`${c.title}: a rating of ${r.score} needs a comment explaining it.`, 400, "COMMENT_REQUIRED");
    }
  }
}
