"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OntologyModule } from "@/domain/ontology"
import { createClass } from "@/features/ontology/server/actions/classes"

export interface SelectedReferenceTerm {
  curie: string
  label: string
  iri: string
  type: string
  description: string
}

interface ReferenceTermDetailProps {
  term: SelectedReferenceTerm
  ontologyId: string
  modules: OntologyModule[]
  activeModuleId: string | null
  onClassCreated?: (classId: string) => void
}

export function ReferenceTermDetail({
  term,
  ontologyId,
  modules,
  activeModuleId,
  onClassCreated,
}: ReferenceTermDetailProps) {
  const [isImporting, setIsImporting] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const isClass = term.type.toLowerCase() === "class"
  const targetModule =
    modules.find((m) => m.id === activeModuleId) || modules[0]

  async function handleImport() {
    if (!targetModule) {
      toast.error("Please create a module first before importing classes.")
      return
    }

    setIsImporting(true)
    try {
      const created = await createClass(ontologyId, targetModule.id, {
        name: term.label || term.curie,
        description:
          term.description ||
          `Imported standard vocabulary term (${term.curie})`,
      })
      toast.success(
        `Imported "${created.name}" into module "${targetModule.name}".`
      )
      onClassCreated?.(created.id)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to import term into ontology."
      toast.error(msg)
    } finally {
      setIsImporting(false)
    }
  }

  function handleCopy(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`Copied ${field} to clipboard.`)
    setTimeout(() => setCopiedField(null), 1800)
  }

  return (
    <div className="flex flex-col space-y-4 p-4 text-xs">
      {/* Header */}
      <div className="space-y-1.5 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {term.label}
          </h2>
          <Badge variant="outline" className="font-mono text-[10px]">
            {term.curie}
          </Badge>
          <Badge
            variant={isClass ? "default" : "secondary"}
            className="text-[9px] tracking-wider uppercase"
          >
            {term.type}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <a
            href={term.iri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
          >
            <span className="truncate">{term.iri}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Definition & Scope
        </span>
        <div className="rounded-lg border bg-muted/20 p-3 leading-relaxed text-foreground">
          {term.description || (
            <span className="text-muted-foreground italic">
              No definition provided in reference registry.
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t pt-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Actions
        </span>

        <div className="flex flex-col gap-2">
          {targetModule && (
            <Button
              size="sm"
              variant="default"
              disabled={isImporting}
              onClick={handleImport}
              className="h-8 justify-start gap-1.5 text-xs"
            >
              {isImporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Import as Class into &quot;{targetModule.name}&quot;
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(term.curie, "CURIE")}
              className="h-8 flex-1 gap-1.5 text-xs"
            >
              {copiedField === "CURIE" ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Copy CURIE
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(term.iri, "IRI")}
              className="h-8 flex-1 gap-1.5 text-xs"
            >
              {copiedField === "IRI" ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Copy IRI
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
