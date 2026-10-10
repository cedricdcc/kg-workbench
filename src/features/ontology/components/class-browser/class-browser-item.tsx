"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { OntologyModule } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import { resolveExternalUri } from "@/features/ontology/utils/external-uri"
import { truncateWithEllipsis } from "@/lib/truncate-with-ellipsis"
import { cn } from "@/lib/utils"

const MODULE_NAME_MAX_LENGTH = 20
const DESCRIPTION_MAX_LENGTH = 50

interface ClassBrowserItemProps {
  cls: OntologyClassWithAttributes
  module?: OntologyModule
  relationCount: number
  noteCount: number
  instanceCount: number
  isSelected: boolean
  onSelect: () => void
}

export function ClassBrowserItem({
  cls,
  module,
  relationCount,
  noteCount,
  instanceCount,
  isSelected,
  onSelect,
}: ClassBrowserItemProps) {
  const moduleName = module
    ? truncateWithEllipsis(module.name, MODULE_NAME_MAX_LENGTH)
    : null
  const description = cls.description
    ? truncateWithEllipsis(cls.description, DESCRIPTION_MAX_LENGTH)
    : null

  const externalUri = resolveExternalUri(cls.name)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
        isSelected && "bg-muted"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {externalUri ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 cursor-help font-medium underline decoration-muted-foreground/40 decoration-dotted underline-offset-2">
                {cls.name}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="max-w-xs font-mono text-[11px] break-all"
            >
              {externalUri}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="min-w-0 font-medium">{cls.name}</span>
        )}
        {module && moduleName && (
          <Badge
            variant="secondary"
            className="max-w-[11rem] min-w-0 shrink overflow-hidden text-[10px] text-ellipsis"
            title={module.name}
          >
            {moduleName}
          </Badge>
        )}
      </div>
      {cls.description && description && (
        <p
          className="line-clamp-1 text-xs text-muted-foreground"
          title={cls.description}
        >
          {description}
        </p>
      )}
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>{instanceCount} inst</span>
        <span>{cls.attributes.length} attrs</span>
        <span>{relationCount} rels</span>
        <span>{noteCount} notes</span>
      </div>
    </button>
  )
}
