import type { MatterFull } from "../matters/matters.types.js";

export interface DebtSolutionRecommendation {
  solution: string;
  confidence: number;
  reasoning: string[];
  summary: string;
  advantages: string[];
  disadvantages: string[];
  alternatives: { name: string; fit: number; note: string }[];
  alternativeSolutions: { name: string; pros: string; cons: string }[];
  rejectedSolutions: { name: string; reason: string }[];
}

export type SolutionKey =
  | "dro"
  | "breathing_space_dro"
  | "iva"
  | "dmp"
  | "breathing_space"
  | "bankruptcy"
  | "token_payment";

export const SOLUTION_LABELS: Record<SolutionKey, string> = {
  dro: "Debt Relief Order (DRO)",
  breathing_space_dro: "Breathing Space & Debt Relief Order (DRO)",
  iva: "Individual Voluntary Arrangement (IVA)",
  dmp: "Debt Management Plan (DMP)",
  breathing_space: "Standard Breathing Space",
  bankruptcy: "Bankruptcy",
  token_payment: "Token Payment Plan",
};

function yes(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function gbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function netAssets(matter: MatterFull): number {
  return (matter.assets as Array<{ estimatedValue?: number; encumbrance?: number; exempt?: boolean }>).reduce(
    (sum, asset) => {
      if (asset.exempt) return sum;
      return sum + Math.max(0, (asset.estimatedValue ?? 0) - (asset.encumbrance ?? 0));
    },
    0,
  );
}

function ownsProperty(matter: MatterFull): boolean {
  const values = matter.assessmentValues ?? {};
  if (yes(values.ownsProperty)) return true;
  return (matter.assets as Array<{ type?: string }>).some((asset) =>
    String(asset.type ?? "").toLowerCase().includes("property"),
  );
}

function hasUrgentEnforcement(matter: MatterFull): boolean {
  const values = matter.assessmentValues ?? {};
  return (
    yes(values.hasCourt) ||
    yes(values.hasBailiff) ||
    values.courtType === "Statutory demand" ||
    values.courtType === "Possession claim" ||
    matter.priorityDebtTotal > 0 && matter.disposableIncome < 0
  );
}

export function scoreSolutionsForMatter(matter: MatterFull): Record<SolutionKey, number> {
  return scoreSolutions(matter);
}

export function getSolutionSummary(key: SolutionKey, matter: MatterFull): string {
  return solutionContent(key, matter).summary;
}

export function solutionKeyFromLabel(label: string): SolutionKey | null {
  const normalized = label.trim().toLowerCase();
  for (const [key, name] of Object.entries(SOLUTION_LABELS) as Array<[SolutionKey, string]>) {
    const shortName = name.split("(")[0]?.trim().toLowerCase() ?? name.toLowerCase();
    if (
      normalized === name.toLowerCase() ||
      normalized.startsWith(shortName) ||
      name.toLowerCase().includes(normalized)
    ) {
      return key;
    }
  }
  return null;
}

function scoreSolutions(matter: MatterFull): Record<SolutionKey, number> {
  const values = matter.assessmentValues ?? {};
  const assets = netAssets(matter);
  const propertyOwner = ownsProperty(matter);
  const urgent = hasUrgentEnforcement(matter);
  const surplus = matter.disposableIncome;
  const debt = matter.totalDebt;

  const scores: Record<SolutionKey, number> = {
    dro: 0,
    breathing_space_dro: 0,
    iva: 0,
    dmp: 0,
    breathing_space: 0,
    bankruptcy: 0,
    token_payment: 0,
  };

  const droEligible =
    !propertyOwner &&
    debt > 0 &&
    debt <= 50000 &&
    surplus <= 75 &&
    assets <= 2000;

  if (droEligible) {
    scores.dro = 88 - Math.min(20, Math.max(0, surplus));
    if (debt <= 30000) scores.dro += 4;
    if (assets <= 1000) scores.dro += 3;
  }

  if (urgent && droEligible) {
    scores.breathing_space_dro = scores.dro + 6;
  }

  if (debt >= 6000 && surplus >= 80 && !droEligible) {
    scores.iva = 70 + Math.min(18, Math.floor(surplus / 25));
    if (debt >= 15000) scores.iva += 5;
  } else if (debt >= 10000 && surplus >= 50 && surplus < 80) {
    scores.iva = 58;
  }

  if (surplus >= 25 && debt >= 3000) {
    scores.dmp = 45 + Math.min(25, Math.floor(surplus / 10));
    if (droEligible) scores.dmp -= 15;
  }

  if (urgent) {
    scores.breathing_space = 62;
    if (yes(values.hasBailiff)) scores.breathing_space += 8;
  }

  if (propertyOwner || debt > 50000 || assets > 5000 || (surplus < 0 && debt > 20000)) {
    scores.bankruptcy = 40 + Math.min(25, Math.floor(debt / 5000));
    if (debt > 50000) scores.bankruptcy += 10;
  }

  if (surplus >= 0 && surplus < 25 && debt > 0 && !droEligible) {
    scores.token_payment = 38;
  }

  if (matter.vulnerability !== "none" && droEligible) {
    scores.dro += 3;
    scores.breathing_space_dro += 2;
  }

  return scores;
}

function solutionContent(key: SolutionKey, matter: MatterFull): Pick<
  DebtSolutionRecommendation,
  "summary" | "advantages" | "disadvantages"
> {
  switch (key) {
    case "breathing_space_dro":
      return {
        summary:
          "Immediate 60-day Breathing Space protection while a Debt Relief Order application is prepared. Qualifying debts are frozen and enforcement paused.",
        advantages: [
          "Stops most enforcement action and contact for 60 days",
          "Buys time to submit a DRO without further arrears building",
          "Qualifying DRO debts can be written off after 12 months",
          "Lower cost than bankruptcy for eligible clients",
        ],
        disadvantages: [
          "Breathing Space is temporary — a longer-term solution must follow",
          "Not all debts qualify for Breathing Space or DRO protection",
          "Credit file impact if DRO is granted",
          "Must keep income and asset details accurate during the moratorium",
        ],
      };
    case "iva":
      return {
        summary:
          "A legally binding arrangement to repay an affordable amount over typically five to six years, with remaining qualifying debt written off on completion.",
        advantages: [
          "Single affordable monthly payment to the supervisor",
          "Protects the family home in many cases",
          "Legally binding on creditors who agree",
          "Avoids bankruptcy where surplus income is stable",
        ],
        disadvantages: [
          "Setup and ongoing supervisor fees reduce returns to creditors",
          "Failure to maintain payments can lead to bankruptcy",
          "Recorded on the Individual Insolvency Register",
          "Windfalls during the IVA may need to be paid in",
        ],
      };
    case "dmp":
      return {
        summary:
          "An informal plan to repay what you can afford each month, negotiated with creditors through a provider.",
        advantages: [
          "Flexible and avoids formal insolvency",
          "One consolidated monthly payment",
          "Interest and charges may be frozen by cooperative creditors",
          "Can be changed if income falls",
        ],
        disadvantages: [
          "Not legally binding — creditors can still pursue action",
          "Repayment may take many years at " + gbp(Math.max(matter.disposableIncome, 1)) + "/month",
          "Negative credit file markers are likely",
          "Less protection than formal insolvency options",
        ],
      };
    case "breathing_space":
      return {
        summary:
          "A 60-day moratorium halting most creditor contact and enforcement while you seek advice or prepare a longer-term solution.",
        advantages: [
          "Immediate pause on qualifying enforcement",
          "Time to gather documents and take regulated advice",
          "No insolvency register entry for Breathing Space alone",
          "Can be accessed while other options are explored",
        ],
        disadvantages: [
          "Does not write off debt — a follow-on solution is required",
          "Some debts and court orders are excluded",
          "Only one standard Breathing Space in 12 months",
          "Arrears may continue to accrue on some accounts",
        ],
      };
    case "bankruptcy":
      return {
        summary:
          "A formal insolvency route where qualifying debts are discharged, usually after 12 months, with assets assessed by the Official Receiver.",
        advantages: [
          "Clear end point for unmanageable debt",
          "Automatic stay on most creditor action once made",
          "May be appropriate when assets or debt exceed DRO limits",
          "Surplus income payments usually last only three years",
        ],
        disadvantages: [
          "Up-front court fee and possible asset realisation",
          "Serious credit file and public register impact",
          "Certain roles and tenancies may be affected",
          "Some debts are not discharged",
        ],
      };
    case "token_payment":
      return {
        summary:
          "Short-term reduced payments offered to creditors while affordability is reviewed and a formal solution is prepared.",
        advantages: [
          "Shows willingness to pay while advice is taken",
          "May reduce immediate pressure from some creditors",
          "No insolvency register entry",
          "Useful bridge while documents are gathered",
        ],
        disadvantages: [
          "Creditors are not obliged to accept",
          "Interest and charges may continue",
          "Does not resolve the underlying debt problem",
          "Not suitable as a long-term strategy alone",
        ],
      };
    case "dro":
    default:
      return {
        summary:
          "A DRO freezes qualifying debts for 12 months. If your circumstances do not improve, qualifying debts are written off at the end of that period.",
        advantages: [
          "Qualifying debts are written off after the 12-month moratorium",
          "Creditors must stop contact and cannot add further interest",
          "No monthly payments to creditors during the moratorium",
          "Significantly lower cost than bankruptcy (£90 application fee)",
        ],
        disadvantages: [
          "Recorded on the Individual Insolvency Register for 15 months",
          "Remains on your credit file for six years",
          "You cannot obtain credit over £500 without disclosure",
          "Certain professions may be restricted while the DRO is active",
        ],
      };
  }
}

function buildReasoning(key: SolutionKey, matter: MatterFull): string[] {
  const values = matter.assessmentValues ?? {};
  const assets = netAssets(matter);
  const reasons: string[] = [];

  reasons.push(`Total debt of ${gbp(matter.totalDebt)} assessed against current UK solution thresholds.`);
  reasons.push(`Monthly disposable income of ${gbp(matter.disposableIncome)} after essential expenditure.`);

  if (key === "dro" || key === "breathing_space_dro") {
    if (matter.totalDebt <= 50000) {
      reasons.push(`Total qualifying debt (${gbp(matter.totalDebt)}) is within the £50,000 DRO threshold.`);
    }
    if (matter.disposableIncome <= 75) {
      reasons.push(`Surplus income (${gbp(matter.disposableIncome)}) is within the DRO surplus limit.`);
    }
    if (assets <= 2000) {
      reasons.push(`Non-exempt assets (${gbp(assets)}) are below the £2,000 DRO asset limit.`);
    }
    if (!ownsProperty(matter)) {
      reasons.push("No property ownership declared that would exclude DRO eligibility.");
    }
  }

  if (key === "breathing_space_dro" || key === "breathing_space") {
    if (yes(values.hasCourt)) reasons.push("Court action reported — Breathing Space can pause enforcement while advice is taken.");
    if (yes(values.hasBailiff)) reasons.push("Bailiff action reported — immediate moratorium protection is recommended.");
    if (matter.priorityDebtTotal > 0) {
      reasons.push(`Priority arrears of ${gbp(matter.priorityDebtTotal)} increase urgency for creditor protection.`);
    }
  }

  if (key === "iva") {
    reasons.push(`Stable surplus of ${gbp(matter.disposableIncome)} supports an affordable IVA contribution.`);
    if (matter.totalDebt >= 6000) reasons.push("Debt level is sufficient to justify an IVA over informal options.");
  }

  if (key === "dmp") {
    reasons.push("Some affordable surplus exists, making negotiated repayments possible without insolvency.");
  }

  if (key === "bankruptcy") {
    if (ownsProperty(matter)) reasons.push("Property ownership may require formal insolvency with asset assessment.");
    if (matter.totalDebt > 50000) reasons.push("Debt exceeds the DRO limit — bankruptcy or IVA should be considered.");
  }

  if (matter.vulnerability !== "none") {
    reasons.push("Vulnerability indicators were flagged and weighted toward protective formal solutions.");
  }

  return reasons.slice(0, 6);
}

function buildAlternatives(
  scores: Record<SolutionKey, number>,
  primary: SolutionKey,
): DebtSolutionRecommendation["alternatives"] {
  return (Object.entries(scores) as Array<[SolutionKey, number]>)
    .filter(([key, fit]) => key !== primary && fit > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, fit]) => ({
      name: SOLUTION_LABELS[key],
      fit: Math.round(fit),
      note:
        key === "iva"
          ? "Better if surplus income remains stable over several years."
          : key === "dmp"
            ? "Informal and flexible, but interest may continue to accrue."
            : key === "bankruptcy"
              ? "Appropriate only if debts exceed DRO limits or assets are significant."
              : key === "breathing_space"
                ? "Useful short-term protection while a longer-term route is prepared."
                : "Alternative pathway scored against your declared circumstances.",
    }));
}

function buildAlternativeSolutions(alternatives: DebtSolutionRecommendation["alternatives"]) {
  return alternatives.map((item) => ({
    name: item.name,
    pros: item.note,
    cons: "Requires solicitor review before any action is taken.",
  }));
}

function buildRejectedSolutions(
  scores: Record<SolutionKey, number>,
  primary: SolutionKey,
  matter: MatterFull,
): DebtSolutionRecommendation["rejectedSolutions"] {
  const rejected: DebtSolutionRecommendation["rejectedSolutions"] = [];

  if (primary !== "dro" && primary !== "breathing_space_dro" && scores.dro > 0) {
    rejected.push({
      name: SOLUTION_LABELS.dro,
      reason: "Another solution scored higher for your surplus income, assets or enforcement risk profile.",
    });
  }

  if (scores.iva <= 0 || primary === "iva") {
    if (matter.disposableIncome < 50) {
      rejected.push({
        name: SOLUTION_LABELS.iva,
        reason: "Insufficient surplus income to fund realistic IVA contributions and fees.",
      });
    }
  } else if (scores.iva > 0) {
    rejected.push({
      name: SOLUTION_LABELS.iva,
      reason: "Fees and duration are less favourable than the primary recommendation for this debt level.",
    });
  }

  if (primary !== "bankruptcy" && scores.bankruptcy > 0 && matter.totalDebt < 15000) {
    rejected.push({
      name: SOLUTION_LABELS.bankruptcy,
      reason: "Disproportionate formal insolvency costs relative to total debt when DRO/DMP routes remain viable.",
    });
  }

  if (scores.token_payment <= 0) {
    rejected.push({
      name: SOLUTION_LABELS.token_payment,
      reason: "Token payments alone would not resolve the debt burden within a reasonable timeframe.",
    });
  }

  return rejected.slice(0, 4);
}

export function analyzeMatterForRecommendation(matter: MatterFull): DebtSolutionRecommendation {
  const scores = scoreSolutions(matter);
  const ranked = (Object.entries(scores) as Array<[SolutionKey, number]>).sort((a, b) => b[1] - a[1]);
  const [primaryKey, primaryScore] = ranked[0] ?? ["dmp", 45];
  const key = primaryScore > 0 ? primaryKey : "dmp";
  const confidence = Math.max(55, Math.min(96, Math.round(primaryScore > 0 ? primaryScore : 45)));
  const content = solutionContent(key, matter);
  const alternatives = buildAlternatives(scores, key);

  return {
    solution: SOLUTION_LABELS[key],
    confidence,
    reasoning: buildReasoning(key, matter),
    summary: content.summary,
    advantages: content.advantages,
    disadvantages: content.disadvantages,
    alternatives,
    alternativeSolutions: buildAlternativeSolutions(alternatives),
    rejectedSolutions: buildRejectedSolutions(scores, key, matter),
  };
}
