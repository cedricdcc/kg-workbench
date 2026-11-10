import { computeSha256 } from "./manifest"
import type { OhiFormat } from "./types"

/**
 * Summary information for an ohi.dev package returned in search results.
 */
export interface OhiPackageSummary {
  namespace: string
  name: string
  package_ref: string
  title: string
  description: string
  latest_version: string
  versions: string[]
  license?: string
  tags?: string[]
}

/**
 * Descriptor for a specific artifact format within a publication.
 */
export interface OhiArtifactDescriptor {
  format: OhiFormat
  package_path: string
  url: string
  sha256: string
  size_bytes?: number
  content?: string
}

/**
 * Full metadata for an immutable publication in ohi.dev.
 */
export interface OhiPublicationMetadata {
  package_ref: string
  namespace: string
  name: string
  version: string
  title: string
  description?: string
  license?: string
  homepage?: string
  base_url: string
  release_url: string
  dependencies: Array<{
    ontology: string
    format?: OhiFormat
  }>
  artifacts: Partial<Record<OhiFormat, OhiArtifactDescriptor>>
}

/**
 * In-memory built-in publication holding metadata and raw artifact contents.
 */
export interface BuiltinPublication {
  metadata: OhiPublicationMetadata
  artifacts: Partial<
    Record<
      OhiFormat,
      {
        format: OhiFormat
        fileName: string
        content: string
        package_path: string
        url: string
        sha256: string
      }
    >
  >
}

/**
 * Parses package reference strings of form "namespace/name@version", "namespace/name", or "name".
 */
export function parsePackageRef(ref: string): {
  namespace?: string
  name: string
  version?: string
  raw: string
} {
  const trimmed = ref.trim()
  const atIdx = trimmed.lastIndexOf("@")
  let version: string | undefined
  let namePart = trimmed

  if (atIdx > 0) {
    version = trimmed.slice(atIdx + 1).trim()
    namePart = trimmed.slice(0, atIdx).trim()
  }

  const slashIdx = namePart.indexOf("/")
  if (slashIdx >= 0) {
    const namespace = namePart.slice(0, slashIdx).trim()
    const name = namePart.slice(slashIdx + 1).trim()
    return { namespace, name, version, raw: trimmed }
  }

  return { name: namePart, version, raw: trimmed }
}

function buildPublication(
  namespace: string,
  name: string,
  version: string,
  title: string,
  description: string,
  license: string,
  baseUrl: string,
  dependencies: Array<{ ontology: string; format?: OhiFormat }>,
  linkmlYamlContent: string,
  owlTurtleContent: string,
  tags: string[] = []
): BuiltinPublication {
  const packageRef = `${namespace}/${name}@${version}`
  const releaseUrl = `https://ohi.dev/${namespace}/${name}/releases/${version}`
  const downloadDir = ".ohi"

  const linkmlFileName = `${name}.linkml.yaml`
  const linkmlPkgPath = `${downloadDir}/${namespace}/${name}/${version}/${linkmlFileName}`
  const linkmlUrl = `${releaseUrl}/artifacts/${linkmlFileName}`
  const linkmlSha256 = computeSha256(linkmlYamlContent)

  const turtleFileName = `${name}.owl.ttl`
  const turtlePkgPath = `${downloadDir}/${namespace}/${name}/${version}/${turtleFileName}`
  const turtleUrl = `${releaseUrl}/artifacts/${turtleFileName}`
  const turtleSha256 = computeSha256(owlTurtleContent)

  const linkmlArtifact = {
    format: "linkml-yaml" as OhiFormat,
    fileName: linkmlFileName,
    package_path: linkmlPkgPath,
    url: linkmlUrl,
    sha256: linkmlSha256,
    size_bytes: Buffer.byteLength(linkmlYamlContent, "utf8"),
    content: linkmlYamlContent,
  }

  const turtleArtifact = {
    format: "owl-turtle" as OhiFormat,
    fileName: turtleFileName,
    package_path: turtlePkgPath,
    url: turtleUrl,
    sha256: turtleSha256,
    size_bytes: Buffer.byteLength(owlTurtleContent, "utf8"),
    content: owlTurtleContent,
  }

  const metadata: OhiPublicationMetadata = {
    package_ref: packageRef,
    namespace,
    name,
    version,
    title,
    description,
    license,
    homepage: baseUrl,
    base_url: baseUrl,
    release_url: releaseUrl,
    dependencies,
    artifacts: {
      "linkml-yaml": linkmlArtifact,
      "owl-turtle": turtleArtifact,
    },
  }

  return {
    metadata,
    artifacts: {
      "linkml-yaml": linkmlArtifact,
      "owl-turtle": turtleArtifact,
    },
  }
}

// ---------------------------------------------------------------------------
// 1. w3c/prov-o@2013
// ---------------------------------------------------------------------------
const PROV_O_LINKML = `id: http://www.w3.org/ns/prov
name: prov
title: W3C PROV-O: The PROV Ontology
version: "2013"
prefixes:
  prov: http://www.w3.org/ns/prov#
  linkml: https://w3id.org/linkml/
default_prefix: prov
imports:
  - linkml:types
classes:
  Entity:
    description: An entity is a physical, digital, conceptual, or other kind of thing with some fixed aspects.
  Activity:
    description: An activity is something that occurs over a period of time and acts upon or with entities.
  Agent:
    description: An agent is something that bears some form of responsibility for an activity taking place.
slots:
  wasGeneratedBy:
    domain: Entity
    range: Activity
  wasDerivedFrom:
    domain: Entity
    range: Entity
  wasAttributedTo:
    domain: Entity
    range: Agent
`

const PROV_O_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

<http://www.w3.org/ns/prov#> a owl:Ontology ;
    rdfs:label "W3C PROV-O: The PROV Ontology" ;
    owl:versionInfo "2013" .

prov:Entity a owl:Class ;
    rdfs:label "Entity" ;
    rdfs:comment "An entity is a physical, digital, conceptual, or other kind of thing with some fixed aspects." .

prov:Activity a owl:Class ;
    rdfs:label "Activity" ;
    rdfs:comment "An activity is something that occurs over a period of time and acts upon or with entities." .

prov:Agent a owl:Class ;
    rdfs:label "Agent" ;
    rdfs:comment "An agent is something that bears some form of responsibility for an activity taking place." .

prov:wasGeneratedBy a owl:ObjectProperty ;
    rdfs:domain prov:Entity ;
    rdfs:range prov:Activity .

prov:wasDerivedFrom a owl:ObjectProperty ;
    rdfs:domain prov:Entity ;
    rdfs:range prov:Entity .

prov:wasAttributedTo a owl:ObjectProperty ;
    rdfs:domain prov:Entity ;
    rdfs:range prov:Agent .
`

// ---------------------------------------------------------------------------
// 2. w3c/dcat@3
// ---------------------------------------------------------------------------
const DCAT_LINKML = `id: http://www.w3.org/ns/dcat
name: dcat
title: W3C Data Catalog Vocabulary (DCAT) - Version 3
version: "3"
prefixes:
  dcat: http://www.w3.org/ns/dcat#
  linkml: https://w3id.org/linkml/
default_prefix: dcat
imports:
  - linkml:types
classes:
  Catalog:
    description: A curated collection of metadata about resources.
  Dataset:
    description: A collection of data, published or curated by a single agent.
  Distribution:
    description: A specific representation of a dataset.
  DataService:
    description: A collection of operations that provide access to datasets or data processing functions.
slots:
  distribution:
    domain: Dataset
    range: Distribution
  service:
    domain: Catalog
    range: DataService
`

const DCAT_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .

<http://www.w3.org/ns/dcat#> a owl:Ontology ;
    rdfs:label "W3C Data Catalog Vocabulary (DCAT) - Version 3" ;
    owl:versionInfo "3" .

dcat:Catalog a owl:Class ;
    rdfs:label "Catalog" ;
    rdfs:comment "A curated collection of metadata about resources." .

dcat:Dataset a owl:Class ;
    rdfs:label "Dataset" ;
    rdfs:comment "A collection of data, published or curated by a single agent." .

dcat:Distribution a owl:Class ;
    rdfs:label "Distribution" ;
    rdfs:comment "A specific representation of a dataset." .

dcat:DataService a owl:Class ;
    rdfs:label "DataService" ;
    rdfs:comment "A collection of operations that provide access to datasets or data processing functions." .

dcat:distribution a owl:ObjectProperty ;
    rdfs:domain dcat:Dataset ;
    rdfs:range dcat:Distribution .
`

// ---------------------------------------------------------------------------
// 3. w3c/skos@2009
// ---------------------------------------------------------------------------
const SKOS_LINKML = `id: http://www.w3.org/2004/02/skos/core
name: skos
title: SKOS Simple Knowledge Organization System
version: "2009"
prefixes:
  skos: http://www.w3.org/2004/02/skos/core#
  linkml: https://w3id.org/linkml/
default_prefix: skos
imports:
  - linkml:types
classes:
  Concept:
    description: An idea or notion; a unit of thought.
  ConceptScheme:
    description: A set of concepts, optionally including statements about semantic relationships between those concepts.
  Collection:
    description: A meaningful collection of concepts.
slots:
  broader:
    domain: Concept
    range: Concept
  narrower:
    domain: Concept
    range: Concept
  inScheme:
    domain: Concept
    range: ConceptScheme
`

const SKOS_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

<http://www.w3.org/2004/02/skos/core#> a owl:Ontology ;
    rdfs:label "SKOS Simple Knowledge Organization System" ;
    owl:versionInfo "2009" .

skos:Concept a owl:Class ;
    rdfs:label "Concept" ;
    rdfs:comment "An idea or notion; a unit of thought." .

skos:ConceptScheme a owl:Class ;
    rdfs:label "ConceptScheme" ;
    rdfs:comment "A set of concepts, optionally including statements about semantic relationships between those concepts." .

skos:Collection a owl:Class ;
    rdfs:label "Collection" ;
    rdfs:comment "A meaningful collection of concepts." .

skos:broader a owl:ObjectProperty ;
    rdfs:domain skos:Concept ;
    rdfs:range skos:Concept .

skos:narrower a owl:ObjectProperty ;
    rdfs:domain skos:Concept ;
    rdfs:range skos:Concept .
`

// ---------------------------------------------------------------------------
// 4. dublincore/dcterms@2020 & dublincore/dcterms@2012
// ---------------------------------------------------------------------------
const DCTERMS_LINKML = `id: http://purl.org/dc/terms
name: dcterms
title: DCMI Metadata Terms
version: "2020"
prefixes:
  dcterms: http://purl.org/dc/terms/
  linkml: https://w3id.org/linkml/
default_prefix: dcterms
imports:
  - linkml:types
classes:
  Agent:
    description: A resource that acts or has the power to act.
  BibliographicResource:
    description: A book, article, or other documentary resource.
  LicenseDocument:
    description: A legal document giving official permission to do something with a Resource.
slots:
  title:
    range: string
  description:
    range: string
  creator:
    range: Agent
`

const DCTERMS_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<http://purl.org/dc/terms/> a owl:Ontology ;
    rdfs:label "DCMI Metadata Terms" ;
    owl:versionInfo "2020" .

dcterms:Agent a owl:Class ;
    rdfs:label "Agent" ;
    rdfs:comment "A resource that acts or has the power to act." .

dcterms:BibliographicResource a owl:Class ;
    rdfs:label "BibliographicResource" ;
    rdfs:comment "A book, article, or other documentary resource." .

dcterms:LicenseDocument a owl:Class ;
    rdfs:label "LicenseDocument" ;
    rdfs:comment "A legal document giving official permission to do something with a Resource." .

dcterms:title a owl:DatatypeProperty ;
    rdfs:range rdfs:Literal .

dcterms:creator a owl:ObjectProperty ;
    rdfs:range dcterms:Agent .
`

const DCTERMS_2012_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<http://purl.org/dc/terms/> a owl:Ontology ;
    rdfs:label "DCMI Metadata Terms (2012)" ;
    owl:versionInfo "2012" .

dcterms:Agent a owl:Class ;
    rdfs:label "Agent" .
`

const DCTERMS_2012_LINKML = `id: http://purl.org/dc/terms
name: dcterms
title: DCMI Metadata Terms (2012)
version: "2012"
prefixes:
  dcterms: http://purl.org/dc/terms/
  linkml: https://w3id.org/linkml/
default_prefix: dcterms
imports:
  - linkml:types
classes:
  Agent:
    description: A resource that acts or has the power to act.
`

// ---------------------------------------------------------------------------
// 5. w3c/ssn@2017
// ---------------------------------------------------------------------------
const SSN_LINKML = `id: http://www.w3.org/ns/ssn
name: ssn
title: Semantic Sensor Network Ontology (SSN)
version: "2017"
prefixes:
  ssn: http://www.w3.org/ns/ssn/
  linkml: https://w3id.org/linkml/
default_prefix: ssn
imports:
  - linkml:types
classes:
  System:
    description: System on which observations or acts of sensing take place.
  Deployment:
    description: Deployment of one or more systems for a particular purpose.
  Stimulus:
    description: An event in the real world that triggers a sensor.
slots:
  hasDeployment:
    domain: System
    range: Deployment
`

const SSN_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix ssn: <http://www.w3.org/ns/ssn/> .

<http://www.w3.org/ns/ssn/> a owl:Ontology ;
    rdfs:label "Semantic Sensor Network Ontology (SSN)" ;
    owl:versionInfo "2017" .

ssn:System a owl:Class ;
    rdfs:label "System" .

ssn:Deployment a owl:Class ;
    rdfs:label "Deployment" .

ssn:Stimulus a owl:Class ;
    rdfs:label "Stimulus" .
`

// ---------------------------------------------------------------------------
// 6. w3c/org@2014
// ---------------------------------------------------------------------------
const ORG_LINKML = `id: http://www.w3.org/ns/org
name: org
title: The Organization Ontology
version: "2014"
prefixes:
  org: http://www.w3.org/ns/org#
  linkml: https://w3id.org/linkml/
default_prefix: org
imports:
  - linkml:types
classes:
  Organization:
    description: Represents a collection of people organized together into a community or other social, commercial or political structure.
  OrganizationalUnit:
    description: An organization such as a department or team which is part of a larger organization.
  Membership:
    description: Indicates the nature of an Agent's relationship with an Organization.
  Role:
    description: Denotes a role that a Person or other Agent can take in an Organization.
slots:
  hasSubOrganization:
    domain: Organization
    range: Organization
  hasUnit:
    domain: Organization
    range: OrganizationalUnit
`

const ORG_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix org: <http://www.w3.org/ns/org#> .

<http://www.w3.org/ns/org#> a owl:Ontology ;
    rdfs:label "The Organization Ontology" ;
    owl:versionInfo "2014" .

org:Organization a owl:Class ;
    rdfs:label "Organization" .

org:OrganizationalUnit a owl:Class ;
    rdfs:label "OrganizationalUnit" .

org:Membership a owl:Class ;
    rdfs:label "Membership" .

org:Role a owl:Class ;
    rdfs:label "Role" .
`

// ---------------------------------------------------------------------------
// 7. foaf/foaf@0.1
// ---------------------------------------------------------------------------
const FOAF_LINKML = `id: http://xmlns.com/foaf/0.1
name: foaf
title: Friend of a Friend (FOAF) Vocabulary
version: "0.1"
prefixes:
  foaf: http://xmlns.com/foaf/0.1/
  linkml: https://w3id.org/linkml/
default_prefix: foaf
imports:
  - linkml:types
classes:
  Person:
    description: A person.
  Agent:
    description: An agent (eg. person, group, software or physical artifact).
  Document:
    description: A document.
  Organization:
    description: An organization.
slots:
  knows:
    domain: Person
    range: Person
  name:
    domain: Agent
    range: string
  mbox:
    domain: Agent
    range: string
`

const FOAF_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<http://xmlns.com/foaf/0.1/> a owl:Ontology ;
    rdfs:label "Friend of a Friend (FOAF) Vocabulary" ;
    owl:versionInfo "0.1" .

foaf:Person a owl:Class ;
    rdfs:label "Person" .

foaf:Agent a owl:Class ;
    rdfs:label "Agent" .

foaf:Document a owl:Class ;
    rdfs:label "Document" .

foaf:Organization a owl:Class ;
    rdfs:label "Organization" .

foaf:knows a owl:ObjectProperty ;
    rdfs:domain foaf:Person ;
    rdfs:range foaf:Person .
`

// ---------------------------------------------------------------------------
// 8. schemaorg/schema@28
// ---------------------------------------------------------------------------
const SCHEMA_LINKML = `id: https://schema.org
name: schema
title: Schema.org Vocabulary
version: "28"
prefixes:
  schema: https://schema.org/
  linkml: https://w3id.org/linkml/
default_prefix: schema
imports:
  - linkml:types
classes:
  Thing:
    description: The most generic type of item.
  Action:
    description: An action performed by a direct agent and indirect participants upon a direct object.
  CreativeWork:
    description: The most generic kind of creative work, including books, movies, photographs, software programs, etc.
  Event:
    description: An event happening at a certain time and location.
  Organization:
    description: An organization such as a school, NGO, corporation, club, etc.
  Person:
    description: A person (alive, dead, undead, or fictional).
  Place:
    description: Entities that have a somewhat fixed, physical extension.
slots:
  name:
    domain: Thing
    range: string
  description:
    domain: Thing
    range: string
  url:
    domain: Thing
    range: string
`

const SCHEMA_TURTLE = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix schema: <https://schema.org/> .

<https://schema.org/> a owl:Ontology ;
    rdfs:label "Schema.org Vocabulary" ;
    owl:versionInfo "28" .

schema:Thing a owl:Class ;
    rdfs:label "Thing" .

schema:Action a owl:Class ;
    rdfs:label "Action" .

schema:CreativeWork a owl:Class ;
    rdfs:label "CreativeWork" .

schema:Event a owl:Class ;
    rdfs:label "Event" .

schema:Organization a owl:Class ;
    rdfs:label "Organization" .

schema:Person a owl:Class ;
    rdfs:label "Person" .

schema:Place a owl:Class ;
    rdfs:label "Place" .
`

export const BUILTIN_PUBLICATIONS: Map<string, BuiltinPublication> = new Map([
  [
    "w3c/prov-o@2013",
    buildPublication(
      "w3c",
      "prov-o",
      "2013",
      "W3C PROV-O: The PROV Ontology",
      "The PROV-O ontology provides a set of classes, properties, and restrictions that can be used to represent and interchange provenance information.",
      "W3C-Software-Notice",
      "http://www.w3.org/ns/prov#",
      [],
      PROV_O_LINKML,
      PROV_O_TURTLE,
      ["provenance", "w3c", "prov", "audit"]
    ),
  ],
  [
    "w3c/dcat@3",
    buildPublication(
      "w3c",
      "dcat",
      "3",
      "W3C Data Catalog Vocabulary (DCAT) - Version 3",
      "DCAT is an RDF vocabulary designed to facilitate interoperability between data catalogs published on the Web.",
      "W3C-Software-Notice",
      "http://www.w3.org/ns/dcat#",
      [
        { ontology: "dublincore/dcterms@2020" },
        { ontology: "w3c/skos@2009" },
        { ontology: "w3c/prov-o@2013" },
      ],
      DCAT_LINKML,
      DCAT_TURTLE,
      ["dcat", "catalog", "dataset", "distribution", "w3c"]
    ),
  ],
  [
    "w3c/skos@2009",
    buildPublication(
      "w3c",
      "skos",
      "2009",
      "SKOS Simple Knowledge Organization System",
      "SKOS is a common data model for sharing and linking knowledge organization systems via the Web.",
      "W3C-Software-Notice",
      "http://www.w3.org/2004/02/skos/core#",
      [],
      SKOS_LINKML,
      SKOS_TURTLE,
      ["skos", "thesaurus", "taxonomy", "concepts", "w3c"]
    ),
  ],
  [
    "dublincore/dcterms@2020",
    buildPublication(
      "dublincore",
      "dcterms",
      "2020",
      "DCMI Metadata Terms",
      "Dublin Core Metadata Initiative Terms vocabulary.",
      "CC-BY-4.0",
      "http://purl.org/dc/terms/",
      [],
      DCTERMS_LINKML,
      DCTERMS_TURTLE,
      ["dublincore", "dcterms", "metadata", "dc"]
    ),
  ],
  [
    "dublincore/dcterms@2012",
    buildPublication(
      "dublincore",
      "dcterms",
      "2012",
      "DCMI Metadata Terms (2012)",
      "Dublin Core Metadata Initiative Terms vocabulary (2012 snapshot).",
      "CC-BY-4.0",
      "http://purl.org/dc/terms/",
      [],
      DCTERMS_2012_LINKML,
      DCTERMS_2012_TURTLE,
      ["dublincore", "dcterms", "metadata", "dc"]
    ),
  ],
  [
    "w3c/ssn@2017",
    buildPublication(
      "w3c",
      "ssn",
      "2017",
      "Semantic Sensor Network Ontology (SSN)",
      "SSN ontology describing sensors and their observations, the involved procedures, the studied features of interest, etc.",
      "W3C-Software-Notice",
      "http://www.w3.org/ns/ssn/",
      [],
      SSN_LINKML,
      SSN_TURTLE,
      ["ssn", "sensor", "iot", "observation", "w3c"]
    ),
  ],
  [
    "w3c/org@2014",
    buildPublication(
      "w3c",
      "org",
      "2014",
      "The Organization Ontology",
      "A core ontology for organizational structures, suitable for representing organizations across government and industry.",
      "W3C-Software-Notice",
      "http://www.w3.org/ns/org#",
      [{ ontology: "foaf/foaf@0.1" }, { ontology: "dublincore/dcterms@2020" }],
      ORG_LINKML,
      ORG_TURTLE,
      ["org", "organization", "roles", "membership", "w3c"]
    ),
  ],
  [
    "foaf/foaf@0.1",
    buildPublication(
      "foaf",
      "foaf",
      "0.1",
      "Friend of a Friend (FOAF) Vocabulary",
      "The Friend of a Friend (FOAF) RDF vocabulary provides terms for describing people and their relations.",
      "CC-BY-1.0",
      "http://xmlns.com/foaf/0.1/",
      [],
      FOAF_LINKML,
      FOAF_TURTLE,
      ["foaf", "person", "friend", "social", "agent"]
    ),
  ],
  [
    "schemaorg/schema@28",
    buildPublication(
      "schemaorg",
      "schema",
      "28",
      "Schema.org Vocabulary",
      "Schema.org is a collaborative, community activity with a mission to create, maintain, and promote schemas for structured data on the Internet.",
      "Apache-2.0",
      "https://schema.org/",
      [],
      SCHEMA_LINKML,
      SCHEMA_TURTLE,
      ["schema", "schemaorg", "structured-data", "seo", "web"]
    ),
  ],
])

/**
 * Find built-in publication matching a reference.
 * If version is omitted, returns the latest version of that package.
 */
export function getBuiltinPublication(
  ref: string
): BuiltinPublication | undefined {
  const direct = BUILTIN_PUBLICATIONS.get(ref)
  if (direct) {
    return direct
  }

  const { namespace, name, version } = parsePackageRef(ref)

  // If version is specified, check namespace/name@version
  if (version) {
    for (const [key, pub] of BUILTIN_PUBLICATIONS.entries()) {
      if (
        pub.metadata.name.toLowerCase() === name.toLowerCase() &&
        pub.metadata.version === version &&
        (!namespace ||
          pub.metadata.namespace.toLowerCase() === namespace.toLowerCase())
      ) {
        return pub
      }
    }
    return undefined
  }

  // Version omitted: find candidates and pick latest
  const candidates: BuiltinPublication[] = []
  for (const pub of BUILTIN_PUBLICATIONS.values()) {
    if (
      pub.metadata.name.toLowerCase() === name.toLowerCase() &&
      (!namespace ||
        pub.metadata.namespace.toLowerCase() === namespace.toLowerCase())
    ) {
      candidates.push(pub)
    }
  }

  if (candidates.length === 0) {
    return undefined
  }

  // Sort descending by version (e.g. 2020 > 2012, 3 > 1)
  candidates.sort((a, b) => {
    const vA = parseFloat(a.metadata.version) || 0
    const vB = parseFloat(b.metadata.version) || 0
    return vB - vA
  })

  return candidates[0]
}

/**
 * Returns package summaries for all built-in packages, aggregated across versions.
 */
export function getBuiltinPackageSummaries(): OhiPackageSummary[] {
  const packagesMap = new Map<
    string,
    { latest: BuiltinPublication; versions: string[] }
  >()

  for (const pub of BUILTIN_PUBLICATIONS.values()) {
    const pkgKey = `${pub.metadata.namespace}/${pub.metadata.name}`
    const existing = packagesMap.get(pkgKey)
    if (!existing) {
      packagesMap.set(pkgKey, {
        latest: pub,
        versions: [pub.metadata.version],
      })
    } else {
      existing.versions.push(pub.metadata.version)
      const currentLatestNum = parseFloat(existing.latest.metadata.version) || 0
      const newNum = parseFloat(pub.metadata.version) || 0
      if (newNum > currentLatestNum) {
        existing.latest = pub
      }
    }
  }

  return Array.from(packagesMap.values()).map(({ latest, versions }) => ({
    namespace: latest.metadata.namespace,
    name: latest.metadata.name,
    package_ref: `${latest.metadata.namespace}/${latest.metadata.name}`,
    title: latest.metadata.title,
    description: latest.metadata.description || "",
    latest_version: latest.metadata.version,
    versions: versions.sort(
      (a, b) => (parseFloat(b) || 0) - (parseFloat(a) || 0)
    ),
    license: latest.metadata.license,
  }))
}
