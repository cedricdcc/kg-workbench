import type {
  CascadePreview,
  CompilerStudioData,
  SaveRawLinkmlResult,
} from "@/features/ontology/server/actions/compiler-studio"
import type {
  CompiledOntologyArtifacts,
  LinkmlLintIssue,
  OhiLockfileV2,
} from "@/features/ontology/server/linkml/types"

export type {
  CascadePreview,
  CompiledOntologyArtifacts,
  CompilerStudioData,
  LinkmlLintIssue,
  OhiLockfileV2,
  SaveRawLinkmlResult,
}

export type CompilerStudioTabId =
  | "linkml"
  | "shacl"
  | "rdfs"
  | "owl"
  | "pydantic"
  | "json-schema"
  | "er-diagram"
  | "ohi"

export interface CompilerFormatTabConfig {
  id: CompilerStudioTabId
  label: string
  filenameSuffix: string
  mimeType: string
  languageLabel: string
}

export const COMPILER_FORMAT_TABS: CompilerFormatTabConfig[] = [
  {
    id: "linkml",
    label: "LinkML YAML",
    filenameSuffix: ".linkml.yaml",
    mimeType: "application/yaml",
    languageLabel: "YAML (Canonical)",
  },
  {
    id: "shacl",
    label: "W3C SHACL",
    filenameSuffix: ".shacl.ttl",
    mimeType: "text/turtle",
    languageLabel: "Turtle (SHACL)",
  },
  {
    id: "rdfs",
    label: "RDFS",
    filenameSuffix: ".rdfs.ttl",
    mimeType: "text/turtle",
    languageLabel: "Turtle (RDFS)",
  },
  {
    id: "owl",
    label: "OWL 2",
    filenameSuffix: ".owl.ttl",
    mimeType: "text/turtle",
    languageLabel: "Turtle (OWL 2)",
  },
  {
    id: "pydantic",
    label: "Pydantic v2",
    filenameSuffix: "models.py",
    mimeType: "text/x-python",
    languageLabel: "Python (Pydantic v2)",
  },
  {
    id: "json-schema",
    label: "JSON Schema",
    filenameSuffix: ".schema.json",
    mimeType: "application/json",
    languageLabel: "JSON Schema",
  },
  {
    id: "er-diagram",
    label: "Mermaid ER",
    filenameSuffix: ".er.mmd",
    mimeType: "text/markdown",
    languageLabel: "Mermaid ER",
  },
  {
    id: "ohi",
    label: "ohi.yaml / ohi.lock.json",
    filenameSuffix: "ohi.yaml",
    mimeType: "application/yaml",
    languageLabel: "OHI Manifest & Lockfile",
  },
]

export function buildArtifactFilename(
  ontologyName: string,
  suffix: string
): string {
  if (!suffix.startsWith(".")) {
    return suffix
  }
  const slug =
    ontologyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ontology"
  return `${slug}${suffix}`
}
