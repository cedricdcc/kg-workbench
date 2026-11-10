import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateRiskScore,
  buildClassBlastRadiusReport,
  buildRelationBlastRadiusReport,
} from "../src/features/ontology/server/blast-radius/calculate"

test("calculateRiskScore returns 0 and low severity when metrics are zero", () => {
  const result = calculateRiskScore({
    cqsCount: 0,
    factsCount: 0,
    entitiesCount: 0,
    relationsCount: 0,
    subclassesCount: 0,
    attributesCount: 0,
  })
  assert.equal(result.score, 0)
  assert.equal(result.severity, "low")
})

test("calculateRiskScore flags isolated class with single attribute as low", () => {
  const result = calculateRiskScore({
    cqsCount: 0,
    factsCount: 0,
    entitiesCount: 0,
    relationsCount: 0,
    subclassesCount: 0,
    attributesCount: 2,
  })
  assert.equal(result.score, 2)
  assert.equal(result.severity, "low")
})

test("calculateRiskScore flags class with multiple relations as medium", () => {
  const result = calculateRiskScore({
    cqsCount: 0,
    factsCount: 2,
    entitiesCount: 2,
    relationsCount: 3,
    subclassesCount: 0,
    attributesCount: 1,
  })
  // 0 + 4 + 2 + 15 + 0 + 1 = 22
  assert.ok(result.score >= 16 && result.score <= 40)
  assert.equal(result.severity, "medium")
})

test("calculateRiskScore flags class with broken CQs as high or critical", () => {
  const result = calculateRiskScore({
    cqsCount: 2, // 40
    factsCount: 5, // 10
    entitiesCount: 3, // 3
    relationsCount: 2, // 10
    subclassesCount: 1, // 10
    attributesCount: 2, // 2
  })
  // 40 + 10 + 3 + 10 + 10 + 2 = 75 -> critical
  assert.ok(result.score >= 71)
  assert.equal(result.severity, "critical")
})

test("calculateRiskScore caps maximum score at 100", () => {
  const result = calculateRiskScore({
    cqsCount: 10,
    factsCount: 50,
    entitiesCount: 100,
    relationsCount: 20,
    subclassesCount: 10,
    attributesCount: 10,
  })
  assert.equal(result.score, 100)
  assert.equal(result.severity, "critical")
})

test("buildClassBlastRadiusReport aggregates class dependents correctly", () => {
  const targetClass = { id: "c-target", name: "Drug" }
  const subclasses = [{ id: "c-child", name: "Antibiotic" }]
  const relations = [
    {
      id: "r-1",
      name: "treats",
      source_class_id: "c-target",
      target_class_id: "c-other",
      otherClassName: "Disease",
    },
    {
      id: "r-2",
      name: "manufacturedBy",
      source_class_id: "c-corp",
      target_class_id: "c-target",
      otherClassName: "Company",
    },
  ]
  const attributes = [{ id: "a-1", name: "dosage", data_type: "xsd:string" }]
  const cqs = [
    {
      id: "cq-1",
      question: "Which drugs treat infectious diseases?",
      roles: ["subject" as const],
    },
  ]

  const report = buildClassBlastRadiusReport({
    targetClass,
    subclasses,
    relations,
    attributes,
    cqs,
    entitiesCount: 12,
    factsCount: 28,
  })

  assert.equal(report.targetId, "c-target")
  assert.equal(report.targetType, "class")
  assert.equal(report.targetName, "Drug")
  assert.equal(report.summary.affectedCqsCount, 1)
  assert.equal(report.summary.affectedRelationsCount, 2)
  assert.equal(report.summary.affectedSubclassesCount, 1)
  assert.equal(report.summary.affectedAttributesCount, 1)
  assert.equal(report.summary.affectedEntitiesCount, 12)
  assert.equal(report.summary.affectedFactsCount, 28)
  assert.ok(report.riskScore > 0)
  assert.ok(["medium", "high", "critical"].includes(report.severity))
})

test("buildRelationBlastRadiusReport aggregates relation dependents correctly", () => {
  const targetRelation = { id: "r-target", name: "inhibits" }
  const cqs = [
    {
      id: "cq-2",
      question: "What enzymes are inhibited by this compound?",
      roles: ["predicate" as const],
    },
  ]
  const attributes = [
    { id: "ra-1", name: "mechanism", data_type: "xsd:string" },
  ]

  const report = buildRelationBlastRadiusReport({
    targetRelation,
    cqs,
    attributes,
    factsCount: 15,
  })

  assert.equal(report.targetId, "r-target")
  assert.equal(report.targetType, "relation")
  assert.equal(report.targetName, "inhibits")
  assert.equal(report.summary.affectedCqsCount, 1)
  assert.equal(report.summary.affectedFactsCount, 15)
  assert.equal(report.summary.affectedAttributesCount, 1)
})

test("BlastRadiusModal uses DialogContent with viewport='wide'", async () => {
  const fs = await import("node:fs")
  const path = await import("node:path")
  const modalPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/blast-radius-modal/blast-radius-modal.tsx"
  )
  assert.ok(fs.existsSync(modalPath), "blast-radius-modal.tsx must exist")
  const content = fs.readFileSync(modalPath, "utf-8")

  assert.ok(
    content.includes('viewport="wide"'),
    "BlastRadiusModal must use DialogContent with viewport='wide'"
  )
})

test("BlastRadiusDetails renders responsive 3-column impact dashboard", async () => {
  const React = (await import("react")).default
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { BlastRadiusDetails } =
    await import("../src/features/ontology/components/blast-radius-modal/blast-radius-details")

  const markup = renderToStaticMarkup(
    React.createElement(BlastRadiusDetails, {
      targetType: "class",
      details: {
        competencyQuestions: [
          {
            id: "cq-1",
            question: "Which drugs treat diseases?",
            roles: ["subject"],
          },
        ],
        relations: [
          {
            id: "r-1",
            name: "treats",
            direction: "outgoing",
            otherClassName: "Disease",
          },
        ],
        subclasses: [{ id: "sub-1", name: "Antibiotic" }],
        attributes: [{ id: "attr-1", name: "dosage", dataType: "xsd:string" }],
      },
      summary: {
        affectedCqsCount: 1,
        affectedFactsCount: 42,
        affectedEntitiesCount: 10,
        affectedRelationsCount: 1,
        affectedSubclassesCount: 1,
        affectedAttributesCount: 1,
      },
    })
  )

  assert.ok(
    markup.includes("grid-cols-1") && markup.includes("md:grid-cols-3"),
    "Must have responsive 3-column grid classes"
  )
  assert.ok(
    markup.includes('data-card="competency-questions"'),
    "Must render Card 1 for competency questions"
  )
  assert.ok(
    markup.includes("Which drugs treat diseases?"),
    "Must render CQ question in Card 1"
  )
  assert.ok(
    markup.includes('data-card="relations-subclasses"'),
    "Must render Card 2 for relations and subclasses"
  )
  assert.ok(
    markup.includes("treats") && markup.includes("Antibiotic"),
    "Must render relation and orphaned subclass in Card 2"
  )
  assert.ok(
    markup.includes('data-card="attributes-facts"'),
    "Must render Card 3 for attributes and facts"
  )
  assert.ok(
    markup.includes("42") && markup.includes("dosage"),
    "Must render affected facts count and attribute in Card 3"
  )
})
