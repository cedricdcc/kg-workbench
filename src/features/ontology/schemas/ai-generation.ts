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

export const GeneratedCQMappingSchema = z.object({
  cqId: z.string().uuid(),
  subjectClassName: z.string().trim().min(1),
  predicateRelationName: z.string().trim().min(1),
  objectClassName: z.string().trim().min(1),
  moduleNames: z.array(z.string().trim()).default([]),
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

export type GeneratedAttribute = z.infer<typeof GeneratedAttributeSchema>
export type GeneratedClass = z.infer<typeof GeneratedClassSchema>
export type GeneratedModule = z.infer<typeof GeneratedModuleSchema>
export type GeneratedRelation = z.infer<typeof GeneratedRelationSchema>
export type GeneratedCQMapping = z.infer<typeof GeneratedCQMappingSchema>
export type GeneratedOntologyDraft = z.infer<typeof GeneratedOntologyDraftSchema>
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
