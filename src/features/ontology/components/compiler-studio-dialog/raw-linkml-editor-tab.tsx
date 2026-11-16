"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { saveRawLinkmlYamlAction } from "@/features/ontology/server/actions/compiler-studio"
import { triggerArtifactDownload } from "./artifact-code-viewer"
import {
  buildArtifactFilename,
  type CascadePreview,
  type CompilerStudioData,
  type LinkmlLintIssue,
} from "./types"

export interface RawLinkmlEditorTabProps {
  ontologyId: string
  ontologyName: string
  initialYaml: string
  onSaved: (updated: CompilerStudioData) => void
}

export function RawLinkmlEditorTab({
  ontologyId,
  ontologyName,
  initialYaml,
  onSaved,
}: RawLinkmlEditorTabProps) {
  const [draftYaml, setDraftYaml] = useState(initialYaml)
  const [lastSyncedInitial, setLastSyncedInitial] = useState(initialYaml)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<LinkmlLintIssue[]>([])
  const [cascadePreview, setCascadePreview] = useState<CascadePreview | null>(
    null
  )

  if (initialYaml !== lastSyncedInitial) {
    setLastSyncedInitial(initialYaml)
    setDraftYaml(initialYaml)
  }

  const isDirty = draftYaml !== initialYaml
  const filename = buildArtifactFilename(ontologyName, ".linkml.yaml")

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draftYaml)
      setCopied(true)
      toast.success(`Copied ${filename} to clipboard`)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  function handleDownload() {
    triggerArtifactDownload(draftYaml, filename, "application/yaml")
    toast.success(`Downloaded ${filename}`)
  }

  function handleReset() {
    setDraftYaml(initialYaml)
    setErrorMessage(null)
    setDiagnostics([])
    setCascadePreview(null)
  }

  async function executeSave(confirmCascade: boolean) {
    setIsSaving(true)
    setErrorMessage(null)
    setDiagnostics([])

    try {
      const result = await saveRawLinkmlYamlAction(
        ontologyId,
        draftYaml,
        confirmCascade
      )

      if (result.ok) {
        setCascadePreview(null)
        onSaved(result.data)
        toast.success("LinkML schema saved and recompiled")
        return
      }

      if (result.requiresConfirmation) {
        setCascadePreview(result.cascadePreview)
        return
      }

      setErrorMessage(result.error)
      setDiagnostics(result.diagnostics)
      toast.error("LinkML validation failed — changes were not saved")
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save LinkML YAML"
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Canonical LinkML Source</span>
          <Badge variant="outline" className="font-mono text-xs">
            {filename}
          </Badge>
          {isDirty && (
            <Badge variant="secondary" className="text-xs text-amber-600">
              Unsaved edits
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isDirty || isSaving}
            onClick={handleReset}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download {filename}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || isSaving}
            onClick={() => void executeSave(false)}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save &amp; Recompile
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Compiler Error: {errorMessage}</span>
          </div>
          {diagnostics.length > 0 && (
            <ScrollArea className="mt-2 max-h-28">
              <ul className="space-y-1">
                {diagnostics.map((diag, idx) => (
                  <li
                    key={`${diag.issue_type}-${idx}`}
                    className="flex flex-wrap items-center gap-2 text-muted-foreground"
                  >
                    <Badge
                      variant={
                        diag.severity === "FATAL" || diag.severity === "ERROR"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {diag.severity}
                    </Badge>
                    <span className="font-mono text-[11px] font-medium text-foreground">
                      {diag.issue_type}
                    </span>
                    {diag.element && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {diag.element}
                      </Badge>
                    )}
                    <span>{diag.message}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}

      <Textarea
        value={draftYaml}
        onChange={(e) => setDraftYaml(e.target.value)}
        spellCheck={false}
        aria-label="Raw LinkML YAML Editor"
        className="min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed"
      />

      <AlertDialog
        open={cascadePreview !== null}
        onOpenChange={(open) => {
          if (!open) setCascadePreview(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Destructive Schema Changes
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Your LinkML YAML edits remove symbols from the canonical
                  ontology. Saving will cascade-delete or clear references in
                  downstream data:
                </p>

                {cascadePreview && (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-xs text-foreground">
                    {cascadePreview.deletedClasses.length > 0 && (
                      <div>
                        <span className="font-medium">Deleted classes: </span>
                        <span className="font-mono">
                          {cascadePreview.deletedClasses.join(", ")}
                        </span>
                      </div>
                    )}
                    {cascadePreview.deletedRelations.length > 0 && (
                      <div>
                        <span className="font-medium">Deleted relations: </span>
                        <span className="font-mono">
                          {cascadePreview.deletedRelations.join(", ")}
                        </span>
                      </div>
                    )}
                    {cascadePreview.deletedAttributes.length > 0 && (
                      <div>
                        <span className="font-medium">
                          Deleted attributes:{" "}
                        </span>
                        <span className="font-mono">
                          {cascadePreview.deletedAttributes.join(", ")}
                        </span>
                      </div>
                    )}
                    {cascadePreview.deletedModules.length > 0 && (
                      <div>
                        <span className="font-medium">Deleted modules: </span>
                        <span className="font-mono">
                          {cascadePreview.deletedModules.join(", ")}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="destructive">
                        {cascadePreview.impactedEntitiesCount} extracted entities
                      </Badge>
                      <Badge variant="destructive">
                        {cascadePreview.impactedFactsCount} extracted facts
                      </Badge>
                      <Badge variant="secondary">
                        {cascadePreview.impactedCqsCount} competency questions
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSaving}
              onClick={(e) => {
                e.preventDefault()
                void executeSave(true)
              }}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirm &amp; Cascade Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
