interface DeptRule {
  pattern: RegExp;
  dept: string;
}

const DEPT_KEYWORDS: DeptRule[] = [
  { pattern: /engineer|software|QA|helpdesk|techflow/i, dept: "Engineering" },
  { pattern: /creative|copywrite|design|presentation|art director/i, dept: "Creative & Design" },
  { pattern: /marketing|demand gen|brand|paid media|ABM|content strat/i, dept: "Marketing" },
  { pattern: /event/i, dept: "Events" },
  { pattern: /customer (service|success)|customer insight/i, dept: "Customer Service" },
  { pattern: /finance|accountant|accounts payable|payroll/i, dept: "Finance" },
  { pattern: /sale|store experience|buyer/i, dept: "Sales & Procurement" },
  { pattern: /product (manager|designer)/i, dept: "Product" },
  { pattern: /linguistic|WHiQ|thought leadership/i, dept: "Content & Linguistics" },
  { pattern: /chief|VP|vice president|chief of staff/i, dept: "Executive" },
  { pattern: /HR|people|talent/i, dept: "HR" },
];

export default function extractDept(title: string | null | undefined): string {
  if (!title) return "Other";
  for (const { pattern, dept } of DEPT_KEYWORDS) {
    if (pattern.test(title)) return dept;
  }
  return "Other";
}