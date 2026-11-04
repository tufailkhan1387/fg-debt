const STORAGE_KEY = "fg_debt_assessment_progress";

export type AssessmentProgress = {
  values: Record<string, string>;
  /** Zero-based index of the step the user should resume on. */
  stepIndex: number;
  /** Highest step index the user may open (unlocked by completing prior steps). */
  highestUnlockedIndex: number;
  submitted: boolean;
};

const DEFAULT_PROGRESS: AssessmentProgress = {
  values: {},
  stepIndex: 0,
  highestUnlockedIndex: 0,
  submitted: false,
};

export function getAssessmentProgress(): AssessmentProgress {
  if (typeof window === "undefined") return { ...DEFAULT_PROGRESS, values: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, values: {} };
    const parsed = JSON.parse(raw) as Partial<AssessmentProgress>;
    return {
      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},
      stepIndex: typeof parsed.stepIndex === "number" ? parsed.stepIndex : 0,
      highestUnlockedIndex:
        typeof parsed.highestUnlockedIndex === "number" ? parsed.highestUnlockedIndex : 0,
      submitted: Boolean(parsed.submitted),
    };
  } catch {
    return { ...DEFAULT_PROGRESS, values: {} };
  }
}

export function saveAssessmentProgress(progress: AssessmentProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  window.dispatchEvent(new Event("assessment-progress-change"));
}

export function isAssessmentComplete(): boolean {
  return getAssessmentProgress().submitted;
}

export function resetAssessmentProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PROGRESS, values: {} }));
  window.dispatchEvent(new Event("assessment-progress-change"));
}

export function markAssessmentSubmitted(): void {
  const current = getAssessmentProgress();
  saveAssessmentProgress({ ...current, submitted: true });
}
