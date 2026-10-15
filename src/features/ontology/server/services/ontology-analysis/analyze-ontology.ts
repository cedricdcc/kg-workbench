export interface OntologyClassForAnalysis {
  id: string
  name: string
  description?: string | null
  parent_class_id?: string | null
}

export interface ReferenceTermForAnalysis {
  curie: string
  label: string
  type: string
  description?: string | null
  prefix?: string
  iri?: string
}

export interface AnalysisInput {
  classes: OntologyClassForAnalysis[]
  installedTerms?: ReferenceTermForAnalysis[]
}

export interface RedundancyCluster {
  clusterName: string
  classIds: string[]
  classNames: string[]
  similarityScore: number
}

export interface RecommendedVocabulary {
  prefix: string
  name: string
  coveredClassCount: number
  coveredClassNames: string[]
  suggestedSource: "ols" | "lov"
  baseIri: string
}

export interface ClassAlignment {
  classId: string
  className: string
  candidateCurie: string
  candidateLabel: string
  similarity: number
  candidateIri?: string
}

export interface OntologyAnalysisResult {
  healthScore: number
  unalignedClassCount: number
  totalClasses: number
  redundancyClusters: RedundancyCluster[]
  recommendedVocabularies: RecommendedVocabulary[]
  classAlignments: ClassAlignment[]
}

const KNOWN_STANDARD_VOCABULARIES: Array<{
  prefix: string
  name: string
  source: "ols" | "lov"
  baseIri: string
  targetTerms: string[]
}> = [
  {
    prefix: "sosa",
    name: "Sensor, Observation, Sample, and Actuator (SOSA)",
    source: "ols",
    baseIri: "http://www.w3.org/ns/sosa/",
    targetTerms: [
      "sensor",
      "platform",
      "observation",
      "observableproperty",
      "actuator",
      "sample",
      "procedure",
    ],
  },
  {
    prefix: "schema",
    name: "Schema.org Core",
    source: "lov",
    baseIri: "https://schema.org/",
    targetTerms: [
      "person",
      "organization",
      "place",
      "event",
      "product",
      "creativework",
      "action",
      "postaladdress",
    ],
  },
  {
    prefix: "qudt",
    name: "Quantity, Unit, Dimension and Type (QUDT)",
    source: "ols",
    baseIri: "http://qudt.org/schema/qudt/",
    targetTerms: [
      "quantity",
      "unit",
      "measurement",
      "quantitykind",
      "scale",
      "dimension",
    ],
  },
  {
    prefix: "geo",
    name: "OGC GeoSPARQL",
    source: "lov",
    baseIri: "http://www.opengis.net/ont/geosparql#",
    targetTerms: ["geometry", "feature", "spatialobject", "point", "polygon"],
  },
  {
    prefix: "prov",
    name: "W3C PROV Ontology",
    source: "ols",
    baseIri: "http://www.w3.org/ns/prov#",
    targetTerms: ["agent", "activity", "entity", "plan", "softwareagent"],
  },
]

function tokenize(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function tokenMatchScore(t1: string, t2: string): number {
  if (t1 === t2) return 1.0
  if (t1.startsWith(t2) || t2.startsWith(t1)) {
    const minL = Math.min(t1.length, t2.length)
    if (minL >= 3) return 0.8
  }
  return 0
}

function computeStringSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9]/g, "")
  const normB = b.toLowerCase().replace(/[^a-z0-9]/g, "")

  if (normA === normB) return 1.0

  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length)
    const maxLen = Math.max(normA.length, normB.length)
    return minLen / maxLen
  }

  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  let totalMatch = 0
  for (const tA of tokensA) {
    let best = 0
    for (const tB of tokensB) {
      const score = tokenMatchScore(tA, tB)
      if (score > best) best = score
    }
    totalMatch += best
  }

  const maxTokens = Math.max(tokensA.length, tokensB.length)
  return totalMatch / maxTokens
}

export async function calculateOntologyAnalysis(
  input: AnalysisInput
): Promise<OntologyAnalysisResult> {
  const { classes, installedTerms = [] } = input
  const totalClasses = classes.length

  if (totalClasses === 0) {
    return {
      healthScore: 100,
      unalignedClassCount: 0,
      totalClasses: 0,
      redundancyClusters: [],
      recommendedVocabularies: [],
      classAlignments: [],
    }
  }

  // 1. Detect Redundancy Clusters
  const redundancyClusters: RedundancyCluster[] = []
  const clusteredIds = new Set<string>()

  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const classA = classes[i]
      const classB = classes[j]

      const sim = computeStringSimilarity(classA.name, classB.name)
      if (sim >= 0.55) {
        clusteredIds.add(classA.id)
        clusteredIds.add(classB.id)
        redundancyClusters.push({
          clusterName: `${classA.name} / ${classB.name}`,
          classIds: [classA.id, classB.id],
          classNames: [classA.name, classB.name],
          similarityScore: Math.round(sim * 100) / 100,
        })
      }
    }
  }

  // 2. Class Alignments with Installed Terms
  const classAlignments: ClassAlignment[] = []
  const alignedClassIds = new Set<string>()

  for (const cls of classes) {
    let bestMatch: { term: ReferenceTermForAnalysis; score: number } | null =
      null

    for (const term of installedTerms) {
      if (term.type !== "class") continue
      const sim = computeStringSimilarity(cls.name, term.label)
      if (sim >= 0.7 && (!bestMatch || sim > bestMatch.score)) {
        bestMatch = { term, score: sim }
      }
    }

    if (bestMatch) {
      alignedClassIds.add(cls.id)
      classAlignments.push({
        classId: cls.id,
        className: cls.name,
        candidateCurie: bestMatch.term.curie,
        candidateLabel: bestMatch.term.label,
        similarity: Math.round(bestMatch.score * 100) / 100,
        candidateIri: bestMatch.term.iri,
      })
    }
  }

  const unalignedClassCount = totalClasses - alignedClassIds.size

  // 3. Recommended Vocabularies
  const installedPrefixes = new Set(
    installedTerms
      .map((t) => t.curie.split(":")[0]?.toLowerCase())
      .filter(Boolean)
  )

  const recommendedVocabularies: RecommendedVocabulary[] = []

  for (const std of KNOWN_STANDARD_VOCABULARIES) {
    if (installedPrefixes.has(std.prefix.toLowerCase())) continue

    const coveredNames: string[] = []
    for (const cls of classes) {
      const tokens = tokenize(cls.name)
      const matches = std.targetTerms.some(
        (target) =>
          tokens.includes(target) || cls.name.toLowerCase().includes(target)
      )
      if (matches) {
        coveredNames.push(cls.name)
      }
    }

    if (coveredNames.length > 0) {
      recommendedVocabularies.push({
        prefix: std.prefix,
        name: std.name,
        coveredClassCount: coveredNames.length,
        coveredClassNames: coveredNames,
        suggestedSource: std.source,
        baseIri: std.baseIri,
      })
    }
  }

  recommendedVocabularies.sort(
    (a, b) => b.coveredClassCount - a.coveredClassCount
  )

  // 4. Calculate Health Score
  let deductions = 0
  deductions += Math.min(redundancyClusters.length * 15, 40)
  const unalignedRatio =
    totalClasses > 0 ? unalignedClassCount / totalClasses : 0
  deductions += Math.round(unalignedRatio * 35)

  const healthScore = Math.max(0, Math.min(100, 100 - deductions))

  return {
    healthScore,
    unalignedClassCount,
    totalClasses,
    redundancyClusters,
    recommendedVocabularies,
    classAlignments,
  }
}
