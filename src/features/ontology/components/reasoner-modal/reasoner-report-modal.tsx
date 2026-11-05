"use client"

import { useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, Copy, Check, Terminal, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReasonerResultPayload } from "../../server/actions/run-ontology-reasoning"
import { ReasonerViolationsTab } from "./reasoner-violations-tab"
import { ReasonerEntailmentsTab } from "./reasoner-entailments-tab"

interface ReasonerReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
  isOffline?: boolean
  offlineMessage?: string
  composeCommand?: string
  result?: ReasonerResultPayload | null
  errorMessage?: string | null
}

export function ReasonerReportModal({
  open,
  onOpenChange,
  isLoading = false,
  isOffline = false,
  offlineMessage,
  composeCommand = "bash deploy/scripts/deploy.sh postgres up --profile reasoner",
  result,
  errorMessage,
}: ReasonerReportModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(composeCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Semantic Reasoning & Validation Report
            </DialogTitle>
            {!isLoading && !isOffline && result && (
              <Badge variant={result.conforms ? "secondary" : "destructive"}>
                {result.conforms ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Conforms
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> {result.violationCount} Violations
                  </span>
                )}
              </Badge>
            )}
            {isOffline && (
              <Badge variant="destructive">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Reasoner Offline
                </span>
              </Badge>
            )}
          </div>
          <DialogDescription>
            Formal W3C SHACL shape validation, disjointness consistency, and RDFS/OWL entailments computed via Oxigraph.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span>Running Oxigraph & pySHACL semantic reasoning...</span>
          </div>
        )}

        {isOffline && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{offlineMessage || "Reasoner sidecar service is offline"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              To enable formal W3C SHACL constraint validation and entailment reasoning, start the reasoner worker:
            </p>
            <div className="flex items-center justify-between rounded bg-muted/60 px-3 py-2 font-mono text-xs text-foreground">
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                {composeCommand}
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {errorMessage && !isLoading && !isOffline && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <XCircle className="h-4 w-4" />
              <span>Validation Failed</span>
            </div>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !isOffline && result && (
          <Tabs defaultValue="violations" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="violations">
                Violations ({result.violationCount})
              </TabsTrigger>
              <TabsTrigger value="entailments">
                Inferred ({result.inferredTriples?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="raw">Raw Output</TabsTrigger>
            </TabsList>

            <TabsContent value="violations" className="pt-2">
              <ReasonerViolationsTab violations={result.violations || []} />
            </TabsContent>

            <TabsContent value="entailments" className="pt-2">
              <ReasonerEntailmentsTab inferredTriples={result.inferredTriples || []} />
            </TabsContent>

            <TabsContent value="raw" className="pt-2">
              <pre className="max-h-[350px] overflow-auto rounded-lg bg-muted/30 p-3 font-mono text-xs text-foreground whitespace-pre-wrap">
                {result.reportText || "No raw report text available."}
              </pre>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
