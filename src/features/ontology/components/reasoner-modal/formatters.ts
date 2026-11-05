export function formatViolationBadge(severity: string): {
  label: string
  variant: "destructive" | "secondary" | "outline"
} {
  switch (severity) {
    case "Violation":
      return { label: "Violation", variant: "destructive" }
    case "Warning":
      return { label: "Warning", variant: "secondary" }
    default:
      return { label: severity || "Info", variant: "outline" }
  }
}
