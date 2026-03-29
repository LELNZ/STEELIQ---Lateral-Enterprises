import { getGlassPrice, getGlassCombos, getAvailableThicknesses, IGU_INFO } from "./glass-library";

export interface PaneGlassSpec {
  paneIndex: number;
  iguType: string;
  glassType: string;
  glassThickness: string;
}

export type PaneResolutionStatus =
  | "all-valid"
  | "some-unresolved"
  | "all-unresolved"
  | "no-overrides";

export interface PaneValidationResult {
  paneIndex: number;
  isValid: boolean;
  iguTypeValid: boolean;
  glassTypeValid: boolean;
  thicknessValid: boolean;
  priceResolved: boolean;
  storedIguType: string;
  storedGlassType: string;
  storedThickness: string;
  resolvedPrice: number | null;
  issues: string[];
}

export interface PaneIntegritySummary {
  status: PaneResolutionStatus;
  totalPanes: number;
  validCount: number;
  invalidCount: number;
  overrideCount: number;
  paneResults: PaneValidationResult[];
  explanation: string;
}

const VALID_IGU_TYPES = Object.keys(IGU_INFO);

export function validatePaneSpec(spec: PaneGlassSpec): PaneValidationResult {
  const result: PaneValidationResult = {
    paneIndex: spec.paneIndex,
    isValid: false,
    iguTypeValid: false,
    glassTypeValid: false,
    thicknessValid: false,
    priceResolved: false,
    storedIguType: spec.iguType || "",
    storedGlassType: spec.glassType || "",
    storedThickness: spec.glassThickness || "",
    resolvedPrice: null,
    issues: [],
  };

  if (!spec.iguType) {
    result.issues.push("IGU type is missing");
    return result;
  }

  if (!VALID_IGU_TYPES.includes(spec.iguType)) {
    result.issues.push(`IGU type "${spec.iguType}" is not a valid library family`);
    return result;
  }
  result.iguTypeValid = true;

  if (!spec.glassType) {
    result.issues.push("Glass type is missing");
    return result;
  }

  const validCombos = getGlassCombos(spec.iguType);
  if (!validCombos.includes(spec.glassType)) {
    result.issues.push(`Glass type "${spec.glassType}" is not valid for ${spec.iguType}`);
    return result;
  }
  result.glassTypeValid = true;

  if (!spec.glassThickness) {
    result.issues.push("Glass thickness is missing");
    return result;
  }

  const validThicknesses = getAvailableThicknesses(spec.iguType, spec.glassType);
  if (!validThicknesses.includes(spec.glassThickness)) {
    result.issues.push(`Thickness "${spec.glassThickness}" is not available for ${spec.iguType} / ${spec.glassType}`);
    return result;
  }
  result.thicknessValid = true;

  const price = getGlassPrice(spec.iguType, spec.glassType, spec.glassThickness);
  if (price == null) {
    result.issues.push("Price could not be resolved from the glass library");
    return result;
  }

  result.priceResolved = true;
  result.resolvedPrice = price;
  result.isValid = true;
  return result;
}

export function classifyPaneResolutionState(
  specs: PaneGlassSpec[] | undefined | null,
  effectivePaneCount: number
): PaneResolutionStatus {
  if (!specs || specs.length === 0) return "no-overrides";

  const withContent = specs.filter(
    (s) => s.iguType || s.glassType || s.glassThickness
  );
  if (withContent.length === 0) return "no-overrides";

  let validCount = 0;
  let totalChecked = 0;

  for (const spec of withContent) {
    if (spec.paneIndex >= effectivePaneCount) continue;
    totalChecked++;
    const result = validatePaneSpec(spec);
    if (result.isValid) validCount++;
  }

  if (totalChecked === 0) return "no-overrides";
  if (validCount === totalChecked) return "all-valid";
  if (validCount === 0) return "all-unresolved";
  return "some-unresolved";
}

export function getInvalidPanes(
  specs: PaneGlassSpec[] | undefined | null,
  effectivePaneCount?: number
): PaneValidationResult[] {
  if (!specs || specs.length === 0) return [];

  return specs
    .filter((s) =>
      effectivePaneCount == null || s.paneIndex < effectivePaneCount
    )
    .map((s) => validatePaneSpec(s))
    .filter((r) => !r.isValid);
}

export function getPaneIntegritySummary(
  specs: PaneGlassSpec[] | undefined | null,
  effectivePaneCount: number
): PaneIntegritySummary {
  const status = classifyPaneResolutionState(specs, effectivePaneCount);
  const activeSpecs = (specs || []).filter(
    (s) => s.paneIndex < effectivePaneCount && (s.iguType || s.glassType || s.glassThickness)
  );

  const paneResults = activeSpecs.map((s) => validatePaneSpec(s));
  const validCount = paneResults.filter((r) => r.isValid).length;
  const invalidCount = paneResults.filter((r) => !r.isValid).length;

  let explanation: string;
  switch (status) {
    case "no-overrides":
      explanation = "No pane-level glass overrides — using default glass pricing for all panes.";
      break;
    case "all-valid":
      explanation = `All ${validCount} pane override(s) resolved successfully — pane-aware pricing is active.`;
      break;
    case "all-unresolved":
      explanation = `All ${invalidCount} pane override(s) failed to resolve against the glass library — using default glass pricing as fallback.`;
      break;
    case "some-unresolved":
      explanation = `${validCount} of ${activeSpecs.length} pane override(s) resolved. ${invalidCount} pane(s) could not resolve and use default glass pricing as fallback.`;
      break;
  }

  return {
    status,
    totalPanes: effectivePaneCount,
    validCount,
    invalidCount,
    overrideCount: activeSpecs.length,
    paneResults,
    explanation,
  };
}

export function formatFallbackExplanation(
  specs: PaneGlassSpec[] | undefined | null,
  effectivePaneCount: number
): string {
  const summary = getPaneIntegritySummary(specs, effectivePaneCount);

  if (summary.status === "no-overrides" || summary.status === "all-valid") {
    return summary.explanation;
  }

  const invalidDetails = summary.paneResults
    .filter((r) => !r.isValid)
    .map((r) => {
      const stored = [r.storedIguType, r.storedGlassType, r.storedThickness]
        .filter(Boolean)
        .join(" / ");
      return `  Pane ${r.paneIndex + 1}: stored "${stored || "(empty)"}" — ${r.issues.join("; ")}`;
    })
    .join("\n");

  return `${summary.explanation}\n\nUnresolved pane details:\n${invalidDetails}\n\nFallback: Default glass pricing applied for unresolved panes.`;
}

export function isSpecComplete(spec: PaneGlassSpec): boolean {
  return !!(spec.iguType && spec.glassType && spec.glassThickness);
}

export function hasIncompleteSpecs(specs: PaneGlassSpec[] | undefined | null): boolean {
  if (!specs || specs.length === 0) return false;
  return specs.some(
    (s) =>
      (s.iguType || s.glassType || s.glassThickness) &&
      !(s.iguType && s.glassType && s.glassThickness)
  );
}
