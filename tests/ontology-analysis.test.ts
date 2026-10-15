import assert from "node:assert/strict"
import { test } from "node:test"
import { calculateOntologyAnalysis } from "../src/features/ontology/server/services/ontology-analysis/analyze-ontology"

test("calculateOntologyAnalysis clusters redundant classes and scores alignment", async () => {
  const classes = [
    { id: "1", name: "TemperatureMeasurement", description: "Measures temp" },
    { id: "2", name: "TempMeasurement", description: "Records temperature" },
    { id: "3", name: "Platform", description: "Vessel or buoy" },
  ]
  const installedTerms = [
    {
      curie: "sosa:Platform",
      label: "Platform",
      type: "class",
      description: "An entity hosting sensors",
    },
  ]

  const report = await calculateOntologyAnalysis({ classes, installedTerms })
  assert.ok(report.healthScore >= 0 && report.healthScore <= 100)
  assert.ok(report.redundancyClusters.length >= 1)
  assert.ok(
    report.classAlignments.some((a) => a.candidateCurie === "sosa:Platform")
  )
})
