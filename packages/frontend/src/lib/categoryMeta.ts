import { ReportCategory } from "@shieldpass/shared/enums";

export type CategoryTone = "neutral" | "amber" | "alert" | "verify";

export const CATEGORY_META: Record<ReportCategory, { glyph: string; label: string; desc: string; tone: CategoryTone }> = {
  [ReportCategory.Misconduct]:             { glyph: "§", label: "Misconduct",              desc: "Verifiable breach of regulation or stated policy.",  tone: "alert"   },
  [ReportCategory.SelectiveDisclosure]:    { glyph: "◐", label: "Selective Disclosure",    desc: "Material data omitted from public reporting.",        tone: "amber"   },
  [ReportCategory.Misclassification]:      { glyph: "◇", label: "Misclassification",       desc: "Activity recategorized to evade scrutiny.",            tone: "amber"   },
  [ReportCategory.HollowPromise]:          { glyph: "◬", label: "Hollow Promise",          desc: "Public commitment without internal plan or budget.",   tone: "neutral" },
  [ReportCategory.InNameOnly]:             { glyph: "∅", label: "In Name Only",            desc: "Initiative branded but not operationally implemented.",tone: "neutral" },
  [ReportCategory.MisleadingPresentation]: { glyph: "⊘", label: "Misleading Presentation", desc: "Accurate figures arranged to imply a false conclusion.",tone: "amber" },
};

export const ALL_CATEGORIES: ReportCategory[] = Object.values(ReportCategory) as ReportCategory[];
