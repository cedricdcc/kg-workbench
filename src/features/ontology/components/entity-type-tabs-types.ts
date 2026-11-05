export type EntityType =
  "classes" | "relations" | "standards" | "reasoner" | "datasets"

export const SUPPORTED_ENTITY_TYPES: readonly EntityType[] = [
  "classes",
  "relations",
  "standards",
  "reasoner",
  "datasets",
] as const

export function formatEntityTypeLabel(
  type: EntityType,
  count?: number
): string {
  switch (type) {
    case "classes":
      return count !== undefined ? `Classes (${count})` : "Classes"
    case "relations":
      return count !== undefined ? `Relations (${count})` : "Relations"
    case "standards":
      return count !== undefined ? `Standards (${count})` : "Standards"
    case "reasoner":
      return "Reasoner"
    case "datasets":
      return count !== undefined ? `Datasets (${count})` : "Datasets"
  }
}
