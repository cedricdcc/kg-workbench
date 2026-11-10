import YAML from "yaml"
import type {
  ImportClass,
  ImportExample,
  ImportLocalizedText,
  ImportNote,
  ImportOntology,
  ImportRelation,
  ImportRelationAttribute,
} from "@/features/ontology/schemas/import"
import { normalizeOntologyDataTypeOrDefault } from "@/features/ontology/utils/data-types"
import { computeOntologyDagreLayout } from "../services/turtle-importer/layout"
import type { ParseTurtleOptions } from "../services/turtle-importer/types"
import { KNOWN_ONTOLOGY_PREFIXES } from "@/features/ontology/utils/external-uri"
import type {
  CanonicalOntologySnapshot,
  OntologyAttributeSnapshot,
  OntologyClassDisjointnessSnapshot,
  OntologyClassRestrictionSnapshot,
  OntologyClassSnapshot,
  OntologyDocumentSnapshot,
  OntologyExampleSnapshot,
  OntologyLocalizedTextSnapshot,
  OntologyModuleSnapshot,
  OntologyNoteSnapshot,
  OntologyRelationAttributeSnapshot,
  OntologyRelationSnapshot,
  OntologyUiLayout,
} from "./types"

/**
 * Creates a deterministic composite symbol key for a class attribute: "<classKey>.<attrName>".
 */
export function makeAttributeKey(classKey: string, attrName: string): string {
  return `${classKey}.${attrName}`
}

/**
 * Creates a deterministic composite symbol key for a relation attribute: "<relationKey>.<attrName>".
 */
export function makeRelationAttributeKey(
  relationKey: string,
  attrName: string
): string {
  return `${relationKey}.${attrName}`
}

const XSD_TO_LINKML_RANGE_MAP: Record<string, string> = {
  "xsd:string": "string",
  "xsd:normalizedString": "string",
  "xsd:token": "string",
  "xsd:language": "string",
  "xsd:Name": "string",
  "xsd:NCName": "string",
  "xsd:NMTOKEN": "string",
  "xsd:integer": "integer",
  "xsd:nonNegativeInteger": "integer",
  "xsd:nonPositiveInteger": "integer",
  "xsd:positiveInteger": "integer",
  "xsd:negativeInteger": "integer",
  "xsd:long": "integer",
  "xsd:int": "integer",
  "xsd:short": "integer",
  "xsd:byte": "integer",
  "xsd:unsignedLong": "integer",
  "xsd:unsignedInt": "integer",
  "xsd:unsignedShort": "integer",
  "xsd:unsignedByte": "integer",
  "xsd:decimal": "float",
  "xsd:float": "float",
  "xsd:double": "float",
  "xsd:boolean": "boolean",
  "xsd:date": "date",
  "xsd:dateTime": "datetime",
  "xsd:dateTimeStamp": "datetime",
  "xsd:anyURI": "uri",
  "owl:rational": "float",
  "xsd:hexBinary": "string",
  "xsd:base64Binary": "string",
}

const KNOWN_LINKML_RANGES = new Set([
  "string",
  "integer",
  "float",
  "double",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "time",
  "uri",
  "uriorcurie",
  "ncname",
  "objectidentifier",
  "nodeidentifier",
])

function mapDataTypeToLinkmlRange(dataType?: string): string {
  if (!dataType) return "string"
  const trimmed = dataType.trim()
  if (XSD_TO_LINKML_RANGE_MAP[trimmed]) {
    return XSD_TO_LINKML_RANGE_MAP[trimmed]
  }
  if (KNOWN_LINKML_RANGES.has(trimmed.toLowerCase())) {
    return trimmed.toLowerCase()
  }
  return "string"
}

function parseCardinalityToLinkml(cardinality?: string | null): {
  minimum_cardinality?: number
  maximum_cardinality?: number
  multivalued?: boolean
} {
  if (!cardinality) return {}
  const trimmed = cardinality.trim()
  switch (trimmed) {
    case "1:1":
      return {
        minimum_cardinality: 1,
        maximum_cardinality: 1,
        multivalued: false,
      }
    case "1:N":
    case "1..*":
      return { minimum_cardinality: 1, multivalued: true }
    case "N:1":
      return {
        minimum_cardinality: 0,
        maximum_cardinality: 1,
        multivalued: false,
      }
    case "0..1":
      return {
        minimum_cardinality: 0,
        maximum_cardinality: 1,
        multivalued: false,
      }
    case "N:M":
    case "0..*":
      return { minimum_cardinality: 0, multivalued: true }
    default:
      return {}
  }
}

function deriveCardinalityFromLinkml(slotDef: {
  multivalued?: boolean
  required?: boolean
  minimum_cardinality?: number
  maximum_cardinality?: number
}): string {
  if (slotDef.multivalued) {
    return (slotDef.minimum_cardinality ?? 0) > 0 || slotDef.required
      ? "1:N"
      : "N:M"
  }
  if (slotDef.maximum_cardinality === 1) {
    return (slotDef.minimum_cardinality ?? 0) > 0 || slotDef.required
      ? "1:1"
      : "0..1"
  }
  return (slotDef.minimum_cardinality ?? 0) > 0 || slotDef.required
    ? "1:1"
    : "0..1"
}

function parseAnnotationPayload<T>(value: unknown): T | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return undefined
    }
  }
  return value as T
}

function getNotesForTarget(
  notes: OntologyNoteSnapshot[] | undefined,
  targetType: string,
  targetIds: string[]
) {
  if (!notes || notes.length === 0) return undefined
  const matches = notes.filter(
    (n) => n.target_type === targetType && targetIds.includes(n.target_id)
  )
  if (matches.length === 0) return undefined
  return matches.map((n) => ({
    ...(n.id ? { id: n.id } : {}),
    body: n.body,
    ...(n.author_name ? { author_name: n.author_name } : {}),
    ...(n.sort_order !== undefined ? { sort_order: n.sort_order } : {}),
  }))
}

function getLocalizedTextsForTarget(
  texts: OntologyLocalizedTextSnapshot[] | undefined,
  targetType: string,
  targetIds: string[]
) {
  if (!texts || texts.length === 0) return undefined
  const matches = texts.filter(
    (t) => t.target_type === targetType && targetIds.includes(t.target_id)
  )
  if (matches.length === 0) return undefined
  return matches.map((t) => ({
    ...(t.id ? { id: t.id } : {}),
    field_name: t.field_name,
    language_code: t.language_code,
    value: t.value,
  }))
}

function getExamplesForTarget(
  examples: OntologyExampleSnapshot[] | undefined,
  targetType: string,
  targetIds: string[]
) {
  if (!examples || examples.length === 0) return undefined
  const matches = examples.filter(
    (e) => e.target_type === targetType && targetIds.includes(e.target_id)
  )
  if (matches.length === 0) return undefined
  return matches.map((e) => ({
    ...(e.id ? { id: e.id } : {}),
    value: e.value,
    ...(e.subject_label ? { subject_label: e.subject_label } : {}),
    ...(e.predicate_label ? { predicate_label: e.predicate_label } : {}),
    ...(e.object_label ? { object_label: e.object_label } : {}),
    ...(e.is_instance_candidate !== undefined
      ? { is_instance_candidate: e.is_instance_candidate }
      : {}),
    ...(e.sort_order !== undefined ? { sort_order: e.sort_order } : {}),
  }))
}

function extractNotes(
  annotations: Record<string, unknown> | undefined,
  targetType: string,
  targetId: string,
  sink: OntologyNoteSnapshot[]
) {
  if (!annotations) return
  const raw = parseAnnotationPayload<unknown>(annotations.kg_notes)
  if (!Array.isArray(raw)) return
  for (const n of raw as Array<Record<string, unknown>>) {
    if (n && typeof n.body === "string") {
      sink.push({
        ...(n.id ? { id: String(n.id) } : {}),
        target_type: targetType,
        target_id: targetId,
        body: n.body,
        author_name: n.author_name ? String(n.author_name) : undefined,
        sort_order: typeof n.sort_order === "number" ? n.sort_order : undefined,
      })
    }
  }
}

function extractLocalizedTexts(
  annotations: Record<string, unknown> | undefined,
  targetType: string,
  targetId: string,
  sink: OntologyLocalizedTextSnapshot[]
) {
  if (!annotations) return
  const raw = parseAnnotationPayload<unknown>(annotations.kg_localized_texts)
  if (!Array.isArray(raw)) return
  for (const t of raw as Array<Record<string, unknown>>) {
    if (
      t &&
      typeof t.field_name === "string" &&
      typeof t.language_code === "string"
    ) {
      sink.push({
        ...(t.id ? { id: String(t.id) } : {}),
        target_type: targetType,
        target_id: targetId,
        field_name: t.field_name,
        language_code: t.language_code,
        value: typeof t.value === "string" ? t.value : "",
      })
    }
  }
}

function extractExamples(
  annotations: Record<string, unknown> | undefined,
  targetType: string,
  targetId: string,
  sink: OntologyExampleSnapshot[]
) {
  if (!annotations) return
  const raw = parseAnnotationPayload<unknown>(annotations.kg_examples)
  if (!Array.isArray(raw)) return
  for (const e of raw as Array<Record<string, unknown>>) {
    if (e && typeof e.value === "string") {
      sink.push({
        ...(e.id ? { id: String(e.id) } : {}),
        target_type: targetType,
        target_id: targetId,
        value: e.value,
        subject_label:
          typeof e.subject_label === "string" ? e.subject_label : undefined,
        predicate_label:
          typeof e.predicate_label === "string" ? e.predicate_label : undefined,
        object_label:
          typeof e.object_label === "string" ? e.object_label : undefined,
        is_instance_candidate:
          typeof e.is_instance_candidate === "boolean"
            ? e.is_instance_candidate
            : undefined,
        sort_order: typeof e.sort_order === "number" ? e.sort_order : undefined,
      })
    }
  }
}

/**
 * Transforms a CanonicalOntologySnapshot into a standard, lossless LinkML YAML schema string.
 */
export function snapshotToLinkmlYaml(
  snapshot: CanonicalOntologySnapshot
): string {
  const docId = snapshot.document.id
  const baseIri =
    snapshot.document.base_iri ||
    `https://kg-workbench.local/ontology/${docId}#`
  const docName =
    snapshot.document.name.trim().replace(/\s+/g, "_") || "ontology"

  const defaultPrefixes: Record<string, string> = {
    linkml: "https://w3id.org/linkml/",
    ont: baseIri,
    ...(snapshot.document.prefixes || {}),
  }

  const imports = Array.from(
    new Set(["linkml:types", ...(snapshot.document.imports || [])])
  )

  const rootDoc: Record<string, unknown> = {
    id: baseIri,
    name: docName,
    ...(snapshot.document.usecase
      ? { description: snapshot.document.usecase }
      : {}),
    in_language: snapshot.document.default_language || "en",
    ...(snapshot.document.version
      ? { version: snapshot.document.version }
      : {}),
    default_range: "string",
    prefixes: defaultPrefixes,
    imports,
  }

  // Root annotations
  const rootAnnotations: Record<string, unknown> = {}
  if (snapshot.document.group_key) {
    rootAnnotations.kg_group_key = snapshot.document.group_key
  }
  if (snapshot.ui_layout) {
    rootAnnotations.kg_ui_layout = JSON.stringify(snapshot.ui_layout)
  }

  const docNotes = getNotesForTarget(snapshot.notes, "ontology", [docId])
  if (docNotes) rootAnnotations.kg_notes = JSON.stringify(docNotes)

  const docTexts = getLocalizedTextsForTarget(
    snapshot.localized_texts,
    "ontology",
    [docId]
  )
  if (docTexts) rootAnnotations.kg_localized_texts = JSON.stringify(docTexts)

  if (Object.keys(rootAnnotations).length > 0) {
    rootDoc.annotations = rootAnnotations
  }

  // Subsets (Modules)
  if (snapshot.modules.length > 0) {
    const subsets: Record<string, unknown> = {}
    for (const mod of snapshot.modules) {
      const subsetKey = mod.id || mod.name
      const subsetDef: Record<string, unknown> = {
        ...(mod.description ? { description: mod.description } : {}),
      }
      const modAnnotations: Record<string, unknown> = {}
      if (mod.name) {
        modAnnotations.kg_name = mod.name
      }
      const modNotes = getNotesForTarget(snapshot.notes, "module", [
        mod.id,
        subsetKey,
      ])
      if (modNotes) modAnnotations.kg_notes = JSON.stringify(modNotes)

      const modTexts = getLocalizedTextsForTarget(
        snapshot.localized_texts,
        "module",
        [mod.id, subsetKey]
      )
      if (modTexts) modAnnotations.kg_localized_texts = JSON.stringify(modTexts)

      if (Object.keys(modAnnotations).length > 0) {
        subsetDef.annotations = modAnnotations
      }
      subsets[subsetKey] = subsetDef
    }
    rootDoc.subsets = subsets
  }

  // Disambiguate relations: count relations sharing the same relation name
  const relationNameCounts = new Map<string, number>()
  for (const rel of snapshot.relations) {
    relationNameCounts.set(
      rel.name,
      (relationNameCounts.get(rel.name) || 0) + 1
    )
  }

  const relationKeyMap = new Map<OntologyRelationSnapshot, string>()
  for (const rel of snapshot.relations) {
    const isColliding = (relationNameCounts.get(rel.name) || 0) > 1
    const isPreDisambiguated = Boolean(rel.id && rel.id.includes("__"))
    const relationKey =
      isColliding || isPreDisambiguated
        ? `${rel.domain_class_id}__${rel.name}__${rel.range_class_id}`
        : rel.name
    relationKeyMap.set(rel, relationKey)
  }

  // Slots (Relations)
  if (snapshot.relations.length > 0) {
    const slots: Record<string, unknown> = {}
    for (const rel of snapshot.relations) {
      const relationKey = relationKeyMap.get(rel)!
      const slotDef: Record<string, unknown> = {
        domain: rel.domain_class_id,
        range: rel.range_class_id,
        ...(rel.description ? { description: rel.description } : {}),
        ...(rel.inverse_name ? { inverse: rel.inverse_name } : {}),
      }

      const cardProps = parseCardinalityToLinkml(rel.cardinality)
      if (cardProps.minimum_cardinality !== undefined) {
        slotDef.minimum_cardinality = cardProps.minimum_cardinality
      }
      if (cardProps.maximum_cardinality !== undefined) {
        slotDef.maximum_cardinality = cardProps.maximum_cardinality
      }
      if (cardProps.multivalued !== undefined) {
        slotDef.multivalued = cardProps.multivalued
      }

      const slotAnnotations: Record<string, unknown> = {}
      if (relationKey !== rel.name) {
        slotDef.slot_uri = rel.name
        slotAnnotations.kg_display_name = rel.name
      }
      if (rel.id && rel.id !== relationKey) {
        slotAnnotations.kg_relation_id = rel.id
      }
      if (rel.cardinality) {
        slotAnnotations.kg_cardinality = rel.cardinality
      }
      if (rel.instance_policy) {
        slotAnnotations.kg_instance_policy = rel.instance_policy
      }

      // Relation attributes
      const matchingRelAttrs = snapshot.relation_attributes.filter(
        (ra) =>
          ra.relation_id === rel.id ||
          ra.relation_id === relationKey ||
          ra.relation_id === rel.name
      )
      if (matchingRelAttrs.length > 0) {
        const processedRelAttrs = matchingRelAttrs.map((ra) => {
          const raCompositeKey = makeRelationAttributeKey(relationKey, ra.name)
          const raId = ra.id || raCompositeKey
          const raObj: Record<string, unknown> = {
            id: raId,
            name: ra.name,
            data_type: ra.data_type || "string",
            required: Boolean(ra.required),
            description: ra.description || "",
            sort_order: ra.sort_order ?? 0,
          }

          const raNotes = getNotesForTarget(
            snapshot.notes,
            "relation_attribute",
            [raId, raCompositeKey]
          )
          const raTexts = getLocalizedTextsForTarget(
            snapshot.localized_texts,
            "relation_attribute",
            [raId, raCompositeKey]
          )
          const raExamples = getExamplesForTarget(
            snapshot.examples,
            "relation_attribute",
            [raId, raCompositeKey]
          )

          if (raNotes || raTexts || raExamples) {
            const innerAnnotations: Record<string, unknown> = {}
            if (raNotes) innerAnnotations.kg_notes = raNotes
            if (raTexts) innerAnnotations.kg_localized_texts = raTexts
            if (raExamples) innerAnnotations.kg_examples = raExamples
            raObj.annotations = innerAnnotations
          }

          return raObj
        })
        slotAnnotations.kg_relation_attributes =
          JSON.stringify(processedRelAttrs)
      }

      const relNotes = getNotesForTarget(snapshot.notes, "relation", [
        rel.id,
        relationKey,
        rel.name,
      ])
      if (relNotes) slotAnnotations.kg_notes = JSON.stringify(relNotes)

      const relTexts = getLocalizedTextsForTarget(
        snapshot.localized_texts,
        "relation",
        [rel.id, relationKey, rel.name]
      )
      if (relTexts)
        slotAnnotations.kg_localized_texts = JSON.stringify(relTexts)

      const relExamples = getExamplesForTarget(snapshot.examples, "relation", [
        rel.id,
        relationKey,
        rel.name,
      ])
      if (relExamples) slotAnnotations.kg_examples = JSON.stringify(relExamples)

      if (Object.keys(slotAnnotations).length > 0) {
        slotDef.annotations = slotAnnotations
      }

      slots[relationKey] = slotDef
    }

    // If a relation defines an inverse_name that is not explicitly present in slots,
    // emit a synthetic inverse slot so that LinkML reference resolution succeeds cleanly.
    for (const rel of snapshot.relations) {
      if (rel.inverse_name && !slots[rel.inverse_name]) {
        const relationKey = relationKeyMap.get(rel)!
        slots[rel.inverse_name] = {
          domain: rel.range_class_id,
          range: rel.domain_class_id,
          inverse: relationKey,
          annotations: {
            kg_synthetic_inverse: true,
          },
        }
      }
    }

    rootDoc.slots = slots
  }

  // Classes
  if (snapshot.classes.length > 0) {
    const classes: Record<string, unknown> = {}
    for (const cls of snapshot.classes) {
      const classKey = cls.id || cls.name
      const classDef: Record<string, unknown> = {
        ...(cls.description ? { description: cls.description } : {}),
        ...(cls.parent_class_id ? { is_a: cls.parent_class_id } : {}),
        ...(cls.module_id ? { in_subset: [cls.module_id] } : {}),
      }

      // Disjointness
      const disjointSet = new Set<string>()
      if (cls.disjoint_with) {
        for (const d of cls.disjoint_with) disjointSet.add(d)
      }
      if (cls.disjoint_with_class_ids) {
        for (const d of cls.disjoint_with_class_ids) disjointSet.add(d)
      }
      if (snapshot.disjointness) {
        for (const d of snapshot.disjointness) {
          if (d.class_id === classKey) disjointSet.add(d.disjoint_class_id)
        }
      }
      if (disjointSet.size > 0) {
        classDef.disjoint_with = Array.from(disjointSet)
      }

      // Slots attached to this class as domain
      const classSlots = snapshot.relations
        .filter((r) => r.domain_class_id === classKey)
        .map((r) => relationKeyMap.get(r)!)
      if (classSlots.length > 0) {
        classDef.slots = Array.from(new Set(classSlots))
      }

      // Class attributes
      const classAttrs = [
        ...(cls.attributes || []),
        ...snapshot.attributes.filter((a) => a.class_id === classKey),
      ]
      const seenAttrs = new Set<string>()
      const attrDefs: Record<string, unknown> = {}
      for (const attr of classAttrs) {
        if (seenAttrs.has(attr.name)) continue
        seenAttrs.add(attr.name)

        const attrKey = attr.name
        const compositeKey = makeAttributeKey(classKey, attrKey)
        const attrId = attr.id || compositeKey
        const linkmlRange = mapDataTypeToLinkmlRange(attr.data_type)

        const def: Record<string, unknown> = {
          range: linkmlRange,
          ...(attr.required !== undefined && attr.required !== null
            ? { required: Boolean(attr.required) }
            : {}),
          ...(attr.description ? { description: attr.description } : {}),
        }

        const attrAnnotations: Record<string, unknown> = {}
        if (attr.data_type && attr.data_type !== linkmlRange) {
          attrAnnotations.kg_data_type = attr.data_type
        }

        const attrNotes = getNotesForTarget(snapshot.notes, "attribute", [
          attrId,
          compositeKey,
        ])
        if (attrNotes) attrAnnotations.kg_notes = JSON.stringify(attrNotes)

        const attrTexts = getLocalizedTextsForTarget(
          snapshot.localized_texts,
          "attribute",
          [attrId, compositeKey]
        )
        if (attrTexts)
          attrAnnotations.kg_localized_texts = JSON.stringify(attrTexts)

        const attrExamples = getExamplesForTarget(
          snapshot.examples,
          "attribute",
          [attrId, compositeKey]
        )
        if (attrExamples)
          attrAnnotations.kg_examples = JSON.stringify(attrExamples)

        if (Object.keys(attrAnnotations).length > 0) {
          def.annotations = attrAnnotations
        }

        attrDefs[attrKey] = def
      }
      if (Object.keys(attrDefs).length > 0) {
        classDef.attributes = attrDefs
      }

      // Slot usage (Restrictions)
      const classRestrictions = [
        ...(cls.restrictions || []),
        ...(snapshot.restrictions?.filter((r) => r.class_id === classKey) ||
          []),
      ]
      if (classRestrictions.length > 0) {
        const slotUsage: Record<string, unknown> = {}
        for (const r of classRestrictions) {
          let target = r.relation_id || r.attribute_id
          if (!target) continue

          // If target is an attribute with composite key (e.g. Person.email), extract attribute name
          if (r.attribute_id && target.includes(".")) {
            target = target.split(".").pop() || target
          }

          // If target is a relation, check if relation was disambiguated to a relationKey
          if (r.relation_id) {
            const matchingRel = snapshot.relations.find(
              (rel) => rel.id === r.relation_id || rel.name === r.relation_id
            )
            if (matchingRel && relationKeyMap.has(matchingRel)) {
              target = relationKeyMap.get(matchingRel)!
            }
          }

          const currentUsage =
            (slotUsage[target] as Record<string, unknown>) || {}
          if (
            r.restriction_type === "min" ||
            r.restriction_type === "min_cardinality"
          ) {
            currentUsage.minimum_cardinality = r.cardinality_value
          } else if (
            r.restriction_type === "max" ||
            r.restriction_type === "max_cardinality"
          ) {
            currentUsage.maximum_cardinality = r.cardinality_value
          } else if (
            r.restriction_type === "exact" ||
            r.restriction_type === "exact_cardinality"
          ) {
            currentUsage.exact_cardinality = r.cardinality_value
          } else {
            currentUsage.cardinality = r.cardinality_value
          }
          slotUsage[target] = currentUsage
        }
        if (Object.keys(slotUsage).length > 0) {
          classDef.slot_usage = slotUsage
        }
      }

      // Class examples & annotations
      const clsExamples = getExamplesForTarget(snapshot.examples, "class", [
        cls.id,
        classKey,
      ])
      if (clsExamples && clsExamples.length > 0) {
        classDef.examples = clsExamples.map((ex) => ({ value: ex.value }))
      }

      const classAnnotations: Record<string, unknown> = {}
      if (cls.instance_policy) {
        classAnnotations.kg_instance_policy = cls.instance_policy
      }

      const clsNotes = getNotesForTarget(snapshot.notes, "class", [
        cls.id,
        classKey,
      ])
      if (clsNotes) classAnnotations.kg_notes = JSON.stringify(clsNotes)

      const clsTexts = getLocalizedTextsForTarget(
        snapshot.localized_texts,
        "class",
        [cls.id, classKey]
      )
      if (clsTexts)
        classAnnotations.kg_localized_texts = JSON.stringify(clsTexts)

      if (clsExamples)
        classAnnotations.kg_examples = JSON.stringify(clsExamples)

      if (Object.keys(classAnnotations).length > 0) {
        classDef.annotations = classAnnotations
      }

      classes[classKey] = classDef
    }
    rootDoc.classes = classes
  }

  return YAML.stringify(rootDoc, { indent: 2, lineWidth: 0 })
}

/**
 * Parses a standard LinkML YAML schema string into a CanonicalOntologySnapshot.
 */
export function linkmlYamlToSnapshot(
  ontologyId: string,
  linkmlYaml: string,
  uiLayout?: OntologyUiLayout
): CanonicalOntologySnapshot {
  const parsed = (YAML.parse(linkmlYaml) || {}) as Record<string, unknown>

  const baseIri = parsed.id ? String(parsed.id) : undefined
  const docName = parsed.name ? String(parsed.name) : ontologyId || "ontology"
  const document: OntologyDocumentSnapshot = {
    id: ontologyId || baseIri || "ontology",
    name: docName,
    version: parsed.version ? String(parsed.version) : null,
    default_language: parsed.in_language ? String(parsed.in_language) : "en",
    usecase: parsed.description ? String(parsed.description) : "",
    group_key: (parsed.annotations as Record<string, unknown> | undefined)
      ?.kg_group_key
      ? String((parsed.annotations as Record<string, unknown>).kg_group_key)
      : undefined,
    base_iri: baseIri,
    prefixes:
      parsed.prefixes && typeof parsed.prefixes === "object"
        ? (parsed.prefixes as Record<string, string>)
        : undefined,
    imports: Array.isArray(parsed.imports)
      ? (parsed.imports as string[])
      : undefined,
  }

  const notes: OntologyNoteSnapshot[] = []
  const localizedTexts: OntologyLocalizedTextSnapshot[] = []
  const examples: OntologyExampleSnapshot[] = []

  // Document notes and localized texts
  extractNotes(
    parsed.annotations as Record<string, unknown> | undefined,
    "ontology",
    document.id,
    notes
  )
  extractLocalizedTexts(
    parsed.annotations as Record<string, unknown> | undefined,
    "ontology",
    document.id,
    localizedTexts
  )

  // Subsets (Modules)
  const modules: OntologyModuleSnapshot[] = []
  if (parsed.subsets && typeof parsed.subsets === "object") {
    for (const [subsetKey, subsetRaw] of Object.entries(parsed.subsets)) {
      const subsetDef = (subsetRaw || {}) as Record<string, unknown>
      const modAnnotations = subsetDef.annotations as
        Record<string, unknown> | undefined
      const modName = modAnnotations?.kg_name
        ? String(modAnnotations.kg_name)
        : subsetDef.name
          ? String(subsetDef.name)
          : subsetKey

      modules.push({
        id: subsetKey,
        name: modName,
        description: subsetDef.description ? String(subsetDef.description) : "",
      })

      extractNotes(modAnnotations, "module", subsetKey, notes)
      extractLocalizedTexts(modAnnotations, "module", subsetKey, localizedTexts)
    }
  }

  // Classes, Attributes, Restrictions, Disjointness
  const classes: OntologyClassSnapshot[] = []
  const attributes: OntologyAttributeSnapshot[] = []
  const restrictions: OntologyClassRestrictionSnapshot[] = []
  const disjointness: OntologyClassDisjointnessSnapshot[] = []

  if (parsed.classes && typeof parsed.classes === "object") {
    for (const [classKey, classRaw] of Object.entries(parsed.classes)) {
      const classDef = (classRaw || {}) as Record<string, unknown>
      const classAttributes: OntologyAttributeSnapshot[] = []
      const classRestrictions: OntologyClassRestrictionSnapshot[] = []

      // Attributes
      if (classDef.attributes && typeof classDef.attributes === "object") {
        for (const [attrName, attrRaw] of Object.entries(classDef.attributes)) {
          const attrDef = (attrRaw || {}) as Record<string, unknown>
          const attrId = makeAttributeKey(classKey, attrName)
          const attrAnnotations = attrDef.annotations as
            Record<string, unknown> | undefined
          const dataType =
            attrAnnotations?.kg_data_type || attrDef.range || "string"

          const attrSnapshot: OntologyAttributeSnapshot = {
            id: attrId,
            class_id: classKey,
            name: attrName,
            data_type: String(dataType),
            required: attrDef.required === true,
            description: attrDef.description ? String(attrDef.description) : "",
          }
          attributes.push(attrSnapshot)
          classAttributes.push(attrSnapshot)

          extractNotes(attrAnnotations, "attribute", attrId, notes)
          extractLocalizedTexts(
            attrAnnotations,
            "attribute",
            attrId,
            localizedTexts
          )
          extractExamples(attrAnnotations, "attribute", attrId, examples)
        }
      }

      // Slot usage (Restrictions)
      if (classDef.slot_usage && typeof classDef.slot_usage === "object") {
        for (const [targetKey, usageRaw] of Object.entries(
          classDef.slot_usage
        )) {
          const usage = (usageRaw || {}) as Record<string, unknown>
          const isClassAttribute =
            classDef.attributes &&
            typeof classDef.attributes === "object" &&
            targetKey in classDef.attributes
          const isSlot =
            parsed.slots &&
            typeof parsed.slots === "object" &&
            targetKey in parsed.slots

          let relationId: string | null = null
          let attributeId: string | null = null

          if (isClassAttribute && !isSlot) {
            attributeId = makeAttributeKey(classKey, targetKey)
          } else {
            const slotDef = (
              parsed.slots as Record<string, unknown> | undefined
            )?.[targetKey] as Record<string, unknown> | undefined
            const slotAnnotations = slotDef?.annotations as
              Record<string, unknown> | undefined
            relationId = slotAnnotations?.kg_relation_id
              ? String(slotAnnotations.kg_relation_id)
              : targetKey
          }

          if (usage.minimum_cardinality !== undefined) {
            const rest: OntologyClassRestrictionSnapshot = {
              id: `${classKey}:${targetKey}:min`,
              class_id: classKey,
              relation_id: relationId,
              attribute_id: attributeId,
              restriction_type: "min",
              cardinality_value: Number(usage.minimum_cardinality),
            }
            restrictions.push(rest)
            classRestrictions.push(rest)
          }
          if (usage.maximum_cardinality !== undefined) {
            const rest: OntologyClassRestrictionSnapshot = {
              id: `${classKey}:${targetKey}:max`,
              class_id: classKey,
              relation_id: relationId,
              attribute_id: attributeId,
              restriction_type: "max",
              cardinality_value: Number(usage.maximum_cardinality),
            }
            restrictions.push(rest)
            classRestrictions.push(rest)
          }
          if (usage.exact_cardinality !== undefined) {
            const rest: OntologyClassRestrictionSnapshot = {
              id: `${classKey}:${targetKey}:exact`,
              class_id: classKey,
              relation_id: relationId,
              attribute_id: attributeId,
              restriction_type: "exact",
              cardinality_value: Number(usage.exact_cardinality),
            }
            restrictions.push(rest)
            classRestrictions.push(rest)
          }
        }
      }

      // Disjointness
      const disjointList: string[] = []
      if (Array.isArray(classDef.disjoint_with)) {
        for (const target of classDef.disjoint_with) {
          disjointList.push(String(target))
          disjointness.push({
            class_id: classKey,
            disjoint_class_id: String(target),
          })
        }
      }

      // Class notes, localized texts, examples
      const classAnnotations = classDef.annotations as
        Record<string, unknown> | undefined
      extractNotes(classAnnotations, "class", classKey, notes)
      extractLocalizedTexts(classAnnotations, "class", classKey, localizedTexts)
      extractExamples(classAnnotations, "class", classKey, examples)

      if (Array.isArray(classDef.examples) && !classAnnotations?.kg_examples) {
        for (const ex of classDef.examples) {
          if (ex && typeof ex.value === "string") {
            examples.push({
              target_type: "class",
              target_id: classKey,
              value: ex.value,
            })
          }
        }
      }

      const moduleId =
        Array.isArray(classDef.in_subset) && classDef.in_subset.length > 0
          ? String(classDef.in_subset[0])
          : null

      const classSnapshot: OntologyClassSnapshot = {
        id: classKey,
        name: classDef.name ? String(classDef.name) : classKey,
        description: classDef.description ? String(classDef.description) : "",
        module_id: moduleId,
        parent_class_id: classDef.is_a ? String(classDef.is_a) : null,
        instance_policy: classAnnotations?.kg_instance_policy
          ? String(classAnnotations.kg_instance_policy)
          : undefined,
        disjoint_with: disjointList.length > 0 ? disjointList : undefined,
        disjoint_with_class_ids:
          disjointList.length > 0 ? disjointList : undefined,
        attributes: classAttributes.length > 0 ? classAttributes : undefined,
        restrictions:
          classRestrictions.length > 0 ? classRestrictions : undefined,
      }
      classes.push(classSnapshot)
    }
  }

  // Slots (Relations) & Relation Attributes
  const relations: OntologyRelationSnapshot[] = []
  const relationAttributes: OntologyRelationAttributeSnapshot[] = []

  if (parsed.slots && typeof parsed.slots === "object") {
    for (const [slotKey, slotRaw] of Object.entries(parsed.slots)) {
      const slotDef = (slotRaw || {}) as Record<string, unknown>
      const slotAnnotations = slotDef.annotations as
        Record<string, unknown> | undefined

      // Skip synthetic inverse slots that were emitted purely for LinkML reference integrity
      if (
        slotAnnotations?.kg_synthetic_inverse === true ||
        slotAnnotations?.kg_synthetic_inverse === "true"
      ) {
        continue
      }

      let relName = slotKey
      if (slotAnnotations?.kg_display_name) {
        relName = String(slotAnnotations.kg_display_name)
      } else if (
        typeof slotDef.slot_uri === "string" &&
        !slotDef.slot_uri.includes("://") &&
        !slotDef.slot_uri.includes("/")
      ) {
        relName = String(slotDef.slot_uri)
      } else if (slotKey.includes("__")) {
        const parts = slotKey.split("__")
        if (parts.length >= 2) {
          relName = parts[1]
        }
      }

      const relId = slotAnnotations?.kg_relation_id
        ? String(slotAnnotations.kg_relation_id)
        : slotKey

      const cardinality =
        slotAnnotations?.kg_cardinality ||
        deriveCardinalityFromLinkml(
          slotDef as {
            multivalued?: boolean
            required?: boolean
            minimum_cardinality?: number
            maximum_cardinality?: number
          }
        )

      // Fallback domain if slot has no domain: check which class listed slot in its slots
      let domainClass = slotDef.domain ? String(slotDef.domain) : ""
      if (!domainClass) {
        const owningClass = classes.find((c) => {
          const clsSlots = (
            (parsed.classes as Record<string, unknown> | undefined)?.[c.id] as
              Record<string, unknown> | undefined
          )?.slots
          return (
            Array.isArray(clsSlots) && (clsSlots as string[]).includes(slotKey)
          )
        })
        if (owningClass) {
          domainClass = owningClass.id
        }
      }

      const relSnapshot: OntologyRelationSnapshot = {
        id: relId,
        name: relName,
        domain_class_id: domainClass,
        range_class_id: slotDef.range ? String(slotDef.range) : "",
        description: slotDef.description ? String(slotDef.description) : "",
        inverse_name: slotDef.inverse ? String(slotDef.inverse) : null,
        cardinality: String(cardinality),
        instance_policy: slotAnnotations?.kg_instance_policy
          ? String(slotAnnotations.kg_instance_policy)
          : undefined,
      }
      relations.push(relSnapshot)

      // Relation attributes
      const rawRelAttrs = parseAnnotationPayload<unknown>(
        slotAnnotations?.kg_relation_attributes
      )
      if (Array.isArray(rawRelAttrs)) {
        for (const raRaw of rawRelAttrs as Array<Record<string, unknown>>) {
          const ra = raRaw || {}
          const raName = String(ra.name || "")
          const raId = ra.id
            ? String(ra.id)
            : makeRelationAttributeKey(relId, raName)

          relationAttributes.push({
            id: raId,
            relation_id: relId,
            name: raName,
            data_type: ra.data_type ? String(ra.data_type) : "string",
            required: typeof ra.required === "boolean" ? ra.required : null,
            description: ra.description ? String(ra.description) : "",
            sort_order: typeof ra.sort_order === "number" ? ra.sort_order : 0,
          })

          extractNotes(
            ra.annotations as Record<string, unknown> | undefined,
            "relation_attribute",
            raId,
            notes
          )
          extractLocalizedTexts(
            ra.annotations as Record<string, unknown> | undefined,
            "relation_attribute",
            raId,
            localizedTexts
          )
          extractExamples(
            ra.annotations as Record<string, unknown> | undefined,
            "relation_attribute",
            raId,
            examples
          )
        }
      }

      extractNotes(slotAnnotations, "relation", relId, notes)
      extractLocalizedTexts(slotAnnotations, "relation", relId, localizedTexts)
      extractExamples(slotAnnotations, "relation", relId, examples)
    }
  }

  // UI Layout
  let effectiveUiLayout = uiLayout
  const rootAnnotations = parsed.annotations as
    Record<string, unknown> | undefined
  if (!effectiveUiLayout && rootAnnotations?.kg_ui_layout) {
    effectiveUiLayout = parseAnnotationPayload<OntologyUiLayout>(
      rootAnnotations.kg_ui_layout
    )
  }

  return {
    document,
    modules,
    classes,
    attributes,
    relations,
    relation_attributes: relationAttributes,
    ...(restrictions.length > 0 ? { restrictions } : {}),
    ...(disjointness.length > 0 ? { disjointness } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(localizedTexts.length > 0 ? { localized_texts: localizedTexts } : {}),
    ...(effectiveUiLayout ? { ui_layout: effectiveUiLayout } : {}),
  }
}

/**
 * Converts an ImportOntology payload into a CanonicalOntologySnapshot.
 */
export function importOntologyToSnapshot(
  ontology: ImportOntology,
  baseIri?: string
): CanonicalOntologySnapshot {
  const docId = ontology.name
    ? ontology.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
    : "ontology"

  const docBaseIri =
    baseIri ||
    (ontology as { baseIri?: string }).baseIri ||
    `https://example.org/${docId}#`

  const prefixes: Record<string, string> = {
    ...KNOWN_ONTOLOGY_PREFIXES,
    ont:
      docBaseIri.endsWith("#") || docBaseIri.endsWith("/")
        ? docBaseIri
        : `${docBaseIri}#`,
    linkml: "https://w3id.org/linkml/",
    ex: "https://example.org/",
  }

  // Scan class and relation names for any prefixes
  for (const c of ontology.classes || []) {
    const colonIdx = c.name?.indexOf(":") ?? -1
    if (colonIdx > 0) {
      const p = c.name.slice(0, colonIdx)
      if (!prefixes[p]) {
        prefixes[p] = `https://example.org/${p}#`
      }
    }
  }
  for (const r of ontology.relations || []) {
    const colonIdx = r.name?.indexOf(":") ?? -1
    if (colonIdx > 0) {
      const p = r.name.slice(0, colonIdx)
      if (!prefixes[p]) {
        prefixes[p] = `https://example.org/${p}#`
      }
    }
  }

  const usecaseStr =
    typeof ontology.usecase === "string" ? ontology.usecase : ""

  const document: OntologyDocumentSnapshot = {
    id: docId,
    name: ontology.name || "ontology",
    version: ontology.version ?? null,
    default_language: ontology.defaultLanguage || "en",
    usecase: usecaseStr,
    base_iri: docBaseIri,
    prefixes,
    imports: ["linkml:types"],
  }

  const modules: OntologyModuleSnapshot[] = (ontology.modules || []).map(
    (m) => ({
      id: m.id || m.name,
      name: m.name,
      description: m.description,
    })
  )

  const defaultModuleId = modules[0]?.id || "default-module"

  const classKeyById = new Map<string, string>()
  for (const c of ontology.classes || []) {
    const key = c.name || c.id || ""
    if (c.id) classKeyById.set(c.id, key)
    if (c.name) classKeyById.set(c.name, key)
  }

  const allAttributes: OntologyAttributeSnapshot[] = []
  const allRestrictions: OntologyClassRestrictionSnapshot[] = []
  const disjointness: OntologyClassDisjointnessSnapshot[] = []

  const classes: OntologyClassSnapshot[] = (ontology.classes || []).map(
    (cls) => {
      const classKey = cls.name || cls.id || ""
      const classAttrs: OntologyAttributeSnapshot[] = (
        cls.attributes || []
      ).map((a) => {
        const attrKey = a.name
        const attrId = a.id || makeAttributeKey(classKey, attrKey)
        return {
          id: attrId,
          class_id: classKey,
          name: a.name,
          data_type: a.dataType,
          required: a.required ?? false,
          description: a.description,
        }
      })

      allAttributes.push(...classAttrs)

      const classRestrictions: OntologyClassRestrictionSnapshot[] = (
        cls.restrictions || []
      ).map((r, idx) => ({
        id: `${classKey}:restriction:${idx + 1}`,
        class_id: classKey,
        relation_id: r.propertyIri ?? null,
        attribute_id: null,
        restriction_type: r.type,
        cardinality_value: r.cardinality ?? 1,
      }))

      allRestrictions.push(...classRestrictions)

      const disjointList: string[] = []
      if (cls.disjointWithClassIds) {
        for (const target of cls.disjointWithClassIds) {
          const resolved = classKeyById.get(target) || target
          if (!disjointList.includes(resolved)) {
            disjointList.push(resolved)
            disjointness.push({
              class_id: classKey,
              disjoint_class_id: resolved,
            })
          }
        }
      }

      const parentClassKey = cls.parentClassId
        ? classKeyById.get(cls.parentClassId) || cls.parentClassId
        : null

      return {
        id: classKey,
        name: cls.name,
        description: cls.description,
        module_id: cls.moduleId ?? (cls.module ? cls.module : defaultModuleId),
        parent_class_id: parentClassKey,
        disjoint_with: disjointList.length > 0 ? disjointList : undefined,
        disjoint_with_class_ids:
          disjointList.length > 0 ? disjointList : undefined,
        attributes: classAttrs,
        restrictions:
          classRestrictions.length > 0 ? classRestrictions : undefined,
      }
    }
  )

  const relations: OntologyRelationSnapshot[] = (ontology.relations || []).map(
    (r) => {
      const domainKey = classKeyById.get(r.domainClassId) || r.domainClassId
      const rangeKey = classKeyById.get(r.rangeClassId) || r.rangeClassId
      return {
        id: r.id || r.name,
        name: r.name,
        domain_class_id: domainKey,
        range_class_id: rangeKey,
        description: r.description,
        inverse_name: r.inverseName ?? null,
        cardinality: r.cardinality ?? null,
        instance_policy: (r as { instancePolicy?: string }).instancePolicy,
      }
    }
  )

  const relationAttributes: OntologyRelationAttributeSnapshot[] = (
    ontology.relationAttributes || []
  ).map((ra) => ({
    id: ra.id || makeRelationAttributeKey(ra.relationId, ra.name),
    relation_id: ra.relationId,
    name: ra.name,
    data_type: ra.dataType,
    required: ra.required ?? false,
    description: ra.description,
    sort_order: ra.sortOrder,
  }))

  const notes: OntologyNoteSnapshot[] = (ontology.notes || []).map((n) => ({
    id: n.id,
    target_type: n.targetType,
    target_id: n.targetId,
    body: n.body,
    author_name: n.authorName,
    sort_order: n.sortOrder,
  }))

  const examples: OntologyExampleSnapshot[] = (ontology.examples || []).map(
    (e) => ({
      id: e.id,
      target_type: e.targetType,
      target_id: e.targetId,
      value: e.value,
      subject_label: e.subjectLabel,
      predicate_label: e.predicateLabel,
      object_label: e.objectLabel,
      is_instance_candidate: e.isInstanceCandidate,
      sort_order: e.sortOrder,
    })
  )

  const localizedTexts: OntologyLocalizedTextSnapshot[] = (
    ontology.localizedTexts || []
  ).map((lt) => ({
    id: (lt as { id?: string }).id,
    target_type: lt.targetType,
    target_id: lt.targetId,
    field_name: lt.fieldName,
    language_code: lt.languageCode,
    value: lt.value,
  }))

  let uiLayout: OntologyUiLayout | undefined
  if (ontology.visual) {
    const classPositions: Record<
      string,
      Record<string, { x: number; y: number }>
    > = {}
    for (const cp of ontology.visual.classPositions || []) {
      const mod = cp.moduleId || cp.module || defaultModuleId
      if (!classPositions[mod]) classPositions[mod] = {}
      classPositions[mod][cp.classId] = { x: cp.x, y: cp.y }
    }
    const moduleLayouts: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {}
    for (const ml of ontology.visual.moduleLayouts || []) {
      const mod = ml.moduleId || ml.module || defaultModuleId
      moduleLayouts[mod] = {
        x: ml.x,
        y: ml.y,
        width: ml.width,
        height: ml.height,
      }
    }
    uiLayout = { classPositions, moduleLayouts }
  }

  return {
    document,
    modules,
    classes,
    attributes: allAttributes,
    relations,
    relation_attributes: relationAttributes,
    ...(allRestrictions.length > 0 ? { restrictions: allRestrictions } : {}),
    ...(disjointness.length > 0 ? { disjointness } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    ...(examples.length > 0 ? { examples } : {}),
    ...(localizedTexts.length > 0 ? { localized_texts: localizedTexts } : {}),
    ...(uiLayout ? { ui_layout: uiLayout } : {}),
  }
}

/**
 * Converts a CanonicalOntologySnapshot into an ImportOntology structure.
 */
export function snapshotToImportOntology(
  snapshot: CanonicalOntologySnapshot,
  options: ParseTurtleOptions = {}
): ImportOntology {
  const defaultLanguage =
    options.defaultLanguage ?? snapshot.document.default_language ?? "en"

  const ontologyName =
    options.fileName?.replace(/\.[^/.]+$/, "") ||
    snapshot.document.name ||
    "Imported Ontology"

  const defaultModuleId = "default-module"
  const defaultModuleName = ontologyName

  const modules: ImportOntology["modules"] =
    snapshot.modules.length > 0
      ? snapshot.modules.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description ?? "",
        }))
      : [
          {
            id: defaultModuleId,
            name: defaultModuleName,
            description: snapshot.document.usecase ?? "",
          },
        ]

  const classes: ImportClass[] = snapshot.classes.map((c, idx) => {
    const classId = c.id || `cls-${idx + 1}`
    const attrs = [
      ...(c.attributes || []),
      ...snapshot.attributes.filter(
        (a) => a.class_id === c.id || a.class_id === c.name
      ),
    ]
    const seenAttrs = new Set<string>()
    const importAttrs = []
    for (const a of attrs) {
      if (seenAttrs.has(a.name)) continue
      seenAttrs.add(a.name)
      importAttrs.push({
        id: a.id || `attr-${classId}-${a.name}`,
        name: a.name,
        dataType: normalizeOntologyDataTypeOrDefault(a.data_type),
        required: Boolean(a.required),
        description: a.description ?? "",
      })
    }

    const restrictions = (c.restrictions || []).map((r) => ({
      propertyIri: r.relation_id || r.attribute_id || "owl:topObjectProperty",
      type:
        (r.restriction_type as "exact" | "min" | "max" | "some" | "all") ||
        "exact",
      cardinality: r.cardinality_value,
    }))

    return {
      id: classId,
      name: c.name,
      description: c.description ?? "",
      moduleId: c.module_id || defaultModuleId,
      module: defaultModuleName,
      parentClassId: c.parent_class_id ?? null,
      disjointWithClassIds: c.disjoint_with_class_ids || c.disjoint_with,
      attributes: importAttrs,
      restrictions: restrictions.length > 0 ? restrictions : undefined,
    }
  })

  const relations: ImportRelation[] = snapshot.relations.map((r, idx) => ({
    id: r.id || `rel-${idx + 1}`,
    name: r.name,
    domainClassId: r.domain_class_id,
    rangeClassId: r.range_class_id,
    description: r.description ?? "",
    inverseName: r.inverse_name ?? null,
    cardinality: r.cardinality ?? null,
  }))

  const relationAttributes: ImportRelationAttribute[] =
    snapshot.relation_attributes.map((ra, idx) => ({
      id: ra.id || `ra-${idx + 1}`,
      relationId: ra.relation_id,
      name: ra.name,
      dataType: normalizeOntologyDataTypeOrDefault(ra.data_type),
      required: Boolean(ra.required),
      description: ra.description ?? "",
      sortOrder: ra.sort_order ?? idx + 1,
    }))

  const examples: ImportExample[] = (snapshot.examples || []).map((e, idx) => ({
    id: e.id || `ex-${idx + 1}`,
    targetType:
      (e.target_type as
        "class" | "attribute" | "relation" | "relation_attribute" | "cq") ||
      "class",
    targetId: e.target_id,
    value: e.value,
    subjectLabel: e.subject_label ?? null,
    predicateLabel: e.predicate_label ?? null,
    objectLabel: e.object_label ?? null,
    isInstanceCandidate: Boolean(e.is_instance_candidate ?? true),
    sortOrder: e.sort_order ?? idx + 1,
  }))

  const notes: ImportNote[] = (snapshot.notes || []).map((n, idx) => ({
    id: n.id || `note-${idx + 1}`,
    targetType:
      (n.target_type as
        | "ontology"
        | "module"
        | "class"
        | "relation"
        | "attribute"
        | "relation_attribute"
        | "cq") || "ontology",
    targetId: n.target_id,
    body: n.body,
    authorName: n.author_name ?? "",
    sortOrder: n.sort_order ?? idx + 1,
  }))

  const localizedTexts: ImportLocalizedText[] = (
    snapshot.localized_texts || []
  ).map((lt) => ({
    targetType:
      (lt.target_type as
        | "ontology"
        | "module"
        | "class"
        | "relation"
        | "attribute"
        | "relation_attribute"
        | "cq") || "ontology",
    targetId: lt.target_id,
    fieldName: lt.field_name,
    languageCode: lt.language_code,
    value: lt.value,
  }))

  const visual = computeOntologyDagreLayout(
    classes,
    relations,
    defaultModuleName,
    defaultModuleId
  )

  return {
    defaultLanguage,
    languages: [{ code: defaultLanguage, label: "English" }],
    name: ontologyName,
    usecase: snapshot.document.usecase ?? "",
    version: snapshot.document.version ?? null,
    modules,
    classes,
    relations,
    relationAttributes,
    competencyQuestions: [],
    notes,
    examples,
    localizedTexts,
    visual,
  }
}
