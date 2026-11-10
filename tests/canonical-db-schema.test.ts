import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type {
  OntologyAttribute,
  OntologyClass,
  OntologyModule,
  OntologyRelation,
} from "../src/domain/ontology"
import {
  documentEntities,
  entityAttributeValues,
  extractionRuns,
  factRelationAttributeValues,
  facts,
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
  ontologyDocuments,
  referenceOntologies,
} from "../src/server/db/schema"

describe("Option 2A Canonical DB Schema & Domain Types", () => {
  it("defines canonical LinkML columns on ontologyDocuments", () => {
    assert.ok(ontologyDocuments.linkml_yaml, "linkml_yaml column must exist")
    assert.equal(ontologyDocuments.linkml_yaml.columnType, "PgText")
    assert.equal(ontologyDocuments.linkml_yaml.notNull, true)

    assert.ok(ontologyDocuments.ohi_yaml, "ohi_yaml column must exist")
    assert.equal(ontologyDocuments.ohi_yaml.columnType, "PgText")
    assert.equal(ontologyDocuments.ohi_yaml.notNull, true)

    assert.ok(ontologyDocuments.ohi_lockfile, "ohi_lockfile column must exist")
    assert.equal(ontologyDocuments.ohi_lockfile.columnType, "PgJsonb")

    assert.ok(ontologyDocuments.ui_layout, "ui_layout column must exist")
    assert.equal(ontologyDocuments.ui_layout.columnType, "PgJsonb")
    assert.equal(ontologyDocuments.ui_layout.notNull, true)

    assert.ok(
      ontologyDocuments.compiled_artifacts,
      "compiled_artifacts column must exist"
    )
    assert.equal(ontologyDocuments.compiled_artifacts.columnType, "PgJsonb")
  })

  it("defines ohi.dev package registry columns on referenceOntologies", () => {
    assert.ok(referenceOntologies.ontology_id, "ontology_id column must exist")
    assert.equal(referenceOntologies.ontology_id.columnType, "PgUUID")

    assert.ok(
      referenceOntologies.publication_url,
      "publication_url column must exist"
    )
    assert.equal(referenceOntologies.publication_url.columnType, "PgText")

    assert.ok(
      referenceOntologies.artifact_url,
      "artifact_url column must exist"
    )
    assert.equal(referenceOntologies.artifact_url.columnType, "PgText")

    assert.ok(
      referenceOntologies.artifact_format,
      "artifact_format column must exist"
    )
    assert.equal(referenceOntologies.artifact_format.columnType, "PgText")
    assert.equal(referenceOntologies.artifact_format.notNull, true)

    assert.ok(referenceOntologies.sha256, "sha256 column must exist")
    assert.equal(referenceOntologies.sha256.columnType, "PgText")
    assert.equal(referenceOntologies.sha256.notNull, true)

    assert.ok(
      referenceOntologies.artifact_content,
      "artifact_content column must exist"
    )
    assert.equal(referenceOntologies.artifact_content.columnType, "PgText")
    assert.equal(referenceOntologies.artifact_content.notNull, true)

    assert.ok(
      referenceOntologies.is_transitive,
      "is_transitive column must exist"
    )
    assert.equal(referenceOntologies.is_transitive.columnType, "PgBoolean")
    assert.equal(referenceOntologies.is_transitive.notNull, true)
  })

  it("defines ohi lockfile snapshot and ontology sha256 on extractionRuns", () => {
    assert.ok(
      extractionRuns.ohi_lockfile_snapshot,
      "ohi_lockfile_snapshot column must exist"
    )
    assert.equal(extractionRuns.ohi_lockfile_snapshot.columnType, "PgJsonb")

    assert.ok(
      extractionRuns.ontology_sha256,
      "ontology_sha256 column must exist"
    )
    assert.equal(extractionRuns.ontology_sha256.columnType, "PgText")
  })

  it("switches external boundary foreign keys to text symbol keys", () => {
    assert.equal(
      documentEntities.class_id.columnType,
      "PgText",
      "documentEntities.class_id must be PgText symbol key"
    )

    assert.equal(
      facts.relation_type_id.columnType,
      "PgText",
      "facts.relation_type_id must be PgText symbol key"
    )

    assert.equal(
      entityAttributeValues.attribute_id.columnType,
      "PgText",
      "entityAttributeValues.attribute_id must be PgText symbol key"
    )
    assert.equal(entityAttributeValues.attribute_id.notNull, true)

    assert.equal(
      factRelationAttributeValues.relation_attribute_id.columnType,
      "PgText",
      "factRelationAttributeValues.relation_attribute_id must be PgText symbol key"
    )
    assert.equal(
      factRelationAttributeValues.relation_attribute_id.notNull,
      true
    )

    assert.equal(
      ontologyCompetencyQuestions.module_id.columnType,
      "PgText",
      "ontologyCompetencyQuestions.module_id must be PgText symbol key"
    )
    assert.equal(
      ontologyCompetencyQuestions.subject_class_id.columnType,
      "PgText",
      "ontologyCompetencyQuestions.subject_class_id must be PgText"
    )
    assert.equal(
      ontologyCompetencyQuestions.predicate_relation_id.columnType,
      "PgText",
      "ontologyCompetencyQuestions.predicate_relation_id must be PgText"
    )
    assert.equal(
      ontologyCompetencyQuestions.object_class_id.columnType,
      "PgText",
      "ontologyCompetencyQuestions.object_class_id must be PgText"
    )

    assert.equal(
      ontologyCompetencyQuestionModules.module_id.columnType,
      "PgText",
      "ontologyCompetencyQuestionModules.module_id must be PgText symbol key"
    )
    assert.equal(ontologyCompetencyQuestionModules.module_id.notNull, true)

    assert.equal(
      ontologyCqTriples.subject_class_id.columnType,
      "PgText",
      "ontologyCqTriples.subject_class_id must be PgText"
    )
    assert.equal(
      ontologyCqTriples.predicate_relation_id.columnType,
      "PgText",
      "ontologyCqTriples.predicate_relation_id must be PgText"
    )
    assert.equal(
      ontologyCqTriples.object_class_id.columnType,
      "PgText",
      "ontologyCqTriples.object_class_id must be PgText"
    )
  })

  it("exports pure TypeScript DTO interfaces for ontology concepts", () => {
    const mockModule: OntologyModule = {
      id: "core",
      ontology_id: "ont-1",
      name: "Core Domain",
      description: "Core module concepts",
    }
    assert.equal(mockModule.id, "core")

    const mockClass: OntologyClass = {
      id: "Person",
      ontology_id: "ont-1",
      module_id: "core",
      name: "Person",
      description: "Human individual",
      parent_class_id: null,
      instance_policy: "open",
    }
    assert.equal(mockClass.id, "Person")

    const mockAttribute: OntologyAttribute = {
      id: "Person.age",
      class_id: "Person",
      name: "age",
      data_type: "xsd:integer",
      required: false,
      description: "Age in years",
    }
    assert.equal(mockAttribute.id, "Person.age")

    const mockRelation: OntologyRelation = {
      id: "works_for",
      ontology_id: "ont-1",
      name: "works_for",
      domain_class_id: "Person",
      range_class_id: "Organization",
      description: "Employment relationship",
      inverse_name: "employs",
      cardinality: "many-to-one",
      instance_policy: "open",
    }
    assert.equal(mockRelation.id, "works_for")
  })

  it("confirms legacy relational sub-tables are completely removed from schema exports", async () => {
    const schema = await import("../src/server/db/schema")
    const legacyTableNames = [
      "ontologyModules",
      "ontologyClasses",
      "ontologyAttributes",
      "ontologyRelations",
      "ontologyRelationAttributes",
      "ontologyClassPositions",
      "ontologyModuleLayout",
      "ontologyLanguages",
      "ontologyNotes",
      "ontologyLocalizedTexts",
      "ontologyExamples",
      "ontologyClassDisjointness",
      "ontologyClassRestrictions",
    ]
    for (const name of legacyTableNames) {
      assert.equal(
        (schema as Record<string, unknown>)[name],
        undefined,
        `${name} must not be exported in schema.ts`
      )
    }
  })
})
