import type {
  ImportCompetencyQuestion,
  ImportOntology,
} from "@/features/ontology/schemas/import"
import { normalizeOwlBaseIri } from "@/features/ontology/utils/owl-base-iri"

import {
  KG_NS,
  OWL_NS,
  RDF_NS,
  RDFS_NS,
  XSD_NS,
  appendLiteralElement,
  escapeXmlAttribute,
} from "../rdf"
import {
  appendOntologyAnnotationValues,
  appendAnnotationValues,
  buildLocalizedTextMap,
} from "./localized-texts"
import {
  appendAnnotationProperties,
  appendAttributes,
  appendClass,
  createClassEntries,
} from "./classes"
import {
  appendExampleAnnotations,
  appendNoteAnnotations,
  buildCQPattern,
  buildExampleMap,
  buildNoteMap,
} from "./metadata"
import { appendRelationAttributes } from "./relation-attributes"
import {
  appendRelations,
  buildRelationMap,
  createRelationEntries,
} from "./relations"
import type { ClassMap, RelationMap } from "./types"
import {
  runOntologyLinter,
  type OntologyDefectReport,
} from "@/features/ontology/utils/linter"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import type { OntologyRelation } from "@/domain/ontology"

export interface BuildOwlOntologyInput {
  baseIri: string
  ontology: ImportOntology
  defectsReport?: OntologyDefectReport
}

export function convertToLinterEntities(ontology: ImportOntology): {
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
} {
  const classes: OntologyClassWithAttributes[] = (ontology.classes ?? []).map((c) => ({
    id: c.id ?? c.name,
    ontology_id: ontology.id ?? "temp-ontology",
    module_id: c.moduleId ?? null,
    name: c.name,
    description: c.description ?? "",
    parent_class_id: c.parentClassId ?? null,
    instance_policy: "open",
    attributes: (c.attributes ?? []).map((a, idx) => ({
      id: a.id ?? `attr-${idx}`,
      class_id: c.id ?? c.name,
      name: a.name,
      data_type: a.dataType,
      required: a.required ?? false,
      description: a.description ?? "",
    })),
  }))

  const relations: OntologyRelation[] = (ontology.relations ?? []).map((r, idx) => ({
    id: r.id ?? `rel-${idx}`,
    ontology_id: ontology.id ?? "temp-ontology",
    name: r.name,
    domain_class_id: r.domainClassId,
    range_class_id: r.rangeClassId,
    description: r.description ?? "",
    inverse_name: r.inverseName ?? null,
    cardinality: r.cardinality ?? null,
    instance_policy: "open",
  }))

  return { classes, relations }
}

function appendCQAnnotations({
  cqs,
  defaultLanguage,
  includeNotesAndExamples,
  lines,
  localizedTextMap,
  noteMap,
  exampleMap,
}: {
  cqs: ImportCompetencyQuestion[]
  defaultLanguage: string
  includeNotesAndExamples: boolean
  lines: string[]
  localizedTextMap: Map<string, string>
  noteMap: Map<string, ImportOntology["notes"]>
  exampleMap: Map<string, ImportOntology["examples"]>
}) {
  for (const cq of cqs) {
    appendAnnotationValues({
      canonicalValue: cq.question,
      defaultLanguage,
      fieldName: "question",
      lines,
      localizedTextMap,
      tagName: "kg:competencyQuestion",
      targetId: cq.id ?? cq.question,
      targetType: "cq",
    })

    const pattern = buildCQPattern(cq)
    appendLiteralElement(lines, "    ", "kg:competencyQuestionPattern", pattern)

    if (!includeNotesAndExamples || !cq.id) continue
    appendNoteAnnotations(lines, noteMap.get(`cq:${cq.id}`) ?? [])
    appendExampleAnnotations(lines, exampleMap.get(`cq:${cq.id}`) ?? [])
  }
}

function filterCQsForClass(cqs: ImportCompetencyQuestion[], classId: string) {
  return cqs.filter(
    (cq) => cq.subjectClassId === classId || cq.objectClassId === classId
  )
}

function filterCQsForRelation(
  cqs: ImportCompetencyQuestion[],
  relationId: string
) {
  return cqs.filter((cq) => cq.predicateRelationId === relationId)
}

export function buildOwlOntology({
  baseIri,
  ontology,
  defectsReport,
}: BuildOwlOntologyInput) {
  const normalizedBaseIri = normalizeOwlBaseIri(baseIri)
  const classEntries = createClassEntries(ontology, normalizedBaseIri)
  const classById: ClassMap = new Map(
    classEntries.map((entry) => [entry.cls.id, entry])
  )
  const relationEntries = createRelationEntries(
    ontology.relations,
    normalizedBaseIri
  )
  const relationById: RelationMap = buildRelationMap(relationEntries)
  const localizedTextMap = buildLocalizedTextMap(ontology.localizedTexts)
  const noteMap = buildNoteMap(ontology.notes)
  const exampleMap = buildExampleMap(ontology.examples)

  const defectReport =
    defectsReport ??
    (() => {
      const { classes, relations } = convertToLinterEntities(ontology)
      return runOntologyLinter({ classes, relations })
    })()

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<rdf:RDF xmlns:rdf="${RDF_NS}"`,
    `         xmlns:rdfs="${RDFS_NS}"`,
    `         xmlns:owl="${OWL_NS}"`,
    `         xmlns:xsd="${XSD_NS}"`,
    `         xmlns:kg="${KG_NS}"`,
    `         xml:base="${escapeXmlAttribute(normalizedBaseIri)}">`,
    `  <owl:Ontology rdf:about="${escapeXmlAttribute(normalizedBaseIri)}">`,
  ]

  appendOntologyAnnotationValues({
    canonicalValue: ontology.name,
    defaultLanguage: ontology.defaultLanguage,
    fieldName: "name",
    lines,
    localizedTextMap,
    tagName: "rdfs:label",
  })
  appendOntologyAnnotationValues({
    canonicalValue: ontology.usecase,
    defaultLanguage: ontology.defaultLanguage,
    fieldName: "usecase",
    lines,
    localizedTextMap,
    tagName: "rdfs:comment",
  })

  if (defectReport.total > 0) {
    const summary = `[Linter Diagnostics] Total: ${defectReport.total} (Errors: ${defectReport.counts.error}, Warnings: ${defectReport.counts.warning}, Info: ${defectReport.counts.info})`
    appendLiteralElement(lines, "    ", "rdfs:comment", summary)

    for (const defect of defectReport.defects) {
      const codeStr = defect.code ? `[${defect.code}] ` : ""
      const diagLine = `[Diagnostic ${defect.severity.toUpperCase()}] ${codeStr}${defect.kind} on ${defect.targetType} "${defect.targetName}": ${defect.description}`
      appendLiteralElement(lines, "    ", "rdfs:comment", diagLine)
    }
  }
  appendLiteralElement(lines, "    ", "owl:versionInfo", ontology.version)
  appendNoteAnnotations(
    lines,
    ontology.notes.filter((note) => note.targetType === "ontology")
  )
  appendCQAnnotations({
    cqs: ontology.competencyQuestions,
    defaultLanguage: ontology.defaultLanguage,
    includeNotesAndExamples: true,
    lines,
    localizedTextMap,
    noteMap,
    exampleMap,
  })
  lines.push("  </owl:Ontology>")
  appendAnnotationProperties(lines)

  for (const entry of classEntries) {
    appendClass(
      lines,
      entry,
      classById,
      localizedTextMap,
      ontology.defaultLanguage,
      noteMap,
      exampleMap,
      filterCQsForClass(ontology.competencyQuestions, entry.cls.id)
    )
  }

  appendAttributes(
    lines,
    classEntries,
    normalizedBaseIri,
    localizedTextMap,
    ontology.defaultLanguage,
    noteMap,
    exampleMap
  )
  appendRelations({
    classById,
    defaultLanguage: ontology.defaultLanguage,
    lines,
    localizedTextMap,
    noteMap,
    relationEntries,
    exampleMap,
    filterCompetencyQuestions: (relationId) =>
      filterCQsForRelation(ontology.competencyQuestions, relationId),
  })
  appendRelationAttributes({
    baseIri: normalizedBaseIri,
    defaultLanguage: ontology.defaultLanguage,
    exampleMap,
    lines,
    localizedTextMap,
    noteMap,
    ontology,
    relationById,
  })

  lines.push("</rdf:RDF>")
  return lines.join("\n")
}
