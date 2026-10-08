export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA <= 0 || normB <= 0) {
    return 0
  }

  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  return Math.max(0, Math.min(1, sim))
}

export type CandidateTerm<T = Record<string, unknown>> = T & {
  curie: string
  embedding: number[] | null
}

export type RankedTerm<T = Record<string, unknown>> = T & {
  curie: string
  similarity: number
}

export function rankTermsBySimilarity<T extends { curie: string; embedding: number[] | null }>(
  queryVector: number[],
  terms: T[],
  options?: { minSimilarity?: number; topK?: number }
): Array<T & { similarity: number }> {
  const minScore = options?.minSimilarity ?? 0.0
  const topK = options?.topK ?? 10

  const scored: Array<T & { similarity: number }> = []

  for (const term of terms) {
    if (!term.embedding || term.embedding.length === 0) continue
    const sim = cosineSimilarity(queryVector, term.embedding)
    if (sim >= minScore) {
      scored.push({
        ...term,
        similarity: Math.round(sim * 1000) / 1000,
      })
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, topK)
}
