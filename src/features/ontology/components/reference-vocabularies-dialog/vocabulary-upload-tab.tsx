"use client"

import { useState } from "react"
import { UploadCloud, Link as LinkIcon, Loader2, FileCode } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { importReferenceOntologyFile } from "@/features/ontology/server/actions/reference-vocabularies"

interface VocabularyUploadTabProps {
  onSuccess: () => void
}

export function VocabularyUploadTab({ onSuccess }: VocabularyUploadTabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      toast.error("Please select a file to upload.")
      return
    }

    setIsLoading(true)
    try {
      const content = await file.text()
      const format =
        file.name.endsWith(".ttl") || file.name.endsWith(".n3")
          ? "turtle"
          : "rdfxml"

      const result = await importReferenceOntologyFile({
        fileName: file.name,
        content,
        format,
      })

      toast.success(
        `Imported "${result.name}" (${result.prefix.toUpperCase()}) with ${result.termsSynced} terms.`
      )
      setFile(null)
      onSuccess()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import ontology file."
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUrlImport(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setIsLoading(true)
    try {
      const res = await fetch(trimmed)
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      const content = await res.text()

      const format = trimmed.endsWith(".ttl") ? "turtle" : "rdfxml"
      const fileName = trimmed.split("/").pop() || "ontology.ttl"

      const result = await importReferenceOntologyFile({
        fileName,
        content,
        format,
      })

      toast.success(
        `Imported "${result.name}" (${result.prefix.toUpperCase()}) from URL with ${result.termsSynced} terms.`
      )
      setUrl("")
      onSuccess()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to fetch ontology from URL."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-6 pt-3">
      {/* File Upload Section */}
      <form
        onSubmit={handleFileUpload}
        className="rounded-lg border border-dashed border-border p-6 text-center transition-colors hover:border-primary/50"
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold">Upload Ontology File</h3>
          <p className="text-xs text-muted-foreground">
            Supports Turtle (<code>.ttl</code>, <code>.n3</code>) and RDF/XML (
            <code>.owl</code>, <code>.rdf</code>). Classes, datatype properties,
            and object properties will be indexed with their domain and range.
          </p>

          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
            <FileCode className="h-4 w-4" />
            {file ? file.name : "Choose File"}
            <input
              type="file"
              accept=".ttl,.n3,.owl,.rdf,.xml"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <Button
            type="submit"
            size="sm"
            disabled={!file || isLoading}
            className="mt-2"
          >
            {isLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Import File
          </Button>
        </div>
      </form>

      {/* URL Import Section */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or fetch from public URL
          </span>
        </div>
      </div>

      <form onSubmit={handleUrlImport} className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.org/ontology.ttl"
            className="pl-8 text-xs"
            disabled={isLoading}
          />
        </div>
        <Button type="submit" size="sm" disabled={!url.trim() || isLoading}>
          {isLoading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Fetch & Index
        </Button>
      </form>
    </div>
  )
}
