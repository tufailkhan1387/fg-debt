export type AssessmentValues = Record<string, string>;

function num(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function yes(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function formatDob(value: string | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function mapAssessmentToMatterPayload(values: AssessmentValues, clientEmail: string) {
  const firstName = values.firstName?.trim() || "Client";
  const lastName = values.lastName?.trim() || "User";
  const clientName = `${firstName} ${lastName}`.trim();

  const monthlyNetIncome = num(values.netPay) + num(values.partnerPay) + num(values.pension) + num(values.maintenance) + num(values.rentalIncome) + num(values.otherIncome);
  const benefitsIncome =
    num(values.universalCredit) +
    num(values.childBenefit) +
    num(values.pip) +
    num(values.housingBenefit) +
    num(values.carersAllowance) +
    num(values.otherBenefits);
  const totalIncome = monthlyNetIncome + benefitsIncome;
  const monthlyExpenses =
    num(values.rent) +
    num(values.councilTax) +
    num(values.utilities) +
    num(values.food) +
    num(values.transport) +
    num(values.childcare) +
    num(values.insurance) +
    num(values.communications) +
    num(values.otherExpenses);
  const disposableIncome = totalIncome - monthlyExpenses;

  const priorityDebtTotal =
    num(values.councilTaxArrears) +
    num(values.rentArrears) +
    num(values.energyArrears) +
    num(values.hmrcDebt) +
    num(values.fines) +
    num(values.childMaintenance);

  const nonPriorityDebtTotal =
    num(values.creditCards) +
    num(values.loans) +
    num(values.overdrafts) +
    num(values.catalogues) +
    num(values.bnpl) +
    num(values.familyLoans);

  const creditorBalance = num(values.balance);
  const totalDebt = priorityDebtTotal + nonPriorityDebtTotal + (values.creditorName ? creditorBalance : 0);

  const debts: Array<{
    id: string;
    creditor: string;
    type: string;
    balance: number;
    arrears: number;
    interestRate: string;
    isPriority: boolean;
    accountNumber: string;
    status: "verified" | "pending_verification";
  }> = [];

  const pushDebt = (
    id: string,
    creditor: string,
    type: string,
    balance: number,
    isPriority: boolean,
    accountNumber = "—",
  ) => {
    if (balance <= 0) return;
    debts.push({
      id,
      creditor,
      type,
      balance,
      arrears: balance,
      interestRate: "0%",
      isPriority,
      accountNumber,
      status: "pending_verification",
    });
  };

  pushDebt("D-CT", "Council tax arrears", "Council Tax Arrears", num(values.councilTaxArrears), true, "CT-ASSESS");
  pushDebt("D-RENT", "Rent / mortgage arrears", "Rent Arrears", num(values.rentArrears), true, "RENT-ASSESS");
  pushDebt("D-ENERGY", "Energy supplier", "Gas & Electricity Arrears", num(values.energyArrears), true, "EN-ASSESS");
  pushDebt("D-HMRC", "HMRC", "Tax Arrears", num(values.hmrcDebt), true, "HMRC-ASSESS");
  pushDebt("D-FINE", "Court fines", "Court Fine", num(values.fines), true, "FINE-ASSESS");
  pushDebt("D-CM", "Child maintenance", "Child Maintenance Arrears", num(values.childMaintenance), true, "CM-ASSESS");
  pushDebt("D-CC", "Credit cards", "Credit Card", num(values.creditCards), false, "CC-ASSESS");
  pushDebt("D-LOAN", "Personal loans", "Personal Loan", num(values.loans), false, "PL-ASSESS");
  pushDebt("D-OD", "Overdrafts", "Overdraft", num(values.overdrafts), false, "OD-ASSESS");
  pushDebt("D-CAT", "Catalogue & store cards", "Catalogue Debt", num(values.catalogues), false, "CAT-ASSESS");
  pushDebt("D-BNPL", "Buy now pay later", "BNPL", num(values.bnpl), false, "BNPL-ASSESS");
  pushDebt("D-FAM", "Family / friends", "Informal Loan", num(values.familyLoans), false, "FAM-ASSESS");

  if (values.creditorName && creditorBalance > 0) {
    const isPriority = ["Council tax", "Rent arrears", "Utility"].includes(values.debtType ?? "");
    pushDebt(
      "D-CRED",
      values.creditorName,
      values.debtType || "Unsecured Debt",
      creditorBalance,
      isPriority,
      values.accountRef || "CRED-ASSESS",
    );
  }

  const assets: Array<{
    id: string;
    type: string;
    description: string;
    estimatedValue: number;
    encumbrance: number;
    exempt: boolean;
  }> = [];

  if (yes(values.hasAssets) && num(values.assetValue) > 0) {
    assets.push({
      id: "A-GEN",
      type: values.assetType || "Asset",
      description: values.assetDetails || values.assetType || "Declared asset",
      estimatedValue: num(values.assetValue),
      encumbrance: 0,
      exempt: false,
    });
  }

  if (yes(values.hasVehicle) && num(values.vehicleValue) > 0) {
    assets.push({
      id: "A-VEH",
      type: "Motor Vehicle",
      description: values.vehicleMake || "Declared vehicle",
      estimatedValue: num(values.vehicleValue),
      encumbrance: num(values.vehicleFinance),
      exempt: yes(values.vehicleEssential),
    });
  }

  const savingsTotal = num(values.currentAccount) + num(values.savingsAccount) + num(values.isa);
  if (savingsTotal > 0) {
    assets.push({
      id: "A-SAV",
      type: "Savings",
      description: values.savingsPurpose || "Declared savings and cash balances",
      estimatedValue: savingsTotal,
      encumbrance: 0,
      exempt: savingsTotal <= 2000,
    });
  }

  if (yes(values.ownsProperty) && num(values.propertyValue) > 0) {
    assets.push({
      id: "A-PROP",
      type: "Residential Property",
      description: values.propertyType || "Declared property",
      estimatedValue: num(values.propertyValue),
      encumbrance: num(values.mortgageBalance),
      exempt: false,
    });
  }

  let riskLevel: "low" | "medium" | "high" | "critical" = "medium";
  if (disposableIncome < 0 && num(values.rentArrears) > 0) {
    riskLevel = "critical";
  } else if (yes(values.hasCourt) || yes(values.hasBailiff) || values.courtType === "Statutory demand") {
    riskLevel = "high";
  } else if (totalDebt > 30000 || disposableIncome < 50) {
    riskLevel = "high";
  } else if (totalDebt < 8000) {
    riskLevel = "low";
  }

  let vulnerability: "none" | "health_illness" | "financial_hardship" | "mental_health" = "none";
  if (disposableIncome < 0) vulnerability = "financial_hardship";
  else if (yes(values.carer)) vulnerability = "health_illness";

  const vulnerabilityNotes = [values.householdNotes, values.insolvencyNotes, values.courtNotes, values.nonPriorityNotes]
    .filter(Boolean)
    .join(" ")
    .trim();

  const incomeItems = [
    { label: "Net monthly pay", value: num(values.netPay) },
    { label: "Partner pay", value: num(values.partnerPay) },
    { label: "Benefits", value: benefitsIncome },
    { label: "Other income", value: num(values.pension) + num(values.maintenance) + num(values.rentalIncome) + num(values.otherIncome) },
  ].filter((item) => item.value > 0);

  const expenseItems = [
    { label: "Rent or mortgage", value: num(values.rent) },
    { label: "Council tax", value: num(values.councilTax) },
    { label: "Utilities", value: num(values.utilities) },
    { label: "Food & housekeeping", value: num(values.food) },
    { label: "Transport", value: num(values.transport) },
    { label: "Childcare", value: num(values.childcare) },
    { label: "Insurance", value: num(values.insurance) },
    { label: "Communications", value: num(values.communications) },
    { label: "Other essentials", value: num(values.otherExpenses) },
  ].filter((item) => item.value > 0);

  return {
    clientName,
    clientEmail: values.email?.trim() || clientEmail,
    clientPhone: values.phone?.trim() || "",
    clientAddress: values.address?.trim() || "",
    niNumber: "",
    dob: formatDob(values.dob),
    employmentStatus: values.employment?.trim() || "Not specified",
    employerName: values.employer?.trim() || "N/A",
    monthlyNetIncome: num(values.netPay),
    benefitsIncome,
    totalIncome,
    monthlyExpenses,
    disposableIncome,
    priorityDebtTotal: priorityDebtTotal || debts.filter((d) => d.isPriority).reduce((sum, d) => sum + d.balance, 0),
    nonPriorityDebtTotal: nonPriorityDebtTotal || debts.filter((d) => !d.isPriority).reduce((sum, d) => sum + d.balance, 0),
    totalDebt,
    riskLevel,
    vulnerability,
    vulnerabilityNotes: vulnerabilityNotes || undefined,
    nextRequiredAction: "Review client assessment submission and verify supporting documents",
    incomeItems,
    expenseItems,
    debts,
    assets,
    assessmentValues: values,
  };
}
