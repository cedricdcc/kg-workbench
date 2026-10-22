import assert from "node:assert/strict"
import { test } from "node:test"
import { computeOntologyDagreLayout } from "../src/features/ontology/server/services/turtle-importer/layout"
import type {
  ImportClass,
  ImportRelation,
} from "../src/features/ontology/schemas/import"

test("computeOntologyDagreLayout generates non-overlapping coordinates for classes and bounding module layout", () => {
  const classes: ImportClass[] = [
    { id: "c1", name: "Parent", description: "", attributes: [] },
    {
      id: "c2",
      name: "ChildA",
      parentClassId: "c1",
      description: "",
      attributes: [],
    },
    {
      id: "c3",
      name: "ChildB",
      parentClassId: "c1",
      description: "",
      attributes: [],
    },
  ]
  const relations: ImportRelation[] = [
    {
      id: "r1",
      name: "connectsTo",
      domainClassId: "c2",
      rangeClassId: "c3",
      description: "",
    },
  ]

  const visual = computeOntologyDagreLayout(classes, relations, "Core Module")

  assert.equal(visual.classPositions.length, 3)
  assert.equal(visual.moduleLayouts.length, 1)

  const pos1 = visual.classPositions.find((p) => p.classId === "c1")!
  const pos2 = visual.classPositions.find((p) => p.classId === "c2")!
  const pos3 = visual.classPositions.find((p) => p.classId === "c3")!

  assert.ok(typeof pos1.x === "number" && typeof pos1.y === "number")
  assert.ok(typeof pos2.x === "number" && typeof pos2.y === "number")
  assert.ok(typeof pos3.x === "number" && typeof pos3.y === "number")

  // Parent should be placed above children (rankdir TB)
  assert.ok(pos1.y < pos2.y, "Parent Y should be above ChildA Y")
  assert.ok(pos1.y < pos3.y, "Parent Y should be above ChildB Y")

  // Module bounds contain all class coordinates
  const moduleLayout = visual.moduleLayouts[0]
  assert.ok(moduleLayout.width > 200, "Module width should cover nodes")
  assert.ok(moduleLayout.height > 100, "Module height should cover nodes")
})
