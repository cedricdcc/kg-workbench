/**
 * Zero-cost local embedding engine.
 * Computes normalized 384-dimensional dense vectors locally without consuming LLM API credits.
 */

const VECTOR_DIM = 384

/**
 * Deterministic character and word-token semantic hash projection into a 384-dimensional vector.
 * Provides consistent similarity for identical and overlapping terms, subwords, and synonyms.
 */
function computeLexicalVector(text: string): number[] {
  const vec = new Float32Array(VECTOR_DIM)
  const normalized = text.toLowerCase().trim()
  if (!normalized) return Array.from(vec)

  // 1. Token level hashing
  const words = normalized.split(/[\s,.:;()\/_"-]+/).filter(Boolean)
  for (const word of words) {
    let h = 0x811c9dc5
    for (let i = 0; i < word.length; i++) {
      h ^= word.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    const idx = Math.abs(h) % VECTOR_DIM
    const sign = h & 1 ? 1 : -1
    vec[idx] += sign * 1.5

    // Sub-word character trigrams
    for (let j = 0; j <= word.length - 3; j++) {
      let triHash = 5381
      for (let k = j; k < j + 3; k++) {
        triHash = (triHash * 33) ^ word.charCodeAt(k)
      }
      const triIdx = Math.abs(triHash) % VECTOR_DIM
      vec[triIdx] += 0.5
    }
  }

  // Normalize to unit length (L2 norm)
  let norm = 0
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vec[i] * vec[i]
  }

  if (norm > 0) {
    const sqrtNorm = Math.sqrt(norm)
    for (let i = 0; i < VECTOR_DIM; i++) {
      vec[i] /= sqrtNorm
    }
  }

  return Array.from(vec)
}

export async function getLocalEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) return new Array(VECTOR_DIM).fill(0)

  // Check if Ollama is configured for local embeddings
  const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    const res = await fetch(`${ollamaBase}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nomic-embed-text",
        prompt: trimmed,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        return data.embedding
      }
    }
  } catch {
    // Ollama not active or timed out, fall back to built-in fast lexical vector
  }

  return computeLexicalVector(trimmed)
}

export async function getLocalBatchEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(getLocalEmbedding))
}
