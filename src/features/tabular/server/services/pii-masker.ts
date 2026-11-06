export type PiiCategory =
  | "email"
  | "phone"
  | "ip_address"
  | "credit_card"
  | "ssn"
  | "iban"
  | "secret"
  | "name"
  | "custom"

export interface ColumnPrivacyConfig {
  columnName: string
  isMasked: boolean
  detectedCategory?: PiiCategory
  maskingStrategy: "token" | "redact" | "none"
}

export interface MaskingResult {
  sanitizedSampleRows: Record<string, unknown>[]
  sanitizedSampleValues: Record<string, Array<string | number | boolean>>
  tokenMap: Record<string, string>
  maskedColumnCount: number
}

// Regex patterns for value detection
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}$/
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const IPV6_REGEX =
  /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?$/
const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/
const AWS_KEY_REGEX = /^AKIA[0-9A-Z]{16}$/
const JWT_PREFIX_REGEX = /^eyJh[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/

// Column name heuristics
const EMAIL_HEADER_REGEX = /\b(email|e[-_]?mail|mail_address)\b/i
const PHONE_HEADER_REGEX = /\b(phone|mobile|telephone|tel_number|cell_phone|fax)\b/i
const IP_HEADER_REGEX = /\b(ip_address|ip_addr|client_ip|remote_ip|remote_address)\b/i
const SSN_HEADER_REGEX = /\b(ssn|social_security|tax_id|ein|itin|tax_identifier)\b/i
const SECRET_HEADER_REGEX =
  /\b(password|passwd|secret|api_?key|auth_token|access_token|private_key|token)\b/i
const NAME_HEADER_REGEX =
  /\b(first_name|last_name|full_name|customer_name|patient_name|user_name|author_name|contact_name|client_name)\b|^name$/i
const NON_PHONE_ID_REGEX = /(?:^|_)id$|(?:^|_)code$|sku|ref|order|invoice|quantity|amount|count/i

/**
 * Validates a credit card number using the Luhn algorithm (MOD-10).
 */
export function isValidLuhn(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "")
  if (!/^\d{13,19}$/.test(digits)) return false

  let sum = 0
  let alternate = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)
    if (alternate) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    alternate = !alternate
  }
  return sum % 10 === 0
}

/**
 * Validates an International Bank Account Number (IBAN) using ISO 7064 MOD-97-10.
 */
export function isValidIban(value: string): boolean {
  const cleaned = value.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned)) return false

  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  let numeric = ""
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0)
    if (code >= 65 && code <= 90) {
      numeric += (code - 55).toString()
    } else {
      numeric += ch
    }
  }

  try {
    return BigInt(numeric) % BigInt(97) === BigInt(1)
  } catch {
    return false
  }
}

/**
 * Tests if a string looks like a phone number without matching ordinary dash-separated IDs.
 */
function isPhoneNumber(val: string, columnName: string): boolean {
  const trimmed = val.trim()
  if (PHONE_HEADER_REGEX.test(columnName)) {
    return /^\+?[\d\s().-]{7,25}$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 7
  }
  if (NON_PHONE_ID_REGEX.test(columnName)) {
    return false
  }
  // International format with leading +
  if (/^\+\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}$/.test(trimmed)) {
    return true
  }
  // Standard formatted with area code parentheses: (555) 234-5678
  if (/^\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}$/.test(trimmed)) {
    return true
  }
  // Minimum 10 digits with phone formatting
  const digitsOnly = trimmed.replace(/\D/g, "")
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15 && /^[\d\s().+-]{10,25}$/.test(trimmed)) {
    return true
  }
  return false
}

/**
 * Detects whether sample values or column names correspond to known PII categories.
 */
function detectColumnCategory(
  columnName: string,
  sampleValues: unknown[]
): PiiCategory | undefined {
  const stringValues = sampleValues
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())

  // 1. Credit Card (with Luhn check)
  for (const val of stringValues) {
    if (isValidLuhn(val)) return "credit_card"
  }

  // 2. Secret / Credentials
  if (SECRET_HEADER_REGEX.test(columnName)) return "secret"
  for (const val of stringValues) {
    if (AWS_KEY_REGEX.test(val) || JWT_PREFIX_REGEX.test(val) || val.startsWith("eyJh")) {
      return "secret"
    }
  }

  // 3. Email
  if (EMAIL_HEADER_REGEX.test(columnName)) return "email"
  for (const val of stringValues) {
    if (EMAIL_REGEX.test(val)) return "email"
  }

  // 4. IBAN (with MOD-97 check)
  for (const val of stringValues) {
    if (isValidIban(val)) return "iban"
  }

  // 5. SSN / Tax Identifier
  if (SSN_HEADER_REGEX.test(columnName)) return "ssn"
  for (const val of stringValues) {
    if (SSN_REGEX.test(val)) return "ssn"
  }

  // 6. IP Address
  if (IP_HEADER_REGEX.test(columnName)) return "ip_address"
  for (const val of stringValues) {
    if (IPV4_REGEX.test(val) || IPV6_REGEX.test(val)) return "ip_address"
  }

  // 7. Phone Number
  for (const val of stringValues) {
    if (isPhoneNumber(val, columnName)) return "phone"
  }
  if (PHONE_HEADER_REGEX.test(columnName)) return "phone"

  // 8. Name heuristics
  if (NAME_HEADER_REGEX.test(columnName)) return "name"

  return undefined
}

/**
 * Auto-detects sensitive and PII columns across tabular schema and sample rows.
 */
export function autoDetectPii(
  columns: Array<{ name: string; sampleValues?: unknown[] }>,
  sampleRows: Record<string, unknown>[]
): ColumnPrivacyConfig[] {
  return columns.map((col) => {
    // Collect sample values from both column definition and preview sample rows
    const rowValues = sampleRows.map((r) => r[col.name]).filter((v) => v !== undefined)
    const combinedSamples = [...(col.sampleValues ?? []), ...rowValues]

    const detected = detectColumnCategory(col.name, combinedSamples)
    if (detected) {
      return {
        columnName: col.name,
        isMasked: true,
        detectedCategory: detected,
        maskingStrategy: "token",
      }
    }

    return {
      columnName: col.name,
      isMasked: false,
      maskingStrategy: "none",
    }
  })
}

/**
 * Deterministically masks dataset sample rows and sample values according to column privacy configurations.
 * Preserves value cardinality (identical raw values receive identical tokens).
 */
export function maskDatasetSamples(
  sampleRows: Record<string, unknown>[],
  configs: ColumnPrivacyConfig[],
  sampleValues?: Record<string, unknown[]>
): MaskingResult {
  const configMap = new Map<string, ColumnPrivacyConfig>()
  for (const cfg of configs) {
    configMap.set(cfg.columnName, cfg)
  }

  const valueToToken = new Map<string, string>()
  const tokenMap: Record<string, string> = {}
  const categoryCounters: Record<string, number> = {}

  function getOrCreateToken(rawVal: unknown, config: ColumnPrivacyConfig): string {
    const strVal = String(rawVal)
    const cacheKey = `${config.columnName}:${strVal}`
    const existing = valueToToken.get(cacheKey)
    if (existing) {
      return existing
    }

    const prefix = (
      config.detectedCategory ||
      config.columnName.replace(/[^a-zA-Z0-9]/g, "_") ||
      "TOKEN"
    ).toUpperCase()

    const count = (categoryCounters[prefix] || 0) + 1
    categoryCounters[prefix] = count

    const token = `<${prefix}_${count}>`
    valueToToken.set(cacheKey, token)
    tokenMap[token] = strVal
    return token
  }

  // Sanitize sample rows
  const sanitizedSampleRows = sampleRows.map((row) => {
    const newRow: Record<string, unknown> = {}
    for (const [colName, val] of Object.entries(row)) {
      const config = configMap.get(colName)
      if (!config || !config.isMasked || config.maskingStrategy === "none") {
        newRow[colName] = val
        continue
      }
      if (val === null || val === undefined) {
        newRow[colName] = val
        continue
      }
      if (config.maskingStrategy === "redact") {
        newRow[colName] = "[REDACTED]"
      } else {
        newRow[colName] = getOrCreateToken(val, config)
      }
    }
    return newRow
  })

  // Sanitize sample values
  const sanitizedSampleValues: Record<string, Array<string | number | boolean>> = {}

  if (sampleValues) {
    for (const [colName, vals] of Object.entries(sampleValues)) {
      const config = configMap.get(colName)
      const sanitizedList: Array<string | number | boolean> = []

      for (const val of vals) {
        if (val === null || val === undefined) continue
        if (!config || !config.isMasked || config.maskingStrategy === "none") {
          sanitizedList.push(val as string | number | boolean)
        } else if (config.maskingStrategy === "redact") {
          sanitizedList.push("[REDACTED]")
        } else {
          sanitizedList.push(getOrCreateToken(val, config))
        }
      }
      sanitizedSampleValues[colName] = sanitizedList
    }
  } else {
    // Derive sanitized sample values from sanitized rows
    const colNames = Array.from(
      new Set(sanitizedSampleRows.flatMap((r) => Object.keys(r)))
    )
    for (const col of colNames) {
      const distinct = Array.from(
        new Set(
          sanitizedSampleRows
            .map((r) => r[col])
            .filter((v): v is string | number | boolean => v !== null && v !== undefined)
        )
      )
      sanitizedSampleValues[col] = distinct
    }
  }

  const maskedColumnCount = configs.filter(
    (c) => c.isMasked && c.maskingStrategy !== "none"
  ).length

  return {
    sanitizedSampleRows,
    sanitizedSampleValues,
    tokenMap,
    maskedColumnCount,
  }
}

/**
 * Cleans token artifacts and redaction markers from synthesized element descriptions.
 */
function cleanDescription(text: string): string {
  let cleaned = text.replace(/<[A-Z0-9_]+_\d+>/g, "")
  cleaned = cleaned.replace(/\[REDACTED\]/gi, "")
  cleaned = cleaned.replace(/\s+/g, " ")
  cleaned = cleaned.replace(/\s+([.,;?!])/g, "$1")
  return cleaned.trim()
}

export interface SynthesizedElementsHolder {
  classes?: Array<{ name?: string; description?: string; [key: string]: unknown }>
  attributes?: Array<{ name?: string; description?: string; [key: string]: unknown }>
  relations?: Array<{ name?: string; description?: string; [key: string]: unknown }>
  [key: string]: unknown
}

/**
 * Sanitizes synthesized elements produced by Gemini to ensure no placeholder tokens or leaked raw PII persist.
 */
export function sanitizeSynthesizedElements<
  T extends { synthesizedElements?: SynthesizedElementsHolder }
>(spec: T): T {
  if (!spec || typeof spec !== "object" || !spec.synthesizedElements) {
    return spec
  }

  const sanitized = {
    ...spec,
    synthesizedElements: {
      ...spec.synthesizedElements,
    },
  }

  if (Array.isArray(sanitized.synthesizedElements.classes)) {
    sanitized.synthesizedElements.classes = sanitized.synthesizedElements.classes.map(
      (c: Record<string, unknown>) => {
        if (typeof c.description === "string") {
          return {
            ...c,
            description: cleanDescription(c.description),
          }
        }
        return c
      }
    )
  }

  if (Array.isArray(sanitized.synthesizedElements.attributes)) {
    sanitized.synthesizedElements.attributes = sanitized.synthesizedElements.attributes.map(
      (a: Record<string, unknown>) => {
        if (typeof a.description === "string") {
          return {
            ...a,
            description: cleanDescription(a.description),
          }
        }
        return a
      }
    )
  }

  if (Array.isArray(sanitized.synthesizedElements.relations)) {
    sanitized.synthesizedElements.relations = sanitized.synthesizedElements.relations.map(
      (r: Record<string, unknown>) => {
        if (typeof r.description === "string") {
          return {
            ...r,
            description: cleanDescription(r.description),
          }
        }
        return r
      }
    )
  }

  return sanitized
}
