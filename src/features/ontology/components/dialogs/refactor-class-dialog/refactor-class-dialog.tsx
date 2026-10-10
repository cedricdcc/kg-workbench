"use client"

import { useMemo, useState, useTransition } from "react"
import { GitBranch, Layers } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { OntologyRelation } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import {
  mergeClasses,
  refactorClassHierarchy,
} from "@/features/ontology/server/actions/class-refactoring"

import { NeighborhoodGraphDiff } from "./neighborhood-graph-diff"
import { ReparentModePanel } from "./reparent-mode-panel"
import { MergeModePanel } from "./merge-mode-panel"

interface RefactorClassDialogProps {
  ontologyId: string
  cls: OntologyClassWithAttributes
  allClasses: OntologyClassWithAttributes[]
  allRelations: OntologyRelation[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function RefactorClassDialog({
  ontologyId,
  cls,
  allClasses,
  allRelations,
  open,
  onOpenChange,
  onSuccess,
}: RefactorClassDialogProps) {
  const [activeTab, setActiveTab] = useState<"reparent" | "merge">("reparent")
  const [selectedParentClassId, setSelectedParentClassId] = useState<
    string | null
  >(cls.parent_class_id ?? null)
  const [dropAttributeIds, setDropAttributeIds] = useState<string[]>([])
  const [selectedTargetClassId, setSelectedTargetClassId] = useState<
    string | null
  >(null)
  const [retainedAttributeIds, setRetainedAttributeIds] = useState<string[]>(
    cls.attributes.map((a) => a.id)
  )
  const [isPending, startTransition] = useTransition()

  const oldParentClass = useMemo(
    () => allClasses.find((c) => c.id === cls.parent_class_id) ?? null,
    [allClasses, cls.parent_class_id]
  )

  const newParentClass = useMemo(
    () => allClasses.find((c) => c.id === selectedParentClassId) ?? null,
    [allClasses, selectedParentClassId]
  )

  const mergeTargetClass = useMemo(
    () => allClasses.find((c) => c.id === selectedTargetClassId) ?? null,
    [allClasses, selectedTargetClassId]
  )

  // Map neighbor relations for diff visualization
  const graphRelations = useMemo(() => {
    return allRelations
      .filter(
        (r) => r.domain_class_id === cls.id || r.range_class_id === cls.id
      )
      .map((r) => {
        const isDomain = r.domain_class_id === cls.id
        const otherId = isDomain ? r.range_class_id : r.domain_class_id
        const otherCls = allClasses.find((c) => c.id === otherId)
        return {
          id: r.id,
          name: r.name,
          otherClassName: otherCls?.name ?? "External Class",
          direction: isDomain ? ("outgoing" as const) : ("incoming" as const),
        }
      })
  }, [allRelations, cls.id, allClasses])

  function handleOpenChange(val: boolean) {
    if (!val) {
      setSelectedParentClassId(cls.parent_class_id ?? null)
      setDropAttributeIds([])
      setSelectedTargetClassId(null)
      setRetainedAttributeIds(cls.attributes.map((a) => a.id))
    }
    onOpenChange(val)
  }

  function handleApply() {
    startTransition(async () => {
      try {
        if (activeTab === "reparent") {
          await refactorClassHierarchy({
            ontologyId,
            classId: cls.id,
            targetParentClassId: selectedParentClassId,
            dropAttributeIds,
          })
          toast.success(`Successfully reparented class ${cls.name}.`)
        } else {
          if (!selectedTargetClassId) {
            toast.error("Please select a target class to merge into.")
            return
          }
          await mergeClasses({
            ontologyId,
            sourceClassId: cls.id,
            targetClassId: selectedTargetClassId,
            retainedAttributeIds,
          })
          toast.success(
            `Successfully merged ${cls.name} into ${mergeTargetClass?.name}.`
          )
        }
        onOpenChange(false)
        onSuccess?.()
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to execute refactoring."
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <div>
              <DialogTitle>Refactor Class Studio: {cls.name}</DialogTitle>
              <DialogDescription>
                Safely adjust inheritance, reconcile duplicates, or merge
                classes with live neighborhood diff preview.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Visual Graph Diff Canvas */}
          <NeighborhoodGraphDiff
            currentClass={cls}
            oldParentClass={oldParentClass}
            newParentClass={activeTab === "reparent" ? newParentClass : null}
            mergeTargetClass={activeTab === "merge" ? mergeTargetClass : null}
            relations={graphRelations}
          />

          {/* Mode Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "reparent" | "merge")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reparent" className="gap-1.5 text-xs">
                <GitBranch className="h-3.5 w-3.5" />
                Reparent Class
              </TabsTrigger>
              <TabsTrigger value="merge" className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Merge Class
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reparent">
              <ReparentModePanel
                cls={cls}
                allClasses={allClasses}
                allRelations={allRelations}
                selectedParentClassId={selectedParentClassId}
                onParentClassIdChange={setSelectedParentClassId}
                dropAttributeIds={dropAttributeIds}
                onDropAttributeIdsChange={setDropAttributeIds}
              />
            </TabsContent>

            <TabsContent value="merge">
              <MergeModePanel
                cls={cls}
                allClasses={allClasses}
                allRelations={allRelations}
                selectedTargetClassId={selectedTargetClassId}
                onTargetClassIdChange={setSelectedTargetClassId}
                retainedAttributeIds={retainedAttributeIds}
                onRetainedAttributeIdsChange={setRetainedAttributeIds}
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={
              isPending || (activeTab === "merge" && !selectedTargetClassId)
            }
          >
            {isPending
              ? "Applying Changes..."
              : activeTab === "reparent"
                ? "Apply Reparenting"
                : "Execute Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
