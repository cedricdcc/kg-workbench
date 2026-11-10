import crypto from "node:crypto"
import { snapshotToLinkmlYaml } from "./ast-mapper"
import { loadLinkmlRuntime } from "./runtime"
import type {
  CanonicalOntologySnapshot,
  CompiledOntologyArtifacts,
  LinkmlLintIssue,
} from "./types"

export interface CompileLinkmlOptions {
  imports?: Record<string, string>
  importMap?: Record<string, string>
  shaclOptions?: {
    closed?: boolean
    open?: boolean
  }
}

function extractIssueElement(
  issue: Record<string, unknown>
): string | undefined {
  if (typeof issue.element_name === "string" && issue.element_name) {
    return issue.element_name
  }
  if (typeof issue.class_name === "string" && issue.class_name) {
    return issue.class_name
  }
  if (typeof issue.slot_name === "string" && issue.slot_name) {
    return issue.slot_name
  }
  if (typeof issue.cycle === "string" && issue.cycle) {
    return issue.cycle
  }
  if (Array.isArray(issue.class_names) && issue.class_names.length > 0) {
    return issue.class_names.map(String).join(", ")
  }
  if (Array.isArray(issue.slot_names) && issue.slot_names.length > 0) {
    return issue.slot_names.map(String).join(", ")
  }
  const loc = issue.location as Record<string, unknown> | undefined
  if (loc && typeof loc.json_pointer === "string" && loc.json_pointer) {
    return loc.json_pointer
  }
  return undefined
}

function mapToLintIssue(rawIssue: unknown): LinkmlLintIssue {
  if (!rawIssue || typeof rawIssue !== "object") {
    return {
      issue_type: "UnknownIssue",
      severity: "ERROR",
      message: String(rawIssue),
    }
  }

  const issue = rawIssue as Record<string, unknown>
  const issueType =
    typeof issue.issue_type === "string" && issue.issue_type
      ? issue.issue_type
      : "ValidationIssue"
  const severity =
    typeof issue.severity === "string" && issue.severity
      ? issue.severity
      : "ERROR"
  const message =
    typeof issue.message === "string" && issue.message
      ? issue.message
      : typeof issue.details === "string" && issue.details
        ? issue.details
        : issueType
  const element = extractIssueElement(issue)

  return {
    issue_type: issueType,
    severity,
    message,
    ...(element ? { element } : {}),
  }
}

function deduplicateIssues(issues: LinkmlLintIssue[]): LinkmlLintIssue[] {
  const seen = new Set<string>()
  const result: LinkmlLintIssue[] = []

  for (const issue of issues) {
    const key = `${issue.issue_type}::${issue.severity}::${issue.message}::${issue.element ?? ""}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(issue)
    }
  }

  return result
}

/**
 * Compiles a LinkML YAML schema string into multi-format artifacts:
 * SHACL Turtle, RDFS Turtle, OWL 2 Turtle, Pydantic v2 code, JSON Schema, Mermaid ER diagram, and structured lint issues.
 */
export function compileLinkmlOntology(
  linkmlYaml: string,
  options?: CompileLinkmlOptions
): CompiledOntologyArtifacts {
  const linkml = loadLinkmlRuntime()
  const sourceSha256 = crypto
    .createHash("sha256")
    .update(linkmlYaml)
    .digest("hex")
  const compiledAt = new Date().toISOString()

  const imports = options?.imports ?? {}
  const importMap = options?.importMap

  let loadResult
  try {
    loadResult = linkml.loadFromString(linkmlYaml, imports, true, importMap)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      source_sha256: sourceSha256,
      compiled_at: compiledAt,
      shacl_ttl: "",
      rdfs_ttl: "",
      owl_ttl: "",
      pydantic_py: "",
      json_schema: "",
      er_diagram: "",
      lint_issues: [
        {
          issue_type: "FatalLoadError",
          severity: "FATAL",
          message: errorMsg,
        },
      ],
    }
  }

  const rawIssues: unknown[] = []
  if (loadResult.report?.issues) {
    rawIssues.push(...loadResult.report.issues)
  }

  if (!loadResult.view) {
    const mapped = rawIssues.map(mapToLintIssue)
    if (mapped.length === 0) {
      mapped.push({
        issue_type: "LoadError",
        severity: "FATAL",
        message:
          "LinkML schema could not be loaded and returned no SchemaView.",
      })
    }
    return {
      source_sha256: sourceSha256,
      compiled_at: compiledAt,
      shacl_ttl: "",
      rdfs_ttl: "",
      owl_ttl: "",
      pydantic_py: "",
      json_schema: "",
      er_diagram: "",
      lint_issues: deduplicateIssues(mapped),
    }
  }

  const view = loadResult.view
  try {
    const lintReport = linkml.lint(view, true)
    if (lintReport?.issues) {
      rawIssues.push(...lintReport.issues)
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    rawIssues.push({
      issue_type: "LintError",
      severity: "WARNING",
      message: `Schema linting failed: ${errorMsg}`,
    })
  }

  const lintIssues: LinkmlLintIssue[] = rawIssues.map(mapToLintIssue)

  const runEmitter = (name: string, fn: () => string): string => {
    try {
      return fn()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      lintIssues.push({
        issue_type: "EmitterError",
        severity: "ERROR",
        message: `${name} emitter failed: ${errorMsg}`,
        element: name,
      })
      return ""
    }
  }

  const shaclOpen =
    options?.shaclOptions?.open ??
    (options?.shaclOptions?.closed !== undefined
      ? !options.shaclOptions.closed
      : undefined)
  const shaclTtl = runEmitter("shacl", () =>
    view.shacl({ format: "ttl", open: shaclOpen })
  )
  const rdfsTtl = runEmitter("rdfs", () => view.rdfs({ format: "ttl" }))
  const owlTtl = runEmitter("owl", () => view.owl({ format: "ttl" }))
  const pydanticPy = runEmitter("pydantic", () => view.pydantic())
  const jsonSchema = runEmitter("jsonSchema", () => view.jsonSchema())
  const erDiagram = runEmitter("erDiagram", () => view.erDiagram())

  return {
    source_sha256: sourceSha256,
    compiled_at: compiledAt,
    shacl_ttl: shaclTtl,
    rdfs_ttl: rdfsTtl,
    owl_ttl: owlTtl,
    pydantic_py: pydanticPy,
    json_schema: jsonSchema,
    er_diagram: erDiagram,
    lint_issues: deduplicateIssues(lintIssues),
  }
}

/**
 * Compiles a CanonicalOntologySnapshot into LinkML YAML and all derived multi-format artifacts.
 */
export function compileSnapshotArtifacts(
  snapshot: CanonicalOntologySnapshot,
  options?: CompileLinkmlOptions
): {
  linkmlYaml: string
  artifacts: CompiledOntologyArtifacts
} {
  const linkmlYaml = snapshotToLinkmlYaml(snapshot)
  const artifacts = compileLinkmlOntology(linkmlYaml, options)
  return {
    linkmlYaml,
    artifacts,
  }
}
