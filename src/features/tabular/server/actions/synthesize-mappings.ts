"use server"

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm"
import { getEffectiveApiKey } from "@/server/api-keys"
import { getDb } from "@/server/database"
import {
  datasetSources,
  ontologyAttributes,
  ontologyClasses,
  ontologyRelations,
} from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import {
  buildAiMappingPrompt,
  DatasetMappingSpecSchema,
} from "@/features/tabular/server/services/ai-mapping-prompt"
import { getLlmClient } from "@/server/llm"
import {
  autoDetectPii,
  maskDatasetSamples,
  sanitizeSynthesizedElements,
  type ColumnPrivacyConfig,
} from "@/features/tabular/server/services/pii-masker"
import type {
  DatasetMappingSpec,
  TabularColumnProfile,
} from "@/features/tabular/types"

export interface SynthesizeMappingsInput {
  ontologyId: string
  sourceName: string
  profile: {
    rowCount: number
    columnCount: number
    candidateKeys: string[][]
    columns: TabularColumnProfile[]
  }
  sampleRows: Record<string, unknown>[]
  privacyConfigs?: ColumnPrivacyConfig[]
}

export type SynthesizeMappingsResponse =
  | {
      success: true
      mappingSpec: DatasetMappingSpec
      privacySummary: {
        maskedColumnCount: number
      }
    }
  | {
      success: false
      error: string
    }

export async function synthesizeOntologyMappingsAction(
  input: SynthesizeMappingsInput
): Promise<SynthesizeMappingsResponse> {
  if (!input.ontologyId || !input.ontologyId.trim()) {
    return { success: false, error: "ontologyId is required." }
  }

  const apiKey = await getEffectiveApiKey("gemini")
  if (!apiKey) {
    return {
      success: false,
      error:
        "Gemini API key is not configured. Please add your Gemini API key in Settings > API Keys to use AI schema synthesis.",
    }
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = getDb()

  // 1. Fetch active ontology classes and their attributes
  const classesList = await db
    .select()
    .from(ontologyClasses)
    .where(eq(ontologyClasses.ontology_id, input.ontologyId))

  const classIds = classesList.map((c) => c.id)
  const attributesList =
    classIds.length > 0
      ? await db
          .select()
          .from(ontologyAttributes)
          .where(inArray(ontologyAttributes.class_id, classIds))
      : []

  const existingClasses = classesList.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    attributes: attributesList
      .filter((a) => a.class_id === c.id)
      .map((a) => ({ name: a.name, dataType: a.data_type })),
  }))

  // 2. Fetch active relations
  const relationsList = await db
    .select()
    .from(ontologyRelations)
    .where(eq(ontologyRelations.ontology_id, input.ontologyId))

  const existingRelations = relationsList.map((r) => {
    const domainClass = classesList.find((c) => c.id === r.domain_class_id)
    const rangeClass = classesList.find((c) => c.id === r.range_class_id)
    return {
      id: r.id,
      name: r.name,
      domainClassName: domainClass?.name,
      rangeClassName: rangeClass?.name,
    }
  })

  // 3. Fetch up to 5 historical mapped dataset archives for consistency
  const historicalSources = await db
    .select()
    .from(datasetSources)
    .where(
      and(
        eq(datasetSources.ontology_id, input.ontologyId),
        eq(datasetSources.group_key, groupKey),
        isNotNull(datasetSources.mapping_spec)
      )
    )
    .orderBy(desc(datasetSources.created_at))
    .limit(5)

  const historicalArchiveSummary = historicalSources.map((h) => {
    const spec = h.mapping_spec as DatasetMappingSpec | null
    return {
      sourceName: h.source_name,
      mappedClassName: spec?.targetClassName || "Unknown",
    }
  })

  // 4. Resolve privacy configs and mask dataset sample rows / column sample values
  const privacyConfigs =
    input.privacyConfigs ??
    autoDetectPii(input.profile.columns, input.sampleRows)

  const sampleValuesByColumn: Record<string, unknown[]> = {}
  for (const col of input.profile.columns) {
    sampleValuesByColumn[col.name] = col.sampleValues ?? []
  }

  const maskingResult = maskDatasetSamples(
    input.sampleRows,
    privacyConfigs,
    sampleValuesByColumn
  )

  const sanitizedColumns = input.profile.columns.map((c) => ({
    ...c,
    sampleValues: (maskingResult.sanitizedSampleValues[c.name] ??
      c.sampleValues) as Array<string | number | boolean>,
  }))

  // 5. Build prompt
  const prompt = buildAiMappingPrompt({
    sourceName: input.sourceName,
    profile: {
      ...input.profile,
      columns: sanitizedColumns,
    },
    sampleRows: maskingResult.sanitizedSampleRows,
    existingClasses,
    existingRelations,
    historicalArchiveSummary,
  })

  // 6. Synthesize mappings using unified LLM client with candidate fallback
  try {
    const result = await getLlmClient().generateStructured<DatasetMappingSpec>(
      {
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
      },
      {
        schema: DatasetMappingSpecSchema,
        schemaName: "DatasetMappingSpec",
        provider: "gemini",
        apiKey: apiKey || undefined,
        temperature: 0.2,
        timeoutMs: 90000,
      }
    )

    const mappingSpec = sanitizeSynthesizedElements(result.data)
    return {
      success: true,
      mappingSpec,
      privacySummary: {
        maskedColumnCount: maskingResult.maskedColumnCount,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to synthesize mappings: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
