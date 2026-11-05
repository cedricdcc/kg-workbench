import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildAiMappingPrompt,
  parseAiMappingResponse,
} from "../src/features/tabular/server/services/ai-mapping-prompt"

test("buildAiMappingPrompt constructs structured prompt with profile, ontology, and archive context", () => {
  const prompt = buildAiMappingPrompt({
    sourceName: "customers.csv",
    profile: {
      rowCount: 100,
      columnCount: 3,
      candidateKeys: [["customer_id"]],
      columns: [
        {
          name: "customer_id",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 100,
          isUniqueCandidate: true,
          sampleValues: ["C01"],
        },
        {
          name: "email",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 100,
          isUniqueCandidate: true,
          sampleValues: ["a@b.com"],
        },
        {
          name: "spend",
          duckdbType: "DOUBLE",
          inferredKgType: "number",
          nullCount: 5,
          nullPercentage: 5,
          distinctCount: 40,
          isUniqueCandidate: false,
          sampleValues: [120.5],
        },
      ],
    },
    sampleRows: [{ customer_id: "C01", email: "a@b.com", spend: 120.5 }],
    existingClasses: [
      {
        id: "c1",
        name: "User",
        attributes: [{ name: "emailAddress", dataType: "xsd:string" }],
      },
    ],
    existingRelations: [],
    historicalArchiveSummary: [
      { sourceName: "orders.csv", mappedClassName: "Order" },
    ],
  })

  assert.ok(prompt.systemPrompt.includes("Knowledge Graph"))
  assert.ok(prompt.userPrompt.includes("customers.csv"))
  assert.ok(prompt.userPrompt.includes("customer_id"))
})

test("parseAiMappingResponse extracts valid mapping spec and handles fences", () => {
  const raw =
    '```json\n{"targetClassName":"Customer","primaryKeyColumn":"customer_id","columnMappings":[{"columnName":"customer_id","inferredType":"string","targetKind":"attribute","targetAttributeName":"customerId","targetDataType":"xsd:string","isPrimaryKey":true}],"synthesizedElements":{"classes":[{"name":"Customer"}],"attributes":[],"relations":[]}}\n```'
  const parsed = parseAiMappingResponse(raw)
  assert.equal(parsed.targetClassName, "Customer")
  assert.equal(parsed.primaryKeyColumn, "customer_id")
  assert.equal(parsed.columnMappings.length, 1)
})
