export const customer = {
  firstName: "Amelia",
  lastName: "Hartley",
  initials: "AH",
  email: "amelia.hartley@example.co.uk",
  phone: "+44 7700 900312",
  address: "48 Harrow Lane, Manchester, M4 2BQ",
  reference: "AQ-2026-04417",
  memberSince: "March 2026",
  verified: true,
};

export type CaseStatus = "in_review" | "active" | "completed" | "action_required" | "draft";

export const statusLabels: Record<CaseStatus, string> = {
  in_review: "Solicitor review",
  active: "In progress",
  completed: "Completed",
  action_required: "Action required",
  draft: "Draft",
};

export const cases = [
  {
    id: "CASE-1042",
    title: "Debt Relief Order assessment",
    status: "in_review" as CaseStatus,
    progress: 82,
    opened: "12 Jun 2026",
    updated: "2 hours ago",
    adviser: "R. Okonkwo, Solicitor",
    totalDebt: 18420,
    timeline: [
      { label: "Assessment submitted", date: "12 Jun 2026", done: true },
      { label: "Documents verified", date: "18 Jun 2026", done: true },
      { label: "AI recommendation generated", date: "24 Jun 2026", done: true },
      { label: "Solicitor review", date: "In progress", done: false },
      { label: "Solution issued", date: "Pending", done: false },
    ],
  },
  {
    id: "CASE-0987",
    title: "Council tax arrears support",
    status: "action_required" as CaseStatus,
    progress: 45,
    opened: "02 May 2026",
    updated: "Yesterday",
    adviser: "AI triage",
    totalDebt: 2380,
    timeline: [
      { label: "Assessment started", date: "02 May 2026", done: true },
      { label: "Awaiting payslips", date: "Action required", done: false },
      { label: "Adviser review", date: "Pending", done: false },
    ],
  },
  {
    id: "CASE-0755",
    title: "Credit card consolidation review",
    status: "completed" as CaseStatus,
    progress: 100,
    opened: "14 Jan 2026",
    updated: "28 Feb 2026",
    adviser: "M. Iqbal, Solicitor",
    totalDebt: 9100,
    timeline: [
      { label: "Assessment submitted", date: "14 Jan 2026", done: true },
      { label: "Solution agreed", date: "20 Feb 2026", done: true },
      { label: "Case closed", date: "28 Feb 2026", done: true },
    ],
  },
];

export const activity = [
  { id: 1, text: "AI recommendation generated for CASE-1042", time: "2 hours ago", kind: "ai" },
  { id: 2, text: "Payslip (May 2026) verified", time: "Yesterday", kind: "doc" },
  { id: 3, text: "Message from R. Okonkwo, Solicitor", time: "2 days ago", kind: "message" },
  { id: 4, text: "Identity verification approved", time: "5 days ago", kind: "id" },
  { id: 5, text: "Assessment step 14 completed", time: "1 week ago", kind: "case" },
];

export const notifications = [
  {
    id: 1,
    title: "Solicitor review started",
    body: "Your Debt Relief Order assessment is now with R. Okonkwo.",
    time: "2h",
    unread: true,
    kind: "solicitor" as const,
  },
  {
    id: 2,
    title: "Upload your latest bank statement",
    body: "We need a statement covering 1–31 May 2026 to finalise your income check.",
    time: "1d",
    unread: true,
    kind: "system" as const,
  },
  {
    id: 3,
    title: "AI insight: surplus improved",
    body: "Your disposable income increased by £64 compared to last month.",
    time: "3d",
    unread: false,
    kind: "ai" as const,
  },
  {
    id: 4,
    title: "Identity verification approved",
    body: "Your passport and proof of address passed verification.",
    time: "5d",
    unread: false,
    kind: "system" as const,
  },
];

export const messages = [
  {
    id: 1,
    from: "R. Okonkwo",
    role: "Solicitor",
    preview: "I've reviewed your expenditure — one clarification on childcare costs.",
    time: "09:42",
    unread: true,
  },
  {
    id: 2,
    from: "FG Debt Advisor AI",
    role: "Assistant",
    preview: "Your weekly case summary is ready to view.",
    time: "Mon",
    unread: false,
  },
  {
    id: 3,
    from: "Case Operations",
    role: "Support",
    preview: "Thanks for uploading your creditor letters — all three are readable.",
    time: "12 Jun",
    unread: false,
  },
];

export const incomeItems = [
  { label: "Employment (net)", value: 1980 },
  { label: "Universal Credit", value: 420 },
  { label: "Child Benefit", value: 145 },
  { label: "Other income", value: 60 },
];

export const expenseItems = [
  { label: "Rent", value: 850 },
  { label: "Utilities", value: 210 },
  { label: "Food & housekeeping", value: 340 },
  { label: "Transport", value: 165 },
  { label: "Childcare", value: 180 },
  { label: "Insurance", value: 72 },
  { label: "Other", value: 96 },
];

export const totalIncome = incomeItems.reduce((s, i) => s + i.value, 0);
export const totalExpenses = expenseItems.reduce((s, i) => s + i.value, 0);
export const disposableIncome = totalIncome - totalExpenses;

export const cashflowTrend = [
  { month: "Jan", income: 2480, expenses: 2010 },
  { month: "Feb", income: 2510, expenses: 2080 },
  { month: "Mar", income: 2495, expenses: 1990 },
  { month: "Apr", income: 2560, expenses: 1955 },
  { month: "May", income: 2605, expenses: 1913 },
  { month: "Jun", income: 2605, expenses: 1880 },
];

export const priorityDebts = [
  { creditor: "Manchester City Council", type: "Council tax", balance: 1480, arrears: 620, interest: "0%" },
  { creditor: "Northern Energy", type: "Gas & electricity", balance: 740, arrears: 240, interest: "0%" },
  { creditor: "HMRC", type: "Tax overpayment", balance: 910, arrears: 0, interest: "0%" },
];

export const nonPriorityDebts = [
  { creditor: "Halbury Bank", type: "Credit card", balance: 6240, arrears: 310, interest: "24.9%" },
  { creditor: "Vale Finance", type: "Personal loan", balance: 5320, arrears: 0, interest: "12.4%" },
  { creditor: "Swiftpay", type: "Buy now pay later", balance: 1180, arrears: 90, interest: "0%" },
  { creditor: "Orbit Catalogue", type: "Catalogue debt", balance: 2550, arrears: 145, interest: "29.8%" },
];

export const totalPriority = priorityDebts.reduce((s, d) => s + d.balance, 0);
export const totalNonPriority = nonPriorityDebts.reduce((s, d) => s + d.balance, 0);
export const totalDebt = totalPriority + totalNonPriority;
export const totalArrears = [...priorityDebts, ...nonPriorityDebts].reduce((s, d) => s + d.arrears, 0);

export const documents = [
  { name: "Bank statement — May 2026.pdf", type: "Bank Statement", size: "1.2 MB", date: "02 Jun 2026", status: "Verified" },
  { name: "Payslip — May 2026.pdf", type: "Payslip", size: "480 KB", date: "02 Jun 2026", status: "Verified" },
  { name: "Universal Credit letter.pdf", type: "Benefit Letter", size: "310 KB", date: "28 May 2026", status: "In review" },
  { name: "Halbury Bank arrears notice.pdf", type: "Creditor Letter", size: "220 KB", date: "24 May 2026", status: "Verified" },
  { name: "Tenancy agreement.pdf", type: "Other", size: "890 KB", date: "20 May 2026", status: "Rejected" },
];

export const generatedDocuments = [
  { name: "Standard Financial Statement.pdf", type: "Financial Statement", date: "24 Jun 2026" },
  { name: "Advice letter — DRO suitability.pdf", type: "Advice Letter", date: "24 Jun 2026" },
  { name: "Creditor summary schedule.pdf", type: "Case Document", date: "18 Jun 2026" },
];

export const referrals = [
  {
    id: "REF-3391",
    partner: "Insolvency Practitioner — Lowell & Grange",
    reason: "Debt Relief Order application support",
    status: "Accepted",
    date: "24 Jun 2026",
    next: "Practitioner will contact you within 3 working days.",
  },
  {
    id: "REF-3187",
    partner: "Local Welfare Support Team",
    reason: "Council tax hardship fund",
    status: "In progress",
    date: "11 Jun 2026",
    next: "Awaiting council decision.",
  },
  {
    id: "REF-2904",
    partner: "Energy Trust Grant Scheme",
    reason: "Fuel arrears grant",
    status: "Closed",
    date: "02 Apr 2026",
    next: "Grant of £320 applied to your account.",
  },
];

export const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
