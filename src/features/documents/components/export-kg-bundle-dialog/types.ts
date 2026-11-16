import type { KnowledgeGraphExportBundle } from "../../server/actions/build-kg-bundle"

export type BundleArtifactKey = keyof KnowledgeGraphExportBundle["files"]

export interface BundleArtifactMeta {
  key: BundleArtifactKey
  filename: string
  label: string
  description: string
  mimeType: string
}

export const BUNDLE_ARTIFACTS: BundleArtifactMeta[] = [
  {
    key: "instances_ttl",
    filename: "instances.ttl",
    label: "instances.ttl",
    description: "RDF instance graph with W3C PROV-O provenance",
    mimeType: "text/turtle",
  },
  {
    key: "rdfs_ttl",
    filename: "ontology.rdfs.ttl",
    label: "ontology.rdfs.ttl",
    description: "Compiled RDFS schema vocabulary",
    mimeType: "text/turtle",
  },
  {
    key: "shacl_ttl",
    filename: "shapes.shacl.ttl",
    label: "shapes.shacl.ttl",
    description: "Compiled SHACL validation shapes",
    mimeType: "text/turtle",
  },
  {
    key: "pydantic_py",
    filename: "models.py",
    label: "models.py",
    description: "Generated Pydantic v2 data models",
    mimeType: "text/x-python",
  },
  {
    key: "instances_json",
    filename: "instances.json",
    label: "instances.json",
    description: "Typed JSON instances matching models.py",
    mimeType: "application/json",
  },
  {
    key: "ohi_lock_json",
    filename: "ohi.lock.json",
    label: "ohi.lock.json",
    description: "Locked OHI package SHA-256 provenance",
    mimeType: "application/json",
  },
]

export interface ExportKgBundleDialogProps {
  documentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}
