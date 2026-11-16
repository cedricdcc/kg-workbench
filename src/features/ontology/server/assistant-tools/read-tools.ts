import { z } from "zod"
import { runWithGroupKey } from "@/server/group-access"
import { runOntologyLinter } from "@/features/ontology/utils/linter"
import { getLatestReasonerRunQuery } from "@/features/tabular/server/queries/get-latest-reasoner-run"
import {
  exportOntologyArtifactsAction,
  type OntologyArtifactFormat,
} from "../actions/export-ontology-artifacts"
import { searchOhiRegistryAction } from "../actions/reference-vocabularies"
import { requestOntologyReasoningAction } from "../actions/run-ontology-reasoning"
import {
  getClassBlastRadius,
  getRelationBlastRadius,
} from "../blast-radius/queries"
import { loadCanonicalOntology } from "../linkml/document-store"
import { getOntologyClasses } from "../queries/classes"
import { getOntologyCQs } from "../queries/competency-questions"
import { getOntologyDocument, getOntologyDocuments } from "../queries/documents"
import { getOntologyModules } from "../queries/modules"
import { getOntologyRelations } from "../queries/relations"
import type { OntologyToolContext, OntologyToolDefinition } from "./types"

const EXPORT_FORMAT_MAP = {
  "linkml-yaml": "linkml-yaml",
  shacl: "shacl-ttl",
  owl: "owl-ttl",
  rdfs: "rdfs-ttl",
  "json-schema": "json-schema",
  pydantic: "pydantic-py",
} as const satisfies Record<string, OntologyArtifactFormat>

export type ExportOntologyFormat = keyof typeof EXPORT_FORMAT_MAP

export interface ReadToolsDeps {
  getOntologyDocuments: typeof getOntologyDocuments
  getOntologyDocument: typeof getOntologyDocument
  getOntologyClasses: typeof getOntologyClasses
  getOntologyRelations: typeof getOntologyRelations
  getOntologyModules: typeof getOntologyModules
  getOntologyCQs: typeof getOntologyCQs
  loadCanonicalOntology: typeof loadCanonicalOntology
  getClassBlastRadius: typeof getClassBlastRadius
  getRelationBlastRadius: typeof getRelationBlastRadius
  runOntologyLinter: typeof runOntologyLinter
  requestOntologyReasoningAction: typeof requestOntologyReasoningAction
  getLatestReasonerRunQuery: typeof getLatestReasonerRunQuery
  searchOhiRegistryAction: typeof searchOhiRegistryAction
  exportOntologyArtifactsAction: typeof exportOntologyArtifactsAction
}

const DEFAULT_READ_TOOLS_DEPS: ReadToolsDeps = {
  getOntologyDocuments,
  getOntologyDocument,
  getOntologyClasses,
  getOntologyRelations,
  getOntologyModules,
  getOntologyCQs,
  loadCanonicalOntology,
  getClassBlastRadius,
  getRelationBlastRadius,
  runOntologyLinter,
  requestOntologyReasoningAction,
  getLatestReasonerRunQuery,
  searchOhiRegistryAction,
  exportOntologyArtifactsAction,
}

function getDbFromContext(ctx: OntologyToolContext) {
  return ctx.tx ?? ctx.db
}

function defineReadTool<TInput extends z.ZodTypeAny, TOutput>(
  definition: Omit<OntologyToolDefinition<TInput, TOutput>, "mode">
): OntologyToolDefinition<TInput, TOutput> {
  return {
    ...definition,
    mode: "read",
    execute: (ctx, rawInput) => {
      const parsed = definition.inputSchema.parse(rawInput)
      return runWithGroupKey(ctx.groupKey, () =>
        definition.execute(ctx, parsed)
      )
    },
  }
}

/**
 * Builds the 12 read and validation tools for the shared Ontology Tool Engine.
 * Accepts optional dependency overrides for isolated unit testing.
 */
export function createReadTools(overrides?: Partial<ReadToolsDeps>) {
  const deps: ReadToolsDeps = {
    ...DEFAULT_READ_TOOLS_DEPS,
    ...overrides,
  }

  const list_ontologies = defineReadTool({
    name: "list_ontologies",
    description:
      "List all ontology documents accessible to the current access group.",
    inputSchema: z.object({}),
    execute: async () => {
      const docs = await deps.getOntologyDocuments()
      return {
        ontologies: docs.map((doc) => ({
          id: doc.id,
          name: doc.name,
          version: doc.version,
          defaultLanguage: doc.default_language,
          usecase: doc.usecase,
          createdAt: doc.created_at,
        })),
      }
    },
  })

  const get_ontology_summary = defineReadTool({
    name: "get_ontology_summary",
    description:
      "Return modules, classes, relations, competency question count, and linter defect counts for an ontology.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
    }),
    execute: async (ctx, input) => {
      const db = getDbFromContext(ctx)
      const [doc, classes, relations, cqs] = await Promise.all([
        deps.getOntologyDocument(input.ontologyId),
        deps.getOntologyClasses(input.ontologyId, db),
        deps.getOntologyRelations(input.ontologyId, db),
        deps.getOntologyCQs(input.ontologyId),
      ])
      const lintReport = deps.runOntologyLinter({ classes, relations })

      return {
        ontology: {
          id: doc.id,
          name: doc.name,
          version: doc.version,
          defaultLanguage: doc.default_language,
          usecase: doc.usecase,
        },
        modules: doc.modules.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
        })),
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          moduleId: c.module_id,
          parentClassId: c.parent_class_id,
          attributeCount: c.attributes.length,
        })),
        relations: relations.map((r) => ({
          id: r.id,
          name: r.name,
          domainClassId: r.domain_class_id,
          rangeClassId: r.range_class_id,
        })),
        cqCount: cqs.length,
        linterDefectCount: lintReport.total,
        linterCounts: lintReport.counts,
      }
    },
  })

  const get_class_details = defineReadTool({
    name: "get_class_details",
    description:
      "Return full class metadata, attributes, incoming/outgoing relations, notes, examples, and linked competency questions.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      classId: z.string().min(1),
    }),
    execute: async (ctx, input) => {
      const db = getDbFromContext(ctx)
      const [snapshot, classes, relations, cqs] = await Promise.all([
        deps.loadCanonicalOntology(input.ontologyId, db),
        deps.getOntologyClasses(input.ontologyId, db),
        deps.getOntologyRelations(input.ontologyId, db),
        deps.getOntologyCQs(input.ontologyId),
      ])

      const targetClass =
        classes.find((c) => c.id === input.classId) ??
        classes.find(
          (c) => c.name.toLowerCase() === input.classId.toLowerCase()
        )

      if (!targetClass) {
        throw new Error(`Class ${input.classId} not found.`)
      }

      const outgoingRelations = relations.filter(
        (r) => r.domain_class_id === targetClass.id
      )
      const incomingRelations = relations.filter(
        (r) => r.range_class_id === targetClass.id
      )
      const notes = (snapshot.notes ?? []).filter(
        (n) => n.target_type === "class" && n.target_id === targetClass.id
      )
      const examples = (snapshot.examples ?? []).filter(
        (e) => e.target_type === "class" && e.target_id === targetClass.id
      )
      const linkedCqs = cqs.filter((cq) =>
        cq.triples.some(
          (t) =>
            t.subject_class_id === targetClass.id ||
            t.object_class_id === targetClass.id
        )
      )

      return {
        class: targetClass,
        outgoingRelations,
        incomingRelations,
        notes,
        examples,
        linkedCqs,
      }
    },
  })

  const search_symbols = defineReadTool({
    name: "search_symbols",
    description:
      "Search across ontology classes, attributes, relations, and modules by substring.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    execute: async (ctx, input) => {
      const db = getDbFromContext(ctx)
      const [classes, relations, modules] = await Promise.all([
        deps.getOntologyClasses(input.ontologyId, db),
        deps.getOntologyRelations(input.ontologyId, db),
        deps.getOntologyModules(input.ontologyId, db),
      ])

      const needle = input.query.trim().toLowerCase()
      const matches: Array<{
        kind: "module" | "class" | "attribute" | "relation"
        id: string
        name: string
        description: string
        parentId?: string
        parentName?: string
      }> = []

      const includesNeedle = (...values: Array<string | null | undefined>) =>
        values.some((v) => v?.toLowerCase().includes(needle))

      for (const mod of modules) {
        if (includesNeedle(mod.id, mod.name, mod.description)) {
          matches.push({
            kind: "module",
            id: mod.id,
            name: mod.name,
            description: mod.description ?? "",
          })
        }
      }

      for (const cls of classes) {
        if (includesNeedle(cls.id, cls.name, cls.description)) {
          matches.push({
            kind: "class",
            id: cls.id,
            name: cls.name,
            description: cls.description ?? "",
          })
        }
        for (const attr of cls.attributes) {
          if (includesNeedle(attr.id, attr.name, attr.description)) {
            matches.push({
              kind: "attribute",
              id: attr.id,
              name: attr.name,
              description: attr.description ?? "",
              parentId: cls.id,
              parentName: cls.name,
            })
          }
        }
      }

      for (const rel of relations) {
        if (includesNeedle(rel.id, rel.name, rel.description)) {
          matches.push({
            kind: "relation",
            id: rel.id,
            name: rel.name,
            description: rel.description ?? "",
          })
        }
      }

      const limit = input.limit ?? 25
      return {
        query: input.query,
        totalMatches: matches.length,
        matches: matches.slice(0, limit),
      }
    },
  })

  const get_linkml_yaml = defineReadTool({
    name: "get_linkml_yaml",
    description:
      "Return the canonical LinkML YAML document (and optionally ohi.yaml) for an ontology.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      includeOhiYaml: z.boolean().optional(),
    }),
    execute: async (_ctx, input) => {
      const doc = await deps.getOntologyDocument(input.ontologyId)
      return {
        ontologyId: doc.id,
        name: doc.name,
        linkmlYaml: doc.linkml_yaml ?? "",
        ...(input.includeOhiYaml ? { ohiYaml: doc.ohi_yaml ?? null } : {}),
      }
    },
  })

  const list_cqs = defineReadTool({
    name: "list_cqs",
    description:
      "List competency questions with derived covered/uncovered status from linked SPO triples.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      moduleId: z.string().min(1).optional(),
      status: z.enum(["covered", "uncovered"]).optional(),
    }),
    execute: async (_ctx, input) => {
      const cqs = await deps.getOntologyCQs(input.ontologyId)
      const enriched = cqs.map((cq) => ({
        ...cq,
        status: (cq.triples.length > 0 ? "covered" : "uncovered") as
          "covered" | "uncovered",
      }))

      const filtered = enriched.filter((cq) => {
        if (
          input.moduleId &&
          !cq.modules.some((m) => m.id === input.moduleId)
        ) {
          return false
        }
        if (input.status && cq.status !== input.status) {
          return false
        }
        return true
      })

      const coveredCount = filtered.filter((c) => c.status === "covered").length
      const uncoveredCount = filtered.length - coveredCount

      return {
        ontologyId: input.ontologyId,
        total: filtered.length,
        coveredCount,
        uncoveredCount,
        competencyQuestions: filtered,
      }
    },
  })

  const get_reasoner_report = defineReadTool({
    name: "get_reasoner_report",
    description:
      "Fetch the latest SHACL/OWL reasoner run status, violations, and entailments for an ontology.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
    }),
    execute: async (ctx, input) => {
      await deps.getOntologyModules(input.ontologyId, getDbFromContext(ctx))
      const latest = await deps.getLatestReasonerRunQuery(input.ontologyId)
      if (!latest) {
        return {
          status: "none" as const,
          jobId: null,
          createdAt: null,
          result: null,
        }
      }
      return {
        status: latest.status,
        jobId: latest.jobId,
        createdAt: latest.createdAt,
        result: latest.result,
      }
    },
  })

  const check_blast_radius = defineReadTool({
    name: "check_blast_radius",
    description:
      "Inspect downstream impact on facts, entities, and competency questions before renaming or deleting a class or relation.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      symbolKind: z.enum(["class", "relation"]),
      symbolId: z.string().min(1),
    }),
    execute: async (ctx, input) => {
      const db = getDbFromContext(ctx)
      if (input.symbolKind === "class") {
        return deps.getClassBlastRadius(input.ontologyId, input.symbolId, db)
      }
      return deps.getRelationBlastRadius(input.ontologyId, input.symbolId, db)
    },
  })

  const lint_ontology = defineReadTool({
    name: "lint_ontology",
    description:
      "Run the workbench ontology linter and return structured defects.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
    }),
    execute: async (ctx, input) => {
      const db = getDbFromContext(ctx)
      const [classes, relations] = await Promise.all([
        deps.getOntologyClasses(input.ontologyId, db),
        deps.getOntologyRelations(input.ontologyId, db),
      ])
      return deps.runOntologyLinter({ classes, relations })
    },
  })

  const run_reasoner = defineReadTool({
    name: "run_reasoner",
    description:
      "Trigger a SHACL/OWL reasoning run and return completed, pending, failed, or offline status.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
    }),
    execute: async (_ctx, input) => {
      return deps.requestOntologyReasoningAction(input.ontologyId)
    },
  })

  const search_ohi_packages = defineReadTool({
    name: "search_ohi_packages",
    description:
      "Search the ohi.dev vocabulary registry (with built-in publication fallback when offline).",
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async (_ctx, input) => {
      const results = await deps.searchOhiRegistryAction(input.query, {
        limit: input.limit,
      })
      return {
        query: input.query,
        results,
      }
    },
  })

  const export_ontology = defineReadTool({
    name: "export_ontology",
    description:
      "Compile and export an ontology to linkml-yaml, shacl, owl, rdfs, json-schema, or pydantic.",
    inputSchema: z.object({
      ontologyId: z.string().min(1),
      format: z.enum([
        "linkml-yaml",
        "shacl",
        "owl",
        "rdfs",
        "json-schema",
        "pydantic",
      ]),
      baseIri: z.string().url().optional(),
      exportLanguage: z.string().min(1).optional(),
    }),
    execute: async (_ctx, input) => {
      const artifactFormat = EXPORT_FORMAT_MAP[input.format]
      const exported = await deps.exportOntologyArtifactsAction(
        input.ontologyId,
        artifactFormat,
        {
          baseIri: input.baseIri,
          exportLanguage: input.exportLanguage,
        }
      )
      return {
        format: input.format,
        fileName: exported.fileName,
        mimeType: exported.mimeType,
        content: exported.content,
        sourceSha256: exported.sourceSha256,
        lintIssues: exported.lintIssues ?? [],
      }
    },
  })

  return {
    list_ontologies,
    get_ontology_summary,
    get_class_details,
    search_symbols,
    get_linkml_yaml,
    list_cqs,
    get_reasoner_report,
    check_blast_radius,
    lint_ontology,
    run_reasoner,
    search_ohi_packages,
    export_ontology,
  }
}

export const READ_TOOLS = createReadTools()

export type ReadToolName = keyof typeof READ_TOOLS
