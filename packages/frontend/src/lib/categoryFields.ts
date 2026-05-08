import { ReportCategory } from "@shieldpass/shared/enums";

export type FieldKind = "text" | "textarea" | "date" | "select" | "url-list";

export interface Field {
  key: string;
  label: string;
  help?: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[]; // for select
  maxLength?: number;
}

const SHARED_TAIL: Field[] = [
  { key: "incidentDate", label: "Incident date", kind: "date", required: true },
  { key: "severity", label: "Severity", kind: "select", required: true,
    options: ["low", "medium", "high", "critical"] },
  { key: "publicSourceRefs", label: "Public source URLs", help: "Links to public statements or filings being contradicted.",
    kind: "url-list" },
];

/** Per-category structured-fields schema. Drives the StructuredFields form in Submit step 3. */
export const CATEGORY_FIELDS: Record<ReportCategory, Field[]> = {
  [ReportCategory.Misconduct]: [
    { key: "claim", label: "Stated rule or policy", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Observed breach", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.SelectiveDisclosure]: [
    { key: "claim", label: "What was disclosed", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "What was withheld", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.Misclassification]: [
    { key: "claim", label: "Stated classification", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Actual activity / category", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.HollowPromise]: [
    { key: "claim", label: "Public commitment", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Internal plan / budget reality", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.InNameOnly]: [
    { key: "claim", label: "Branded initiative", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Operational status (staffing, KPIs, cadence)", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
  [ReportCategory.MisleadingPresentation]: [
    { key: "claim", label: "Headline figure / framing", kind: "textarea", required: true, maxLength: 800 },
    { key: "reality", label: "Underlying data / alternative framing", kind: "textarea", required: true, maxLength: 800 },
    ...SHARED_TAIL,
  ],
};
