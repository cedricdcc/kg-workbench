"use client"

import { useMemo } from "react"
import { AlertCircle, Info } from "lucide-react"

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
import {
  computeInheritedAttributesAndRelations,
  validateHierarchyAcyclicity,
} from "@/features/ontology/utils/hierarchy-validation"

interface ReparentModePanelProps {
  cls: OntologyClassWithAttributes
  allClasses: OntologyClassWithAttributes[]
  allRelations: OntologyRelation[]
  selectedParentClassId: string | null
  onParentClassIdChange: (parentId: string | null) => void
  dropAttributeIds: string[]
  onDropAttributeIdsChange: (ids: string[]) => void
}

export function ReparentModePanel({
  cls,
  allClasses,
  allRelations,
  selectedParentClassId,
  onParentClassIdChange,
  dropAttributeIds,
  onDropAttributeIdsChange,
}: ReparentModePanelProps) {
  const availableParents = useMemo(
    () => allClasses.filter((c) => c.id !== cls.id),
    [allClasses, cls.id]
  )

  const cycleCheck = useMemo(() => {
    if (!selectedParentClassId) return { valid: true }
    return validateHierarchyAcyclicity(
      cls.id,
      selectedParentClassId,
      allClasses
    )
  }, [cls.id, selectedParentClassId, allClasses])

  const inheritedPreview = useMemo(() => {
    if (!selectedParentClassId) return null
    return computeInheritedAttributesAndRelations(
      cls.id,
      allClasses.map((c) =>
        c.id === cls.id ? { ...c, parent_class_id: selectedParentClassId } : c
      ),
      allRelations
    )
  }, [cls.id, selectedParentClassId, allClasses, allRelations])

  // Identify local attributes whose names match newly inherited attributes
  const redundantAttributes = useMemo(() => {
    if (!inheritedPreview) return []
    const inheritedNames = new Set(
      inheritedPreview.inheritedAttributes.map((a) => a.name.toLowerCase())
    )
    return cls.attributes.filter((attr) =>
      inheritedNames.has(attr.name.toLowerCase())
    )
  }, [cls.attributes, inheritedPreview])

  function toggleDropAttribute(attrId: string) {
    if (dropAttributeIds.includes(attrId)) {
      onDropAttributeIdsChange(dropAttributeIds.filter((id) => id !== attrId))
    } else {
      onDropAttributeIdsChange([...dropAttributeIds, attrId])
    }
  }

  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">New Superclass (Parent)</Label>
        <Select
          value={selectedParentClassId ?? "__none__"}
          onValueChange={(val) =>
            onParentClassIdChange(val === "__none__" ? null : val)
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Select superclass..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (Root Class)</SelectItem>
            {availableParents.map((parent) => (
              <SelectItem key={parent.id} value={parent.id}>
                {parent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!cycleCheck.valid && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Hierarchy Cycle: Selecting this superclass causes an illegal loop (
            {cycleCheck.cyclePath?.join(" → ")}).
          </span>
        </div>
      )}

      {redundantAttributes.length > 0 && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="h-3.5 w-3.5 text-amber-500" />
            Duplicate Attributes Detected
          </div>
          <p className="text-[11px] text-muted-foreground">
            The new superclass already defines these attributes. Select which
            local attributes to drop to prevent redundancy:
          </p>
          <div className="space-y-1.5 pt-1">
            {redundantAttributes.map((attr) => (
              <label
                key={attr.id}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={dropAttributeIds.includes(attr.id)}
                  onChange={() => toggleDropAttribute(attr.id)}
                  className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  Drop <strong>{attr.name}</strong> ({attr.data_type})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {inheritedPreview && (
        <div className="space-y-1.5 rounded-md border bg-muted/10 p-2.5 text-xs">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Properties Inherited upon Reparenting
          </span>
          <div className="flex flex-wrap gap-1.5">
            {inheritedPreview.inheritedAttributes.map((attr, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {attr.name} (from {attr.inheritedFromClassName})
              </Badge>
            ))}
            {inheritedPreview.inheritedRelations.map((rel, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {rel.name} (from {rel.inheritedFromClassName})
              </Badge>
            ))}
            {inheritedPreview.inheritedAttributes.length === 0 &&
              inheritedPreview.inheritedRelations.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic">
                  No properties inherited from selected parent.
                </span>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
