export type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "number" | "select" | "textarea" | "radio" | "switch";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  span?: "full" | "half";
  prefix?: string;
  help?: string;
};

export type Step = {
  id: number;
  title: string;
  summary: string;
  group: "About you" | "Money in" | "Money out" | "What you own" | "What you owe" | "Legal" | "Finish";
  fields: Field[];
};

const yesNo = ["Yes", "No"];

export const steps: Step[] = [
  {
    id: 1,
    title: "Personal details",
    summary: "Confirm who you are so we can match your records.",
    group: "About you",
    fields: [
      { name: "firstName", label: "First name", type: "text", required: true, placeholder: "Amelia" },
      { name: "lastName", label: "Last name", type: "text", required: true, placeholder: "Hartley" },
      { name: "dob", label: "Date of birth", type: "date", required: true },
      { name: "maritalStatus", label: "Marital status", type: "select", options: ["Single", "Married / civil partnership", "Cohabiting", "Separated", "Divorced", "Widowed"], required: true },
      { name: "email", label: "Email address", type: "email", required: true, placeholder: "you@example.co.uk" },
      { name: "phone", label: "Mobile number", type: "tel", required: true, placeholder: "07700 900312" },
      { name: "address", label: "Current address", type: "textarea", span: "full", required: true, placeholder: "House number, street, town, postcode" },
      { name: "residency", label: "Residential status", type: "select", options: ["Private tenant", "Social tenant", "Homeowner with mortgage", "Homeowner outright", "Living with family", "Other"], required: true },
      { name: "timeAtAddress", label: "Time at address (months)", type: "number", placeholder: "24" },
    ],
  },
  {
    id: 2,
    title: "Household members",
    summary: "Who else lives with you and depends on your income?",
    group: "About you",
    fields: [
      { name: "adults", label: "Adults in household (incl. you)", type: "number", required: true, placeholder: "2" },
      { name: "children", label: "Dependent children", type: "number", required: true, placeholder: "1" },
      { name: "childAges", label: "Ages of dependants", type: "text", placeholder: "e.g. 4, 9" },
      { name: "partnerContributes", label: "Does a partner contribute financially?", type: "radio", options: yesNo, required: true },
      { name: "carer", label: "Are you a carer for anyone in the household?", type: "radio", options: yesNo },
      { name: "householdNotes", label: "Anything else about your household", type: "textarea", span: "full", placeholder: "Optional" },
    ],
  },
  {
    id: 3,
    title: "Employment status",
    summary: "Tell us how you currently earn.",
    group: "Money in",
    fields: [
      { name: "employment", label: "Employment status", type: "select", options: ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Retired", "Student", "Unable to work"], required: true },
      { name: "employer", label: "Employer name", type: "text", placeholder: "Northgate Retail Ltd" },
      { name: "jobTitle", label: "Job title", type: "text", placeholder: "Team supervisor" },
      { name: "startDate", label: "Employment start date", type: "date" },
      { name: "payFrequency", label: "Pay frequency", type: "select", options: ["Weekly", "Fortnightly", "Four-weekly", "Monthly"], required: true },
      { name: "contract", label: "Contract type", type: "select", options: ["Permanent", "Fixed term", "Zero hours", "Agency", "N/A"] },
      { name: "secondJob", label: "Do you have a second job?", type: "radio", options: yesNo, span: "full" },
    ],
  },
  {
    id: 4,
    title: "Benefits received",
    summary: "Include every benefit paid to you or your household.",
    group: "Money in",
    fields: [
      { name: "universalCredit", label: "Universal Credit", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "childBenefit", label: "Child Benefit", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "pip", label: "PIP / Disability benefits", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "housingBenefit", label: "Housing Benefit", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "carersAllowance", label: "Carer's Allowance", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "otherBenefits", label: "Other benefits", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "benefitFrequency", label: "How often are these paid?", type: "select", options: ["Weekly", "Fortnightly", "Four-weekly", "Monthly"], required: true },
      { name: "benefitOverpayment", label: "Any benefit overpayments being recovered?", type: "radio", options: yesNo },
    ],
  },
  {
    id: 5,
    title: "Income details",
    summary: "Your take-home pay and any other money coming in.",
    group: "Money in",
    fields: [
      { name: "netPay", label: "Net monthly pay", type: "number", prefix: "£", required: true, placeholder: "1980" },
      { name: "partnerPay", label: "Partner's net monthly pay", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "pension", label: "Pension income", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "maintenance", label: "Maintenance received", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "rentalIncome", label: "Rental income", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "otherIncome", label: "Other income", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "incomeStable", label: "Is your income stable month to month?", type: "radio", options: yesNo, span: "full" },
    ],
  },
  {
    id: 6,
    title: "Monthly expenditure",
    summary: "Essential household costs — estimates are fine, we'll verify later.",
    group: "Money out",
    fields: [
      { name: "rent", label: "Rent or mortgage", type: "number", prefix: "£", required: true, placeholder: "850" },
      { name: "councilTax", label: "Council tax", type: "number", prefix: "£", placeholder: "132" },
      { name: "utilities", label: "Gas, electricity & water", type: "number", prefix: "£", placeholder: "210" },
      { name: "food", label: "Food & housekeeping", type: "number", prefix: "£", placeholder: "340" },
      { name: "transport", label: "Travel & transport", type: "number", prefix: "£", placeholder: "165" },
      { name: "childcare", label: "Childcare & school costs", type: "number", prefix: "£", placeholder: "180" },
      { name: "insurance", label: "Insurance", type: "number", prefix: "£", placeholder: "72" },
      { name: "communications", label: "Phone, broadband & TV", type: "number", prefix: "£", placeholder: "58" },
      { name: "otherExpenses", label: "Other essential costs", type: "number", prefix: "£", placeholder: "0.00" },
    ],
  },
  {
    id: 7,
    title: "Assets",
    summary: "Anything of value you own, other than property and vehicles.",
    group: "What you own",
    fields: [
      { name: "hasAssets", label: "Do you own assets worth over £500?", type: "radio", options: yesNo, required: true },
      { name: "assetType", label: "Type of asset", type: "select", options: ["Jewellery", "Electronics", "Tools & equipment", "Investments / shares", "Business assets", "Other"] },
      { name: "assetValue", label: "Estimated value", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "assetOwnership", label: "Ownership", type: "select", options: ["Sole", "Joint"] },
      { name: "assetDetails", label: "Asset description", type: "textarea", span: "full", placeholder: "Optional details" },
    ],
  },
  {
    id: 8,
    title: "Vehicles",
    summary: "Cars, vans or motorcycles you own or finance.",
    group: "What you own",
    fields: [
      { name: "hasVehicle", label: "Do you own or finance a vehicle?", type: "radio", options: yesNo, required: true },
      { name: "vehicleMake", label: "Make & model", type: "text", placeholder: "Ford Focus" },
      { name: "vehicleYear", label: "Year", type: "number", placeholder: "2016" },
      { name: "vehicleValue", label: "Estimated value", type: "number", prefix: "£", placeholder: "3200" },
      { name: "vehicleFinance", label: "Outstanding finance", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "vehicleEssential", label: "Is the vehicle essential for work or care?", type: "radio", options: yesNo },
    ],
  },
  {
    id: 9,
    title: "Savings",
    summary: "Money held in accounts, ISAs or investments.",
    group: "What you own",
    fields: [
      { name: "currentAccount", label: "Current account balance", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "savingsAccount", label: "Savings account balance", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "isa", label: "ISA / investments", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "pensionPot", label: "Accessible pension pot", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "savingsPurpose", label: "Are savings committed to anything?", type: "textarea", span: "full", placeholder: "e.g. emergency fund, planned repair" },
    ],
  },
  {
    id: 10,
    title: "Property",
    summary: "Any property you own or part-own.",
    group: "What you own",
    fields: [
      { name: "ownsProperty", label: "Do you own property?", type: "radio", options: yesNo, required: true },
      { name: "propertyType", label: "Property type", type: "select", options: ["Main residence", "Second home", "Buy to let", "Shared ownership"] },
      { name: "propertyValue", label: "Estimated market value", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "mortgageBalance", label: "Outstanding mortgage", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "propertyEquity", label: "Estimated equity share", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "secondCharge", label: "Any secured loans / second charge?", type: "radio", options: yesNo },
    ],
  },
  {
    id: 11,
    title: "Creditors",
    summary: "Who you owe money to. Add each creditor you can recall.",
    group: "What you owe",
    fields: [
      { name: "creditorName", label: "Creditor name", type: "text", placeholder: "Halbury Bank" },
      { name: "accountRef", label: "Account reference", type: "text", placeholder: "XXXX-4421" },
      { name: "debtType", label: "Debt type", type: "select", options: ["Credit card", "Personal loan", "Overdraft", "Catalogue", "Buy now pay later", "Utility", "Council tax", "Rent arrears", "Other"] },
      { name: "balance", label: "Current balance", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "monthlyPayment", label: "Current monthly payment", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "inArrears", label: "Are you in arrears?", type: "radio", options: yesNo },
      { name: "creditorNotes", label: "Notes", type: "textarea", span: "full", placeholder: "Optional" },
    ],
  },
  {
    id: 12,
    title: "Court proceedings",
    summary: "Any legal action taken against you for a debt.",
    group: "Legal",
    fields: [
      { name: "hasCourt", label: "Has a creditor taken court action?", type: "radio", options: yesNo, required: true },
      { name: "courtType", label: "Type of action", type: "select", options: ["County Court Judgment (CCJ)", "Charging order", "Attachment of earnings", "Statutory demand", "Possession claim", "Other"] },
      { name: "caseNumber", label: "Court case number", type: "text", placeholder: "F2QZ1234" },
      { name: "hearingDate", label: "Next hearing date", type: "date" },
      { name: "courtAmount", label: "Amount claimed", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "courtNotes", label: "Details", type: "textarea", span: "full", placeholder: "Optional" },
    ],
  },
  {
    id: 13,
    title: "Bailiffs",
    summary: "Enforcement agents contacting you about a debt.",
    group: "Legal",
    fields: [
      { name: "hasBailiff", label: "Have bailiffs contacted you?", type: "radio", options: yesNo, required: true },
      { name: "bailiffCompany", label: "Enforcement company", type: "text", placeholder: "e.g. Marston Holdings" },
      { name: "bailiffDebt", label: "Debt being enforced", type: "select", options: ["Council tax", "Parking fine", "Court fine", "CCJ", "HMRC", "Other"] },
      { name: "bailiffAmount", label: "Amount demanded", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "bailiffVisit", label: "Has a visit already taken place?", type: "radio", options: yesNo },
      { name: "goodsTaken", label: "Have any goods been listed or removed?", type: "radio", options: yesNo },
    ],
  },
  {
    id: 14,
    title: "Insolvency history",
    summary: "Previous formal debt solutions matter for eligibility.",
    group: "Legal",
    fields: [
      { name: "priorInsolvency", label: "Have you previously been insolvent?", type: "radio", options: yesNo, required: true },
      { name: "insolvencyType", label: "Type", type: "select", options: ["Bankruptcy", "Debt Relief Order", "IVA", "Debt Management Plan", "Administration Order", "None"] },
      { name: "insolvencyDate", label: "Date entered", type: "date" },
      { name: "insolvencyEnd", label: "Date discharged / completed", type: "date" },
      { name: "insolvencyNotes", label: "Anything we should know", type: "textarea", span: "full", placeholder: "Optional" },
    ],
  },
  {
    id: 15,
    title: "Priority debts",
    summary: "Debts with the most serious consequences if unpaid.",
    group: "What you owe",
    fields: [
      { name: "councilTaxArrears", label: "Council tax arrears", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "rentArrears", label: "Rent or mortgage arrears", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "energyArrears", label: "Gas & electricity arrears", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "hmrcDebt", label: "HMRC / tax debt", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "fines", label: "Court fines", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "childMaintenance", label: "Child maintenance arrears", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "priorityPlan", label: "Are you on a payment plan for any of these?", type: "radio", options: yesNo, span: "full" },
    ],
  },
  {
    id: 16,
    title: "Non-priority debts",
    summary: "Consumer credit and other unsecured borrowing.",
    group: "What you owe",
    fields: [
      { name: "creditCards", label: "Credit cards total", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "loans", label: "Personal loans total", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "overdrafts", label: "Overdrafts", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "catalogues", label: "Catalogue & store cards", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "bnpl", label: "Buy now pay later", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "familyLoans", label: "Money owed to family or friends", type: "number", prefix: "£", placeholder: "0.00" },
      { name: "nonPriorityNotes", label: "Anything else", type: "textarea", span: "full", placeholder: "Optional" },
    ],
  },
  {
    id: 17,
    title: "Review & submit",
    summary: "Check your answers, then send your assessment for AI analysis and solicitor review.",
    group: "Finish",
    fields: [],
  },
];
