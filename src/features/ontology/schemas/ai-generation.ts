import { z } from "zod"

import { normalizeOntologyDataTypeOrDefault } from "@/features/ontology/utils/data-types"

export const GeneratedAttributeSchema = z.object({
  name: z.string().trim().min(1),
  dataType: z
    .string()
    .trim()
    .default("xsd:string")
    .transform((val) => normalizeOntologyDataTypeOrDefault(val)),
  description: z.string().default(""),
})

export const EntityAlignmentSchema = z.object({
  mode: z.enum(["reuse", "subClassOf", "equivalentClass"]),
  targetCurie: z.string().trim().min(1),
  targetIri: z.string().trim().min(1),
  similarityScore: z.number().optional(),
  rationale: z.string().default(""),
})

export const GeneratedClassSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  moduleName: z.string().trim().min(1),
  parentClassName: z.string().trim().nullable().optional(),
  attributes: z.array(GeneratedAttributeSchema).default([]),
  alignment: EntityAlignmentSchema.optional(),
})

export const GeneratedModuleSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
})

export const GeneratedRelationSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(""),
  domainClassName: z.string().trim().min(1),
  rangeClassName: z.string().trim().min(1),
  alignment: EntityAlignmentSchema.optional(),
})

export const GeneratedCQTripleSchema = z.object({
  subjectClassName: z.string().trim().min(1),
  predicateRelationName: z.string().trim().min(1),
  objectClassName: z.string().trim().min(1),
})

export const GeneratedCQMappingSchema = z
  .object({
    cqId: z.string().uuid(),
    subjectClassName: z.string().trim().optional(),
    predicateRelationName: z.string().trim().optional(),
    objectClassName: z.string().trim().optional(),
    moduleNames: z.array(z.string().trim()).default([]),
    triples: z.array(GeneratedCQTripleSchema).optional().default([]),
  })
  .transform((data) => {
    let triples = data.triples ?? []
    if (
      triples.length === 0 &&
      data.subjectClassName &&
      data.predicateRelationName &&
      data.objectClassName
    ) {
      triples = [
        {
          subjectClassName: data.subjectClassName,
          predicateRelationName: data.predicateRelationName,
          objectClassName: data.objectClassName,
        },
      ]
    }
    const first = triples[0]
    const out: {
      cqId: string
      moduleNames: string[]
      subjectClassName?: string
      predicateRelationName?: string
      objectClassName?: string
      triples: Array<{
        subjectClassName: string
        predicateRelationName: string
        objectClassName: string
      }>
    } = {
      cqId: data.cqId,
      moduleNames: data.moduleNames,
      subjectClassName: first?.subjectClassName ?? data.subjectClassName,
      predicateRelationName:
        first?.predicateRelationName ?? data.predicateRelationName,
      objectClassName: first?.objectClassName ?? data.objectClassName,
      triples,
    }
    return out
  })

export const ContextualConnectionSchema = z.object({
  curie: z.string(),
  iri: z.string(),
  label: z.string(),
  type: z.enum(["parentClass", "relatedProperty"]),
})

export const GeneratedOntologyDraftSchema = z.object({
  modules: z.array(GeneratedModuleSchema),
  classes: z.array(GeneratedClassSchema),
  relations: z.array(GeneratedRelationSchema),
  cqMappings: z.array(GeneratedCQMappingSchema),
  suggestedContext: z.array(ContextualConnectionSchema).default([]),
})

export type EntityAlignment = z.infer<typeof EntityAlignmentSchema>
export type ContextualConnection = z.infer<typeof ContextualConnectionSchema>
export type GeneratedAttribute = z.infer<typeof GeneratedAttributeSchema>
export type GeneratedClass = z.infer<typeof GeneratedClassSchema>
export type GeneratedModule = z.infer<typeof GeneratedModuleSchema>
export type GeneratedRelation = z.infer<typeof GeneratedRelationSchema>
export type GeneratedCQTriple = z.infer<typeof GeneratedCQTripleSchema>
export type GeneratedCQMapping = z.infer<typeof GeneratedCQMappingSchema>
export type GeneratedOntologyDraft = z.infer<
  typeof GeneratedOntologyDraftSchema
>
export type GeneratedOntologyDraftInput = z.input<
  typeof GeneratedOntologyDraftSchema
>

/**
 * Strips markdown code blocks and whitespace from raw LLM responses.
 */
export function sanitizeAiJsonResponse(raw: string): string {
  const trimmed = raw.trim()

  // Match ```json ... ``` or ``` ... ```
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (match?.[1]) {
    return match[1].trim()
  }

  // If no backticks, locate first { and last }
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim()
  }

  return trimmed
}
