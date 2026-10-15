"use client"

import { useMemo } from "react"
import { AlertTriangle, Layers } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import type { OntologyRelation } from "@/domain/ontology"

interface MergeModePanelProps {
  cls: OntologyClassWithAttributes
  allClasses: OntologyClassWithAttributes[]
  allRelations: OntologyRelation[]
  selectedTargetClassId: string | null
  onTargetClassIdChange: (targetId: string | null) => void
  retainedAttributeIds: string[]
  onRetainedAttributeIdsChange: (ids: string[]) => void
}

export function MergeModePanel({
  cls,
  allClasses,
  allRelations,
  selectedTargetClassId,
  onTargetClassIdChange,
  retainedAttributeIds,
  onRetainedAttributeIdsChange,
}: MergeModePanelProps) {
  const availableTargets = useMemo(
    () => allClasses.filter((c) => c.id !== cls.id),
    [allClasses, cls.id]
  )

  const targetClass = useMemo(
    () => allClasses.find((c) => c.id === selectedTargetClassId) ?? null,
    [allClasses, selectedTargetClassId]
  )

  // Count relations to migrate
  const affectedRelations = useMemo(() => {
    return allRelations.filter(
      (rel) => rel.domain_class_id === cls.id || rel.range_class_id === cls.id
    )
  }, [allRelations, cls.id])

  // Count child classes to reparent
  const childClasses = useMemo(() => {
    return allClasses.filter((c) => c.parent_class_id === cls.id)
  }, [allClasses, cls.id])

  function toggleRetainAttribute(attrId: string) {
    if (retainedAttributeIds.includes(attrId)) {
      onRetainedAttributeIdsChange(
        retainedAttributeIds.filter((id) => id !== attrId)
      )
    } else {
      onRetainedAttributeIdsChange([...retainedAttributeIds, attrId])
    }
  }

  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">
          Target Class to Merge Into
        </Label>
        <Select
          value={selectedTargetClassId ?? ""}
          onValueChange={(val) => onTargetClassIdChange(val || null)}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Select class to merge with..." />
          </SelectTrigger>
          <SelectContent>
            {availableTargets.map((target) => (
              <SelectItem key={target.id} value={target.id}>
                {target.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {targetClass && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-purple-900 dark:text-purple-300">
              <Layers className="h-4 w-4" />
              <span>
                Merge: <strong>{cls.name}</strong> →{" "}
                <strong>{targetClass.name}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-muted-foreground">
              <Badge variant="outline" className="text-[11px]">
                {affectedRelations.length} relations migrated
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                {childClasses.length} subclasses reparented
              </Badge>
            </div>
          </div>

          {cls.attributes.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
              <span className="font-medium text-foreground">
                Select Attributes to Transfer to {targetClass.name}:
              </span>
              <div className="space-y-1.5 pt-1">
                {cls.attributes.map((attr) => (
                  <label
                    key={attr.id}
                    className="flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={retainedAttributeIds.includes(attr.id)}
                      onChange={() => toggleRetainAttribute(attr.id)}
                      className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                    />
                    <span>
                      Transfer <strong>{attr.name}</strong> ({attr.data_type})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Note:</strong> Class <em>{cls.name}</em> will be archived
              and removed. All existing relation edges and child bindings will
              automatically point to <em>{targetClass.name}</em>.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
