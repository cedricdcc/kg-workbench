export interface IssuesCounts {
  error: number
  warning: number
  suggestion?: number
  info?: number
}

export type IssuesVariant =
  "error" | "warning" | "suggestion" | "info" | "clean"

export interface IssuesSummary {
  variant: IssuesVariant
  label: string
  tooltip: string
  hasIssues: boolean
  hasErrors: boolean
  hasWarnings: boolean
  hasSuggestions: boolean
}

export function getOntologyIssuesSummary(counts: IssuesCounts): IssuesSummary {
  const errorCount = counts.error ?? 0
  const warningCount = counts.warning ?? 0
  const suggestionCount = counts.suggestion ?? 0
  const infoCount = counts.info ?? 0

  const hasErrors = errorCount > 0
  const hasWarnings = warningCount > 0
  const hasSuggestions = suggestionCount > 0
  const hasInfo = infoCount > 0

  if (hasErrors) {
    const errorText = `${errorCount} ${errorCount === 1 ? "Error" : "Errors"}`
    const warningText =
      warningCount > 0
        ? ` · ${warningCount} ${warningCount === 1 ? "Warning" : "Warnings"}`
        : ""
    return {
      variant: "error",
      label: `${errorText}${warningText}`,
      tooltip: `${errorCount} error(s)${
        warningCount > 0 ? ` and ${warningCount} warning(s)` : ""
      } detected. Click to inspect and resolve.`,
      hasIssues: true,
      hasErrors: true,
      hasWarnings,
      hasSuggestions,
    }
  }

  if (hasWarnings) {
    return {
      variant: "warning",
      label: `${warningCount} ${warningCount === 1 ? "Warning" : "Warnings"}`,
      tooltip: `${warningCount} warning(s) detected. Click to inspect quality rules.`,
      hasIssues: true,
      hasErrors: false,
      hasWarnings: true,
      hasSuggestions,
    }
  }

  if (hasSuggestions) {
    return {
      variant: "suggestion",
      label: `${suggestionCount} ${
        suggestionCount === 1 ? "Suggestion" : "Suggestions"
      }`,
      tooltip: `${suggestionCount} semantic suggestion(s) detected. Click to review.`,
      hasIssues: true,
      hasErrors: false,
      hasWarnings: false,
      hasSuggestions: true,
    }
  }

  if (hasInfo) {
    return {
      variant: "info",
      label: `${infoCount} Info`,
      tooltip: `${infoCount} informational item(s). Click to view details.`,
      hasIssues: true,
      hasErrors: false,
      hasWarnings: false,
      hasSuggestions: false,
    }
  }

  return {
    variant: "clean",
    label: "Clean",
    tooltip: "Ontology structure is clean. Click to inspect quality checks.",
    hasIssues: false,
    hasErrors: false,
    hasWarnings: false,
    hasSuggestions: false,
  }
}
