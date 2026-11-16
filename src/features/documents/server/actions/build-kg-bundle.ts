import { DataFactory, Writer as N3Writer } from "n3"
import type {
  CompiledOntologyArtifacts,
  OhiLockfileV2,
} from "@/features/ontology/server/linkml/types"

const { literal, namedNode } = DataFactory

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#"
const XSD_NS = "http://www.w3.org/2001/XMLSchema#"
const PROV_NS = "http://www.w3.org/ns/prov#"
const DCTERMS_NS = "http://purl.org/dc/terms/"
const OHI_NS = "https://ohi.dev/ns#"
const DEFAULT_KG_BASE = "https://ohi.dev/kg/"
const DEFAULT_ONT_BASE = "https://ohi.dev/ontology#"

export interface KnowledgeGraphExportBundle {
  documentId: string
  documentTitle: string
  ontologyId: string | null
  ontologySha256: string | null
  runId: string | null
  stats: {
    entitiesCount: number
    factsCount: number
    lockedPackagesCount: number
  }
  files: {
    instances_ttl: string
    rdfs_ttl: string
    shacl_ttl: string
    pydantic_py: string
    instances_json: string
    ohi_lock_json: string
  }
}

export interface BundleDocumentInput {
  id: string
  title: string
}

export interface BundleOntologyInput {
  id: string
  name?: string | null
  baseIri?: string | null
  ohiLockfile?: OhiLockfileV2 | null
}

export interface BundleRunInput {
  id: string
  ontology_id?: string | null
  ontology_sha256?: string | null
  ohi_lockfile_snapshot?: OhiLockfileV2 | null
  started_at?: string | null
  completed_at?: string | null
}

export interface BundleEntityInput {
  id: string
  entity_text: string
  class_id: string | null
  review_status: string
}

export interface BundleEntityAttributeInput {
  entity_id: string
  attribute_id: string
  data_type?: string | null
  value: string
}

export interface BundleFactInput {
  id: string
  subject_entity_id: string | null
  subject_text: string
  relation_type_id: string | null
  relation_text: string
  object_entity_id: string | null
  object_text: string
  review_status: string
  confidence?: number | null
  anchor_ids?: string[]
}

export interface BundleEvidenceAnchorInput {
  id: string
  quote_text: string
  page_from?: number | null
  page_to?: number | null
}

export interface BuildKnowledgeGraphBundleInput {
  document: BundleDocumentInput
  ontology: BundleOntologyInput | null
  compiledArtifacts: Pick<
    CompiledOntologyArtifacts,
    "rdfs_ttl" | "shacl_ttl" | "pydantic_py" | "source_sha256"
  > | null
  latestRun: BundleRunInput | null
  entities: BundleEntityInput[]
  entityAttributes: BundleEntityAttributeInput[]
  facts: BundleFactInput[]
  evidenceAnchors: BundleEvidenceAnchorInput[]
}

function sanitizeLocalName(raw: string): string {
  const trimmed = raw.trim()
  const cleaned = trimmed.replace(/[^A-Za-z0-9_.-]+/g, "_")
  return cleaned.length > 0 ? cleaned : "item"
}

function normalizeOntologyBaseIri(baseIri: string | null | undefined): string {
  if (!baseIri || baseIri.trim() === "") {
    return DEFAULT_ONT_BASE
  }
  const trimmed = baseIri.trim()
  return trimmed.endsWith("/") || trimmed.endsWith("#")
    ? trimmed
    : `${trimmed}#`
}

function extractAttributeKey(attributeId: string): string {
  const lastSegment = attributeId.split(".").pop()
  return lastSegment && lastSegment.trim() !== "" ? lastSegment.trim() : attributeId
}

function resolveXsdDatatypeIri(dataType: string | null | undefined): string {
  if (!dataType) return `${XSD_NS}string`
  const normalized = dataType.trim()
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized
  }
  if (normalized.startsWith("xsd:")) {
    return `${XSD_NS}${normalized.slice(4)}`
  }
  switch (normalized.toLowerCase()) {
    case "integer":
    case "int":
      return `${XSD_NS}integer`
    case "decimal":
    case "number":
      return `${XSD_NS}decimal`
    case "float":
      return `${XSD_NS}float`
    case "double":
      return `${XSD_NS}double`
    case "boolean":
    case "bool":
      return `${XSD_NS}boolean`
    case "datetime":
    case "date":
      return `${XSD_NS}dateTime`
    case "anyuri":
    case "uri":
      return `${XSD_NS}anyURI`
    default:
      return `${XSD_NS}string`
  }
}

function coerceAttributeValueForJson(
  value: string,
  dataType: string | null | undefined
): string | number | boolean {
  const dt = (dataType ?? "").toLowerCase()
  if (
    dt === "xsd:integer" ||
    dt === "xsd:int" ||
    dt === "xsd:long" ||
    dt === "xsd:short" ||
    dt === "xsd:nonnegativeinteger" ||
    dt === "xsd:positiveinteger" ||
    dt === "integer" ||
    dt === "int"
  ) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed) && String(parsed) === value.trim()) {
      return parsed
    }
  }
  if (
    dt === "xsd:decimal" ||
    dt === "xsd:float" ||
    dt === "xsd:double" ||
    dt === "owl:real" ||
    dt === "decimal" ||
    dt === "float" ||
    dt === "double" ||
    dt === "number"
  ) {
    const parsed = Number.parseFloat(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  if (dt === "xsd:boolean" || dt === "boolean" || dt === "bool") {
    const lower = value.trim().toLowerCase()
    if (lower === "true" || lower === "1") return true
    if (lower === "false" || lower === "0") return false
  }
  return value
}

function resolveLockfileSnapshot(
  latestRun: BundleRunInput | null,
  ontology: BundleOntologyInput | null
): OhiLockfileV2 {
  const snapshot = latestRun?.ohi_lockfile_snapshot ?? ontology?.ohiLockfile
  if (!snapshot) {
    return { lock_version: 2, selections: [], files: [] }
  }
  return {
    lock_version: 2,
    selections: Array.isArray(snapshot.selections) ? snapshot.selections : [],
    files: Array.isArray(snapshot.files) ? snapshot.files : [],
  }
}

function serializeTurtle(
  prefixes: Record<string, string>,
  populate: (writer: N3Writer) => void
): string {
  const writer = new N3Writer({ prefixes })
  populate(writer)
  let output = ""
  let writerError: Error | null = null
  writer.end((err, result) => {
    if (err) {
      writerError = err
    } else {
      output = result
    }
  })
  if (writerError) {
    throw writerError
  }
  return output
}

/**
 * Pure builder that assembles a complete W3C PROV-O + SHACL + RDFS + Pydantic v2
 * Knowledge Graph export bundle from accepted document entities, facts, anchors,
 * compiled LinkML artifacts, and ohi.lock.json provenance.
 */
export function buildKnowledgeGraphBundle(
  input: BuildKnowledgeGraphBundleInput
): KnowledgeGraphExportBundle {
  const {
    document,
    ontology,
    compiledArtifacts,
    latestRun,
    entities,
    entityAttributes,
    facts,
    evidenceAnchors,
  } = input

  const acceptedEntities = entities.filter(
    (entity) => entity.review_status === "accepted"
  )
  const acceptedFacts = facts.filter((fact) => fact.review_status === "accepted")
  const lockfile = resolveLockfileSnapshot(latestRun, ontology)
  const ontologyId = latestRun?.ontology_id ?? ontology?.id ?? null
  const ontologySha256 =
    latestRun?.ontology_sha256 ?? compiledArtifacts?.source_sha256 ?? null
  const runId = latestRun?.id ?? null

  const kgBase = `${DEFAULT_KG_BASE}${encodeURIComponent(document.id)}/`
  const ontBase = normalizeOntologyBaseIri(ontology?.baseIri)

  const attributesByEntityId = new Map<string, BundleEntityAttributeInput[]>()
  for (const attr of entityAttributes) {
    const list = attributesByEntityId.get(attr.entity_id) ?? []
    list.push(attr)
    attributesByEntityId.set(attr.entity_id, list)
  }

  const anchorsById = new Map(
    evidenceAnchors.map((anchor) => [anchor.id, anchor])
  )

  const instancesTtl = serializeTurtle(
    {
      kg: kgBase,
      ont: ontBase,
      rdf: RDF_NS,
      rdfs: RDFS_NS,
      xsd: XSD_NS,
      prov: PROV_NS,
      dcterms: DCTERMS_NS,
      ohi: OHI_NS,
    },
    (writer) => {
      const runNode = runId ? namedNode(`${kgBase}run/${encodeURIComponent(runId)}`) : null
      const docNode = namedNode(`${kgBase}document/${encodeURIComponent(document.id)}`)
      const graphNode = namedNode(`${kgBase}graph`)

      writer.addQuad(docNode, namedNode(`${RDF_NS}type`), namedNode(`${PROV_NS}Entity`))
      writer.addQuad(docNode, namedNode(`${RDFS_NS}label`), literal(document.title))
      writer.addQuad(docNode, namedNode(`${DCTERMS_NS}title`), literal(document.title))

      writer.addQuad(graphNode, namedNode(`${RDF_NS}type`), namedNode(`${PROV_NS}Entity`))

      if (runNode && latestRun) {
        writer.addQuad(
          runNode,
          namedNode(`${RDF_NS}type`),
          namedNode(`${PROV_NS}Activity`)
        )
        if (latestRun.started_at) {
          writer.addQuad(
            runNode,
            namedNode(`${PROV_NS}startedAtTime`),
            literal(latestRun.started_at, namedNode(`${XSD_NS}dateTime`))
          )
        }
        if (latestRun.completed_at) {
          writer.addQuad(
            runNode,
            namedNode(`${PROV_NS}endedAtTime`),
            literal(latestRun.completed_at, namedNode(`${XSD_NS}dateTime`))
          )
        }
        writer.addQuad(runNode, namedNode(`${PROV_NS}used`), docNode)
        writer.addQuad(graphNode, namedNode(`${PROV_NS}wasGeneratedBy`), runNode)

        if (ontologyId) {
          const ontNode = namedNode(
            `${kgBase}ontology/${encodeURIComponent(ontologyId)}`
          )
          writer.addQuad(
            ontNode,
            namedNode(`${RDF_NS}type`),
            namedNode(`${PROV_NS}Entity`)
          )
          if (ontology?.name) {
            writer.addQuad(
              ontNode,
              namedNode(`${RDFS_NS}label`),
              literal(ontology.name)
            )
          }
          if (ontologySha256) {
            writer.addQuad(
              ontNode,
              namedNode(`${OHI_NS}sha256`),
              literal(ontologySha256)
            )
          }
          writer.addQuad(runNode, namedNode(`${PROV_NS}used`), ontNode)
        }

        for (let idx = 0; idx < lockfile.files.length; idx += 1) {
          const lockedFile = lockfile.files[idx]
          const pkgNode = namedNode(
            `${kgBase}ohi-package/${idx}-${sanitizeLocalName(lockedFile.package_path)}`
          )
          writer.addQuad(
            pkgNode,
            namedNode(`${RDF_NS}type`),
            namedNode(`${PROV_NS}Entity`)
          )
          writer.addQuad(
            pkgNode,
            namedNode(`${RDFS_NS}label`),
            literal(lockedFile.package_path)
          )
          writer.addQuad(
            pkgNode,
            namedNode(`${OHI_NS}sha256`),
            literal(lockedFile.sha256)
          )
          writer.addQuad(
            pkgNode,
            namedNode(`${OHI_NS}baseUrl`),
            literal(lockedFile.base_url)
          )
          writer.addQuad(
            pkgNode,
            namedNode(`${OHI_NS}downloadUrl`),
            literal(lockedFile.url)
          )
          writer.addQuad(
            pkgNode,
            namedNode(`${OHI_NS}format`),
            literal(lockedFile.format)
          )
          writer.addQuad(runNode, namedNode(`${PROV_NS}used`), pkgNode)
        }
      }

      const acceptedEntityNodeById = new Map<string, ReturnType<typeof namedNode>>()

      for (const entity of acceptedEntities) {
        const entityNode = namedNode(
          `${kgBase}entity/${encodeURIComponent(entity.id)}`
        )
        acceptedEntityNodeById.set(entity.id, entityNode)

        if (entity.class_id) {
          writer.addQuad(
            entityNode,
            namedNode(`${RDF_NS}type`),
            namedNode(`${ontBase}${sanitizeLocalName(entity.class_id)}`)
          )
        }
        writer.addQuad(
          entityNode,
          namedNode(`${RDF_NS}type`),
          namedNode(`${PROV_NS}Entity`)
        )
        writer.addQuad(
          entityNode,
          namedNode(`${RDFS_NS}label`),
          literal(entity.entity_text)
        )
        if (runNode) {
          writer.addQuad(entityNode, namedNode(`${PROV_NS}wasGeneratedBy`), runNode)
        }

        const attrs = attributesByEntityId.get(entity.id) ?? []
        for (const attr of attrs) {
          const attrKey = sanitizeLocalName(extractAttributeKey(attr.attribute_id))
          const datatypeIri = resolveXsdDatatypeIri(attr.data_type)
          writer.addQuad(
            entityNode,
            namedNode(`${ontBase}${attrKey}`),
            literal(attr.value, namedNode(datatypeIri))
          )
        }
      }

      const emittedAnchorIds = new Set<string>()

      for (const fact of acceptedFacts) {
        const subjectNode =
          (fact.subject_entity_id
            ? acceptedEntityNodeById.get(fact.subject_entity_id)
            : undefined) ??
          namedNode(`${kgBase}mention/${encodeURIComponent(fact.id)}/subject`)

        if (
          !fact.subject_entity_id ||
          !acceptedEntityNodeById.has(fact.subject_entity_id)
        ) {
          writer.addQuad(
            subjectNode,
            namedNode(`${RDFS_NS}label`),
            literal(fact.subject_text)
          )
        }

        const objectNode =
          (fact.object_entity_id
            ? acceptedEntityNodeById.get(fact.object_entity_id)
            : undefined) ??
          namedNode(`${kgBase}mention/${encodeURIComponent(fact.id)}/object`)

        if (
          !fact.object_entity_id ||
          !acceptedEntityNodeById.has(fact.object_entity_id)
        ) {
          writer.addQuad(
            objectNode,
            namedNode(`${RDFS_NS}label`),
            literal(fact.object_text)
          )
        }

        const predicateKey = sanitizeLocalName(
          fact.relation_type_id ?? fact.relation_text
        )
        const predicateNode = namedNode(`${ontBase}${predicateKey}`)

        writer.addQuad(subjectNode, predicateNode, objectNode)

        const factNode = namedNode(`${kgBase}fact/${encodeURIComponent(fact.id)}`)
        writer.addQuad(
          factNode,
          namedNode(`${RDF_NS}type`),
          namedNode(`${RDF_NS}Statement`)
        )
        writer.addQuad(factNode, namedNode(`${RDF_NS}subject`), subjectNode)
        writer.addQuad(factNode, namedNode(`${RDF_NS}predicate`), predicateNode)
        writer.addQuad(factNode, namedNode(`${RDF_NS}object`), objectNode)
        if (runNode) {
          writer.addQuad(factNode, namedNode(`${PROV_NS}wasGeneratedBy`), runNode)
        }

        for (const anchorId of fact.anchor_ids ?? []) {
          const anchor = anchorsById.get(anchorId)
          if (!anchor) continue
          const anchorNode = namedNode(
            `${kgBase}evidence/${encodeURIComponent(anchor.id)}`
          )
          if (!emittedAnchorIds.has(anchor.id)) {
            emittedAnchorIds.add(anchor.id)
            writer.addQuad(
              anchorNode,
              namedNode(`${RDF_NS}type`),
              namedNode(`${PROV_NS}Entity`)
            )
            writer.addQuad(
              anchorNode,
              namedNode(`${DCTERMS_NS}bibliographicCitation`),
              literal(anchor.quote_text)
            )
            writer.addQuad(anchorNode, namedNode(`${PROV_NS}wasDerivedFrom`), docNode)
          }
          writer.addQuad(factNode, namedNode(`${PROV_NS}wasDerivedFrom`), anchorNode)
        }
      }
    }
  )

  const jsonEntities = acceptedEntities.map((entity) => {
    const record: Record<string, unknown> = {
      id: entity.id,
      entity_text: entity.entity_text,
      class_key: entity.class_id,
    }
    const attrs = attributesByEntityId.get(entity.id) ?? []
    for (const attr of attrs) {
      const key = extractAttributeKey(attr.attribute_id)
      record[key] = coerceAttributeValueForJson(attr.value, attr.data_type)
    }
    return record
  })

  const jsonFacts = acceptedFacts.map((fact) => ({
    id: fact.id,
    subject_entity_id: fact.subject_entity_id,
    subject_text: fact.subject_text,
    relation_key: fact.relation_type_id ?? fact.relation_text,
    relation_text: fact.relation_text,
    object_entity_id: fact.object_entity_id,
    object_text: fact.object_text,
    confidence: fact.confidence ?? null,
  }))

  const instancesJson = JSON.stringify(
    {
      ontology_id: ontologyId,
      ontology_sha256: ontologySha256,
      entities: jsonEntities,
      facts: jsonFacts,
    },
    null,
    2
  )

  return {
    documentId: document.id,
    documentTitle: document.title,
    ontologyId,
    ontologySha256,
    runId,
    stats: {
      entitiesCount: acceptedEntities.length,
      factsCount: acceptedFacts.length,
      lockedPackagesCount: lockfile.files.length,
    },
    files: {
      instances_ttl: instancesTtl,
      rdfs_ttl: compiledArtifacts?.rdfs_ttl ?? "",
      shacl_ttl: compiledArtifacts?.shacl_ttl ?? "",
      pydantic_py: compiledArtifacts?.pydantic_py ?? "",
      instances_json: instancesJson,
      ohi_lock_json: JSON.stringify(lockfile, null, 2),
    },
  }
}
