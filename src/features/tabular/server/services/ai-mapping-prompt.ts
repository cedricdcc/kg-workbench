import { z } from "zod"
import { sanitizeAiJsonResponse } from "@/features/ontology/schemas/ai-generation"
import type {
  DatasetMappingSpec,
  TabularProfileResult,
} from "@/features/tabular/types"

export interface BuildAiMappingPromptInput {
  sourceName: string
  profile: {
    rowCount: number
    columnCount: number
    candidateKeys: string[][]
    columns: TabularProfileResult["columns"]
  }
  sampleRows: Record<string, unknown>[]
  existingClasses: Array<{
    id: string
    name: string
    description?: string | null
    attributes: Array<{ name: string; dataType: string }>
  }>
  existingRelations: Array<{
    id: string
    name: string
    domainClassName?: string
    rangeClassName?: string
  }>
  historicalArchiveSummary?: Array<{
    sourceName: string
    mappedClassName: string
  }>
}

export const DatasetColumnMappingSchema = z.object({
  columnName: z.string().trim().min(1),
  inferredType: z.enum(["string", "number", "boolean", "date"]),
  targetKind: z.enum(["attribute", "relation", "ignore"]),
  targetAttributeName: z.string().trim().optional(),
  targetDataType: z.string().trim().optional(),
  targetRelationName: z.string().trim().optional(),
  targetClassId: z.string().trim().optional(),
  isPrimaryKey: z.boolean().optional(),
})

export const DatasetMappingSpecSchema = z.object({
  targetClassId: z.string().trim().optional(),
  targetClassName: z.string().trim().min(1),
  targetModuleId: z.string().trim().optional(),
  primaryKeyColumn: z.string().trim().min(1),
  columnMappings: z.array(DatasetColumnMappingSchema),
  synthesizedElements: z
    .object({
      classes: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            description: z.string().optional(),
            moduleId: z.string().optional(),
          })
        )
        .optional()
        .default([]),
      attributes: z
        .array(
          z.object({
            className: z.string().trim().min(1),
            name: z.string().trim().min(1),
            dataType: z.string().trim().default("xsd:string"),
          })
        )
        .optional()
        .default([]),
      relations: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            sourceClass: z.string().trim().min(1),
            targetClass: z.string().trim().min(1),
          })
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ classes: [], attributes: [], relations: [] }),
})

export function buildAiMappingPrompt(input: BuildAiMappingPromptInput): {
  systemPrompt: string
  userPrompt: string
} {
  const systemPrompt = `You are an expert Knowledge Graph and Semantic Modeling architect.
Your role is to map tabular dataset columns to ontology classes, attributes (datatype properties), and relations (object properties).

Rules:
1. Examine the dataset profile, candidate primary keys, and sample rows.
2. If an existing ontology class fits the table, map to it (set targetClassName).
3. If no existing class fits, synthesize a new, clean PascalCase class name and list it under synthesizedElements.classes.
4. For each column:
   - Identify candidate primary keys (single or composite uniqueness) to act as primaryKeyColumn for entity IRI generation.
   - If the column maps to an existing attribute or a scalar property, set targetKind = "attribute", targetAttributeName (camelCase), and targetDataType (e.g. xsd:string, xsd:integer, xsd:decimal, xsd:boolean, xsd:date). If the attribute does not exist yet on the class, list it under synthesizedElements.attributes.
   - If the column references another entity or foreign key, set targetKind = "relation", targetRelationName (camelCase), and targetClassId or range class name. If the relation does not exist, list it under synthesizedElements.relations.
   - If the column is noise/temporary, set targetKind = "ignore".
5. Align naming conventions with any provided historical dataset archive examples.
6. Return STRICT, valid JSON matching the schema below without conversational filler or Markdown fences.

Response format:
{
  "targetClassName": "string",
  "primaryKeyColumn": "string",
  "columnMappings": [
    {
      "columnName": "string",
      "inferredType": "string|number|boolean|date",
      "targetKind": "attribute|relation|ignore",
      "targetAttributeName": "string (optional)",
      "targetDataType": "xsd:string|xsd:integer|xsd:decimal|xsd:boolean|xsd:date (optional)",
      "targetRelationName": "string (optional)",
      "isPrimaryKey": true|false
    }
  ],
  "synthesizedElements": {
    "classes": [{ "name": "string", "description": "string" }],
    "attributes": [{ "className": "string", "name": "string", "dataType": "string" }],
    "relations": [{ "name": "string", "sourceClass": "string", "targetClass": "string" }]
  }
}`

  const userPrompt = `Dataset Source: ${input.sourceName}
Row Count: ${input.profile.rowCount}
Column Count: ${input.profile.columnCount}
Candidate Unique Keys: ${JSON.stringify(input.profile.candidateKeys)}

Columns Profile:
${JSON.stringify(
  input.profile.columns.map((c) => ({
    name: c.name,
    type: c.duckdbType,
    inferredKgType: c.inferredKgType,
    nullCount: c.nullCount,
    distinctCount: c.distinctCount,
    isUnique: c.isUniqueCandidate,
    sampleValues: c.sampleValues.slice(0, 3),
  })),
  null,
  2
)}

Sample Rows (First ${Math.min(5, input.sampleRows.length)}):
${JSON.stringify(input.sampleRows.slice(0, 5), null, 2)}

Active Ontology Classes:
${JSON.stringify(
  input.existingClasses.map((c) => ({
    name: c.name,
    attributes: c.attributes.map((a) => a.name),
  })),
  null,
  2
)}

Active Ontology Relations:
${JSON.stringify(
  input.existingRelations.map((r) => ({
    name: r.name,
    domain: r.domainClassName,
    range: r.rangeClassName,
  })),
  null,
  2
)}

Historical Archived Datasets:
${JSON.stringify(input.historicalArchiveSummary || [], null, 2)}

Generate the mapping specification and synthesized ontology elements now.`

  return { systemPrompt, userPrompt }
}

export function parseAiMappingResponse(raw: string): DatasetMappingSpec {
  const sanitized = sanitizeAiJsonResponse(raw)
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(sanitized)
  } catch (err) {
    throw new Error(
      `Failed to parse AI response as JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const result = DatasetMappingSpecSchema.safeParse(parsedJson)
  if (!result.success) {
    throw new Error(
      `AI mapping response did not conform to schema: ${result.error.message}`
    )
  }

  return result.data as DatasetMappingSpec
}
