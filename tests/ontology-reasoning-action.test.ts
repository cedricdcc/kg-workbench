import assert from "node:assert/strict"
import { test } from "node:test"
import {
  serializeOntologyTurtle,
  type SerializeOntologyInput,
} from "../src/features/ontology/server/shacl/serialize-ontology-turtle"

test("serializeOntologyTurtle emits classes, subclasses, disjointness and example instances", () => {
  const mockOntology: SerializeOntologyInput = {
    name: "AssetOntology",
    baseIri: "http://example.org/onto#",
    classes: [
      { id: "c1", name: "PhysicalAsset", parentClassId: "c2" },
      { id: "c2", name: "Asset", parentClassId: null },
      { id: "c3", name: "VirtualAsset", parentClassId: null },
    ],
    relations: [
      { id: "r1", name: "managedBy", sourceClassId: "c2", targetClassId: "c1" }
    ],
    attributes: [
      { id: "a1", classId: "c1", name: "serialNumber", dataType: "string", isRequired: true }
    ],
    disjointness: [
      { classId: "c1", disjointClassId: "c3" }
    ],
    examples: [
      { id: "e1", classId: "c1", value: "Turbine-101" }
    ]
  }

  const ttl = serializeOntologyTurtle(mockOntology)
  assert.ok(ttl.includes("owl:Class"))
  assert.ok(ttl.includes("rdfs:subClassOf"))
  assert.ok(ttl.includes("owl:disjointWith"))
  assert.ok(ttl.includes("Turbine-101"))
  assert.ok(ttl.includes("managedBy"))
})
