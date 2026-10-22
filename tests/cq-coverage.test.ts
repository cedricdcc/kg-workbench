import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateCqCoverageSummary,
  evaluateCqCoverage,
} from "../src/features/ontology/utils/cq-coverage"

const mockClasses = [
  { id: "c1", name: "User" },
  { id: "c2", name: "Document" },
] as any

const mockRelations = [
  { id: "r1", name: "authoredBy", domain_class_id: "c2", range_class_id: "c1" },
] as any

test("evaluateCqCoverage flags full coverage when subject, predicate, and object exist", () => {
  const cq = {
    id: "q1",
    question: "Who authored the document?",
    subject_class_id: "c2",
    predicate_relation_id: "r1",
    object_class_id: "c1",
  } as any

  const evaluated = evaluateCqCoverage(cq, mockClasses, mockRelations)
  assert.equal(evaluated.status, "full")
  assert.equal(evaluated.hasSubject, true)
  assert.equal(evaluated.hasPredicate, true)
  assert.equal(evaluated.hasObject, true)
  assert.equal(evaluated.subjectClassName, "Document")
  assert.equal(evaluated.predicateRelationName, "authoredBy")
  assert.equal(evaluated.objectClassName, "User")
})

test("evaluateCqCoverage flags partial coverage when some concepts missing", () => {
  const cq = {
    id: "q2",
    question: "Which document?",
    subject_class_id: "c2",
    predicate_relation_id: null,
    object_class_id: null,
  } as any

  const evaluated = evaluateCqCoverage(cq, mockClasses, mockRelations)
  assert.equal(evaluated.status, "partial")
  assert.equal(evaluated.hasSubject, true)
  assert.equal(evaluated.hasPredicate, false)
})

test("evaluateCqCoverage flags unmapped when no concepts mapped", () => {
  const cq = {
    id: "q3",
    question: "Unknown?",
    subject_class_id: null,
    predicate_relation_id: null,
    object_class_id: null,
  } as any

  const evaluated = evaluateCqCoverage(cq, mockClasses, mockRelations)
  assert.equal(evaluated.status, "unmapped")
})

test("calculateCqCoverageSummary aggregates metrics and calculates percentage", () => {
  const cqs = [
    {
      id: "1",
      subject_class_id: "c2",
      predicate_relation_id: "r1",
      object_class_id: "c1",
    },
    { id: "2", subject_class_id: "c2" },
    { id: "3" },
  ] as any

  const summary = calculateCqCoverageSummary(cqs, mockClasses, mockRelations)
  assert.equal(summary.totalCount, 3)
  assert.equal(summary.fullCount, 1)
  assert.equal(summary.partialCount, 1)
  assert.equal(summary.unmappedCount, 1)
  assert.equal(summary.coveragePercentage, 33)
})
