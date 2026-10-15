import assert from "node:assert/strict"
import { test } from "node:test"
import { autoHealOntologyDraft } from "../src/features/ontology/server/actions/generate-ontology"
import type { GeneratedOntologyDraft } from "../src/features/ontology/schemas/ai-generation"

test("autoHealOntologyDraft breaks direct self-parent cycle (A -> A)", () => {
  const draft: GeneratedOntologyDraft = {
    modules: [{ name: "Core", description: "Core module" }],
    classes: [
      {
        name: "SelfReferencingNode",
        moduleName: "Core",
        description: "A class that accidentally targets itself as parent",
        parentClassName: "SelfReferencingNode",
        attributes: [],
      },
    ],
    relations: [],
    cqMappings: [],
    suggestedContext: [],
  }

  const { draft: healed, healedIssues } = autoHealOntologyDraft(draft)

  assert.equal(healed.classes[0].parentClassName, null)
  assert.equal(healedIssues.length, 1)
  assert.match(healedIssues[0], /Cleared cyclic parent link on class "SelfReferencingNode"/)
})

test("autoHealOntologyDraft breaks transitive cycle (A -> B -> A)", () => {
  const draft: GeneratedOntologyDraft = {
    modules: [{ name: "Core", description: "Core module" }],
    classes: [
      {
        name: "ClassA",
        moduleName: "Core",
        description: "Class A",
        parentClassName: "ClassB",
        attributes: [],
      },
      {
        name: "ClassB",
        moduleName: "Core",
        description: "Class B",
        parentClassName: "ClassA",
        attributes: [],
      },
    ],
    relations: [],
    cqMappings: [],
    suggestedContext: [],
  }

  const { draft: healed, healedIssues } = autoHealOntologyDraft(draft)

  const hasCycle =
    healed.classes.some((c) => c.parentClassName === "ClassA") &&
    healed.classes.some((c) => c.parentClassName === "ClassB")
  assert.equal(hasCycle, false, "Expected at least one cyclic link to be severed")
  assert.ok(healedIssues.length >= 1)
  assert.match(healedIssues[0], /Cleared cyclic parent link/)
})

test("autoHealOntologyDraft filters out dangling relations", () => {
  const draft: GeneratedOntologyDraft = {
    modules: [{ name: "Core", description: "Core module" }],
    classes: [
      {
        name: "Person",
        moduleName: "Core",
        description: "A person entity",
        parentClassName: null,
        attributes: [],
      },
    ],
    relations: [
      {
        name: "worksAt",
        domainClassName: "Person",
        rangeClassName: "Company", // Does not exist in classes
        description: "Dangling range relation",
      },
      {
        name: "manages",
        domainClassName: "GhostDept", // Does not exist in classes
        rangeClassName: "Person",
        description: "Dangling domain relation",
      },
    ],
    cqMappings: [],
    suggestedContext: [],
  }

  const { draft: healed, healedIssues } = autoHealOntologyDraft(draft)

  assert.equal(healed.relations.length, 0, "Dangling relations should be filtered out")
  assert.equal(healedIssues.length, 2)
  assert.match(healedIssues[0], /Removed dangling relation "worksAt"/)
  assert.match(healedIssues[1], /Removed dangling relation "manages"/)
})

test("autoHealOntologyDraft leaves valid connected draft unchanged", () => {
  const draft: GeneratedOntologyDraft = {
    modules: [{ name: "Core", description: "Core module" }],
    classes: [
      {
        name: "Person",
        moduleName: "Core",
        description: "A person entity",
        parentClassName: null,
        attributes: [],
      },
      {
        name: "Employee",
        moduleName: "Core",
        description: "An employee entity",
        parentClassName: "Person",
        attributes: [],
      },
    ],
    relations: [
      {
        name: "manages",
        domainClassName: "Employee",
        rangeClassName: "Employee",
        description: "Employee manages another employee",
      },
    ],
    cqMappings: [],
    suggestedContext: [],
  }

  const { draft: healed, healedIssues } = autoHealOntologyDraft(draft)

  assert.equal(healed.classes.length, 2)
  assert.equal(healed.relations.length, 1)
  assert.equal(healed.classes[1].parentClassName, "Person")
  assert.equal(healedIssues.length, 0)
})
