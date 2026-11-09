"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { KnowledgeContradiction } from "../../types"
import { resolveContradictionAction } from "../../server/actions/resolve-contradiction"

export interface ResolveDialogProps {
  contradiction: KnowledgeContradiction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved?: (updated: KnowledgeContradiction) => void
  inline?: boolean // For DOM testing
  className?: string
}

export type ResolutionStrategy = "keep_a" | "keep_b" | "dismiss"

function extractFactValue(fact: Record<string, unknown> | undefined): string {
  if (!fact) return ""
  if (typeof fact.value === "string") return fact.value
  if (typeof fact.object_text === "string") return fact.object_text
  if (typeof fact.val === "string") return fact.val
  if (typeof fact.text === "string") return fact.text
  return Object.keys(fact).length > 0 ? JSON.stringify(fact) : ""
}

interface ResolveDialogFormProps {
  contradiction: KnowledgeContradiction
  onOpenChange: (open: boolean) => void
  onResolved?: (updated: KnowledgeContradiction) => void
}

function ResolveDialogForm({
  contradiction,
  onOpenChange,
  onResolved,
}: ResolveDialogFormProps) {
  const [strategy, setStrategy] = useState<ResolutionStrategy>("keep_a")
  const [customNotes, setCustomNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const factAValue = extractFactValue(contradiction.factA)
  const factBValue = extractFactValue(contradiction.factB)

  async function handleConfirm() {
    setIsSubmitting(true)
    try {
      const isDismiss = strategy === "dismiss"
      const status: "resolved" | "dismissed" = isDismiss
        ? "dismissed"
        : "resolved"

      const strategyBaseNote =
        strategy === "keep_a"
          ? "Keep Statement A (Mark B as invalid)"
          : strategy === "keep_b"
            ? "Keep Statement B (Mark A as invalid)"
            : "Dismiss as Compatible (Both valid in context)"

      const actionNotes = customNotes.trim()
        ? `${strategyBaseNote}: ${customNotes.trim()}`
        : strategyBaseNote

      const updated = await resolveContradictionAction({
        contradictionId: contradiction.id,
        status,
        actionNotes,
      })

      toast.success("Contradiction resolved successfully")
      onResolved?.(updated)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to resolve contradiction"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold tracking-tight">
            Resolve Contradiction
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose an authoritative resolution strategy for{" "}
          <span className="font-semibold text-foreground">
            {contradiction.entityLabel}
          </span>{" "}
          (&quot;{contradiction.relationName}&quot;).
        </p>
      </div>

      {/* Strategies Radio Group */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium">Resolution Strategy</Label>
        <RadioGroup
          value={strategy}
          onValueChange={(val) => setStrategy(val as ResolutionStrategy)}
          className="gap-2"
        >
          {/* Strategy: keep_a */}
          <label
            htmlFor="strat-keep-a"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              strategy === "keep_a"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              value="keep_a"
              id="strat-keep-a"
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                Keep Statement A (Mark B as invalid)
              </span>
              {factAValue && (
                <span className="text-[11px] text-muted-foreground">
                  Statement A value: &quot;{factAValue}&quot;
                </span>
              )}
            </div>
          </label>

          {/* Strategy: keep_b */}
          <label
            htmlFor="strat-keep-b"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              strategy === "keep_b"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              value="keep_b"
              id="strat-keep-b"
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                Keep Statement B (Mark A as invalid)
              </span>
              {factBValue && (
                <span className="text-[11px] text-muted-foreground">
                  Statement B value: &quot;{factBValue}&quot;
                </span>
              )}
            </div>
          </label>

          {/* Strategy: dismiss */}
          <label
            htmlFor="strat-dismiss"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              strategy === "dismiss"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              value="dismiss"
              id="strat-dismiss"
              className="mt-0.5"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                Dismiss as Compatible (Both valid in context)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Retain both assertions without flagging semantic drift.
              </span>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Resolution Notes Textarea */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resolve-notes" className="text-xs font-medium">
          Resolution Notes (Optional)
        </Label>
        <Textarea
          id="resolve-notes"
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder="Add rationale, source verification notes, or audit commentary..."
          className="min-h-[70px] resize-none text-xs"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="gap-1.5"
          data-testid="confirm-resolve-button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Resolving...</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Confirm Resolution</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export function ResolveDialog({
  contradiction,
  open,
  onOpenChange,
  onResolved,
  inline = false,
  className,
}: ResolveDialogProps) {
  if (!contradiction) {
    if (inline) return null
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className} />
      </Dialog>
    )
  }

  if (inline) {
    return (
      <div
        className={cn(
          "flex w-full max-w-lg flex-col gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
          className
        )}
        data-testid="resolve-contradiction-dialog"
      >
        <ResolveDialogForm
          key={contradiction.id}
          contradiction={contradiction}
          onOpenChange={onOpenChange}
          onResolved={onResolved}
        />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-lg", className)}
        data-testid="resolve-contradiction-dialog"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Resolve Contradiction</DialogTitle>
          <DialogDescription>
            Choose an authoritative resolution strategy for this conflict.
          </DialogDescription>
        </DialogHeader>
        <ResolveDialogForm
          key={contradiction.id}
          contradiction={contradiction}
          onOpenChange={onOpenChange}
          onResolved={onResolved}
        />
      </DialogContent>
    </Dialog>
  )
}
