import { getDb } from "@/server/database"
import { referenceOntologies } from "@/server/db/schema"
import { searchAllRegistries } from "./aggregator"

export interface DiscoveredVocabularyItem {
  prefix: string
  name: string
  baseIri: string
  sourceRegistry: string
  sourceId: string
  description: string
  status: "already_imported" | "needs_import"
  matchedKeywords: string[]
  relevanceScore?: number
}

const STOPWORDS = new Set([
  "which",
  "what",
  "how",
  "many",
  "does",
  "where",
  "when",
  "who",
  "why",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "to",
  "in",
  "of",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "be",
  "have",
  "has",
  "had",
  "do",
  "it",
  "this",
  "that",
  "these",
  "those",
  "or",
  "and",
  "not",
  "each",
  "all",
  "can",
  "could",
  "should",
  "would",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "each",
  "there",
  "their",
  "them",
])

export function extractDomainKeywords(
  usecase: string,
  cqs: Array<{ question: string }>
): string[] {
  const corpus = [usecase, ...cqs.map((c) => c.question)].join(" ")
  const words = corpus.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? []

  const freqMap = new Map<string, number>()
  for (const word of words) {
    if (!STOPWORDS.has(word)) {
      freqMap.set(word, (freqMap.get(word) ?? 0) + 1)
    }
  }

  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
}

export async function discoverCandidateRegistries(
  ontologyId: string,
  usecase: string,
  cqs: Array<{ question: string }>,
  options?: { limit?: number; timeoutMs?: number }
): Promise<{
  activeVocabularies: DiscoveredVocabularyItem[]
  recommendedVocabularies: DiscoveredVocabularyItem[]
}> {
  const keywords = extractDomainKeywords(usecase, cqs)
  const topKeywords = keywords.slice(0, 4)

  const activeMap = new Map<
    string,
    {
      prefix: string
      name: string
      base_iri: string
      source_registry: string
      source_id: string
    }
  >()

  try {
    const db = getDb()
    const active = await db.select().from(referenceOntologies)
    for (const r of active) {
      activeMap.set(r.prefix.toLowerCase(), r)
    }
  } catch (err) {
    console.warn("[domain-discovery] Failed to read referenceOntologies:", err)
  }

  const activeVocabularies: DiscoveredVocabularyItem[] = []
  const recommendedMap = new Map<string, DiscoveredVocabularyItem>()

  // 1. Identify which active vocabularies match domain keywords
  for (const [prefixLower, activeItem] of activeMap.entries()) {
    const matched: string[] = []
    const hay = `${prefixLower} ${activeItem.name}`.toLowerCase()
    for (const kw of keywords) {
      if (hay.includes(kw)) {
        matched.push(kw)
      }
    }
    activeVocabularies.push({
      prefix: activeItem.prefix,
      name: activeItem.name,
      baseIri: activeItem.base_iri,
      sourceRegistry: activeItem.source_registry,
      sourceId: activeItem.source_id,
      description: `Active local reference ontology (${activeItem.prefix.toUpperCase()})`,
      status: "already_imported",
      matchedKeywords: matched,
    })
  }

  // 2. Query external registries for top keywords
  for (const kw of topKeywords) {
    try {
      const response = await searchAllRegistries(kw, {
        timeoutMs: options?.timeoutMs ?? 3500,
        limitPerProvider: 3,
      })

      for (const res of response.results) {
        const key = res.prefix.toLowerCase()
        if (activeMap.has(key)) {
          // Already in active
          continue
        }

        const existing = recommendedMap.get(key)
        if (existing) {
          if (!existing.matchedKeywords.includes(kw)) {
            existing.matchedKeywords.push(kw)
          }
        } else {
          recommendedMap.set(key, {
            prefix: res.prefix,
            name: res.name || res.prefix.toUpperCase(),
            baseIri: res.baseIri || "",
            sourceRegistry: res.source,
            sourceId: res.sourceId || res.prefix,
            description:
              res.description || `Discovered standard ontology for ${kw}`,
            status: "needs_import",
            matchedKeywords: [kw],
          })
        }
      }
    } catch (err) {
      console.warn(
        `[domain-discovery] Registry search failed for "${kw}":`,
        err
      )
    }
  }

  const recommendedVocabularies = Array.from(recommendedMap.values())
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length)
    .slice(0, options?.limit ?? 10)

  return {
    activeVocabularies,
    recommendedVocabularies,
  }
}
