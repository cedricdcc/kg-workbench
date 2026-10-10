"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OntologyModule } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import { updateClass } from "@/features/ontology/server/actions/classes"
import { ClassPicker } from "@/components/shared/class-picker"

import {
  evaluateOntologyAssistance,
  useOntologyAssist,
} from "@/features/ontology/hooks/use-ontology-assist"
import { SmartAssistChip } from "@/features/ontology/components/shared/smart-assist-chip"

interface ClassDetailHeaderProps {
  cls: OntologyClassWithAttributes
  modules: OntologyModule[]
  allClasses: OntologyClassWithAttributes[]
}

export function ClassDetailHeader({
  cls,
  modules,
  allClasses,
}: ClassDetailHeaderProps) {
  const [isPending, startTransition] = useTransition()
  const parentOptions = allClasses.filter((c) => c.id !== cls.id)

  const assist = useOntologyAssist({
    query: cls.name,
    entityType: "class",
    targetClassId: cls.id,
    parentClassId: cls.parent_class_id,
    allClasses,
  })

  function handleModuleChange(moduleId: string) {
    startTransition(async () => {
      await updateClass(cls.id, {
        moduleId: moduleId === "__none__" ? null : moduleId,
      })
    })
  }

  function handleParentChange(parentId: string) {
    const targetParentId = parentId === "__none__" ? null : parentId
    const check = evaluateOntologyAssistance({
      query: cls.name,
      entityType: "class",
      targetClassId: cls.id,
      parentClassId: targetParentId,
      allClasses,
    })

    if (check.isCycle) {
      toast.error(check.cycleMessage ?? "Cannot set parent: cycle detected.")
      return
    }

    startTransition(async () => {
      await updateClass(cls.id, {
        parentClassId: targetParentId,
      })
    })
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start">
      <div className="w-full min-w-0 md:w-fit">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Module</p>
        <Select
          value={cls.module_id ?? "__none__"}
          onValueChange={handleModuleChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full min-w-0 md:w-fit">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Parent class
        </p>
        <ClassPicker
          value={cls.parent_class_id ?? "__none__"}
          onValueChange={handleParentChange}
          allClasses={parentOptions}
          modules={modules}
          currentModuleId={cls.module_id}
          disabled={isPending}
          noneOption={{ label: "None", value: "__none__" }}
          className="w-fit max-w-full"
        />
        <SmartAssistChip assist={assist} className="mt-1" />
      </div>
    </div>
  )
}
