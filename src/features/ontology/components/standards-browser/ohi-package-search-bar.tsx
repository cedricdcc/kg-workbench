"use client"

import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OhiFormat } from "@/features/ontology/server/ohi/types"

const PREFERRED_FORMATS: ReadonlyArray<{ value: OhiFormat; label: string }> = [
  { value: "linkml-yaml", label: "linkml-yaml" },
  { value: "owl-turtle", label: "owl-turtle" },
  { value: "rdfs-turtle", label: "rdfs-turtle" },
]

interface OhiPackageSearchBarProps {
  query: string
  onQueryChange: (value: string) => void
  preferredFormat: OhiFormat
  onFormatChange: (format: OhiFormat) => void
}

export function OhiPackageSearchBar({
  query,
  onQueryChange,
  preferredFormat,
  onFormatChange,
}: OhiPackageSearchBarProps) {
  return (
    <div className="space-y-2 border-b p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search ohi.dev (e.g. w3c/dcat@3, prov-o, skos)..."
          className="h-8 pr-7 pl-8 text-xs"
          aria-label="Search ohi.dev packages"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
            aria-label="Clear ohi.dev search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Artifact Format
        </span>
        <Select
          value={preferredFormat}
          onValueChange={(val) => onFormatChange(val as OhiFormat)}
        >
          <SelectTrigger className="h-7 w-36 font-mono text-[11px]">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            {PREFERRED_FORMATS.map((fmt) => (
              <SelectItem
                key={fmt.value}
                value={fmt.value}
                className="font-mono text-[11px]"
              >
                {fmt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
