import assert from "node:assert/strict"
import { test } from "node:test"
import {
  autoDetectPii,
  maskDatasetSamples,
  sanitizeSynthesizedElements,
  type ColumnPrivacyConfig,
} from "../src/features/tabular/server/services/pii-masker"

test("autoDetectPii detects email columns from sample values and column names including long TLDs", () => {
  const configs = autoDetectPii(
    [{ name: "user_contact", sampleValues: ["test.user@example.technology", "admin@company.international"] }],
    [{ user_contact: "test.user@example.technology" }]
  )
  assert.equal(configs.length, 1)
  assert.equal(configs[0].columnName, "user_contact")
  assert.equal(configs[0].isMasked, true)
  assert.equal(configs[0].detectedCategory, "email")
  assert.equal(configs[0].maskingStrategy, "token")
})

test("autoDetectPii detects phone numbers with international and formatted formats", () => {
  const configs = autoDetectPii(
    [{ name: "phone_num", sampleValues: ["+1 (555) 234-5678", "+49 30 1234567"] }],
    [{ phone_num: "+1 (555) 234-5678" }]
  )
  assert.equal(configs[0].isMasked, true)
  assert.equal(configs[0].detectedCategory, "phone")
})

test("autoDetectPii detects IPv4 and IPv6 addresses", () => {
  const configsIpv4 = autoDetectPii(
    [{ name: "client_ip", sampleValues: ["192.168.1.105", "10.0.0.1"] }],
    []
  )
  assert.equal(configsIpv4[0].isMasked, true)
  assert.equal(configsIpv4[0].detectedCategory, "ip_address")

  const configsIpv6 = autoDetectPii(
    [{ name: "remote_address", sampleValues: ["2001:0db8:85a3:0000:0000:8a2e:0370:7334"] }],
    []
  )
  assert.equal(configsIpv6[0].isMasked, true)
  assert.equal(configsIpv6[0].detectedCategory, "ip_address")
})

test("autoDetectPii detects credit cards passing Luhn check, rejects invalid cards", () => {
  // 4532015112842460 is a valid test Visa number passing Luhn
  const validConfigs = autoDetectPii(
    [{ name: "card_token", sampleValues: ["4532-0151-1284-2460"] }],
    []
  )
  assert.equal(validConfigs[0].isMasked, true)
  assert.equal(validConfigs[0].detectedCategory, "credit_card")

  // 4532015112842461 fails Luhn check
  const invalidConfigs = autoDetectPii(
    [{ name: "some_number", sampleValues: ["4532-0151-1284-2461"] }],
    []
  )
  assert.equal(invalidConfigs[0].isMasked, false)
  assert.equal(invalidConfigs[0].detectedCategory, undefined)
})

test("autoDetectPii detects SSN (Social Security Numbers)", () => {
  const configs = autoDetectPii(
    [{ name: "tax_identifier", sampleValues: ["123-45-6789"] }],
    []
  )
  assert.equal(configs[0].isMasked, true)
  assert.equal(configs[0].detectedCategory, "ssn")
})

test("autoDetectPii detects valid IBANs and rejects invalid IBAN checksums", () => {
  // Valid German test IBAN
  const validIban = autoDetectPii(
    [{ name: "bank_acc", sampleValues: ["DE89 3704 0044 0532 0130 00"] }],
    []
  )
  assert.equal(validIban[0].isMasked, true)
  assert.equal(validIban[0].detectedCategory, "iban")

  // Invalid IBAN (tampered check digits)
  const invalidIban = autoDetectPii(
    [{ name: "account_field", sampleValues: ["DE00 3704 0044 0532 0130 00"] }],
    []
  )
  assert.equal(invalidIban[0].isMasked, false)
})

test("autoDetectPii detects secrets, tokens, passwords and name heuristics", () => {
  const secretConfigs = autoDetectPii(
    [
      { name: "api_key", sampleValues: ["AKIAIOSFODNN7EXAMPLE"] },
      { name: "customer_name", sampleValues: ["Alice Johnson"] },
      { name: "auth_token", sampleValues: ["eyJh..."] },
    ],
    []
  )
  assert.equal(secretConfigs[0].detectedCategory, "secret")
  assert.equal(secretConfigs[0].isMasked, true)
  assert.equal(secretConfigs[1].detectedCategory, "name")
  assert.equal(secretConfigs[1].isMasked, true)
  assert.equal(secretConfigs[2].detectedCategory, "secret")
  assert.equal(secretConfigs[2].isMasked, true)
})

test("autoDetectPii does not flag regular domain identifiers as sensitive", () => {
  const configs = autoDetectPii(
    [
      { name: "order_id", sampleValues: ["123-4567", "987-6543"] },
      { name: "product_category", sampleValues: ["Electronics", "Appliances"] },
      { name: "quantity", sampleValues: [5, 10, 42] },
    ],
    [{ order_id: "123-4567", product_category: "Electronics", quantity: 5 }]
  )
  for (const c of configs) {
    assert.equal(c.isMasked, false, `Column ${c.columnName} should not be masked`)
    assert.equal(c.maskingStrategy, "none")
  }
})

test("maskDatasetSamples tokenizes identical values to identical tokens consistently", () => {
  const sampleRows = [
    { email: "john@example.com", name: "John Doe" },
    { email: "jane@example.com", name: "Jane Smith" },
    { email: "john@example.com", name: "John Doe" },
  ]
  const configs: ColumnPrivacyConfig[] = [
    { columnName: "email", isMasked: true, detectedCategory: "email", maskingStrategy: "token" },
    { columnName: "name", isMasked: true, detectedCategory: "name", maskingStrategy: "token" },
  ]

  const result = maskDatasetSamples(sampleRows, configs, {
    email: ["john@example.com", "jane@example.com", "john@example.com"],
  })

  // Same value produces same token
  assert.equal(result.sanitizedSampleRows[0].email, result.sanitizedSampleRows[2].email)
  assert.match(result.sanitizedSampleRows[0].email as string, /^<EMAIL_\d+>$/)
  assert.notEqual(result.sanitizedSampleRows[0].email, result.sanitizedSampleRows[1].email)

  // sampleValues are also masked
  assert.equal(result.sanitizedSampleValues.email[0], result.sanitizedSampleRows[0].email)
  assert.equal(result.sanitizedSampleValues.email[2], result.sanitizedSampleRows[2].email)

  // tokenMap provides reverse mapping
  const token = result.sanitizedSampleRows[0].email as string
  assert.equal(result.tokenMap[token], "john@example.com")
  assert.equal(result.maskedColumnCount, 2)
})

test("maskDatasetSamples produces identical tokens for identical values across different columns with same category", () => {
  const sampleRows = [
    {
      primary_email: "shared@domain.com",
      backup_email: "shared@domain.com",
    },
  ]
  const configs: ColumnPrivacyConfig[] = [
    { columnName: "primary_email", isMasked: true, detectedCategory: "email", maskingStrategy: "token" },
    { columnName: "backup_email", isMasked: true, detectedCategory: "email", maskingStrategy: "token" },
  ]

  const result = maskDatasetSamples(sampleRows, configs)

  assert.equal(
    result.sanitizedSampleRows[0].primary_email,
    result.sanitizedSampleRows[0].backup_email,
    "Cross-column identical emails should receive identical token"
  )
  assert.equal(result.sanitizedSampleRows[0].primary_email, "<EMAIL_1>")
})

test("maskDatasetSamples respects user overrides: unmasking, force-masking, redact strategy", () => {
  const sampleRows = [
    {
      auto_pii: "john@acme.com",
      safe_column: "Internal Note Alpha",
      redacted_secret: "super-secret-password-123",
    },
  ]

  const configs: ColumnPrivacyConfig[] = [
    // 1. Unmask an auto-detected column
    { columnName: "auto_pii", isMasked: false, detectedCategory: "email", maskingStrategy: "none" },
    // 2. Force-mask a safe column
    { columnName: "safe_column", isMasked: true, maskingStrategy: "token" },
    // 3. Redact strategy
    { columnName: "redacted_secret", isMasked: true, detectedCategory: "secret", maskingStrategy: "redact" },
  ]

  const result = maskDatasetSamples(sampleRows, configs)

  // Unmasked remains raw
  assert.equal(result.sanitizedSampleRows[0].auto_pii, "john@acme.com")

  // Force-masked gets token
  assert.match(result.sanitizedSampleRows[0].safe_column as string, /^<SAFE_COLUMN_\d+>$/)

  // Redacted gets [REDACTED]
  assert.equal(result.sanitizedSampleRows[0].redacted_secret, "[REDACTED]")
  assert.equal(result.maskedColumnCount, 2)
})

test("sanitizeSynthesizedElements removes token artifacts and leaked PII from descriptions", () => {
  const mappingSpec = {
    targetClassName: "CustomerAccount",
    primaryKeyColumn: "id",
    columnMappings: [],
    synthesizedElements: {
      classes: [
        {
          name: "CustomerAccount",
          description: "Represents customer profile with primary contact <EMAIL_1> and phone <PHONE_1>.",
        },
        {
          name: "AuditLog",
          description: "Log record holding [REDACTED] credential activity.",
        },
      ],
      attributes: [
        {
          className: "CustomerAccount",
          name: "contactEmail",
          dataType: "xsd:string",
        },
      ],
    },
  }

  const sanitized = sanitizeSynthesizedElements(mappingSpec)

  assert.equal(
    sanitized.synthesizedElements.classes[0].description,
    "Represents customer profile with primary contact and phone."
  )
  assert.equal(
    sanitized.synthesizedElements.classes[1].description,
    "Log record holding credential activity."
  )
  assert.equal(sanitized.synthesizedElements.classes[0].name, "CustomerAccount")
})
