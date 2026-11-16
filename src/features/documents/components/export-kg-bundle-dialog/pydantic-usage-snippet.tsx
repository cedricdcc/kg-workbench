"use client"

import { useState } from "react"
import { Check, Copy, Terminal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

const PYDANTIC_USAGE_SNIPPET = `import json
from pathlib import Path
from pydantic import TypeAdapter
from models import *  # noqa: F403

payload = json.loads(Path("instances.json").read_text(encoding="utf-8"))
entities = TypeAdapter(list[dict]).validate_python(payload["entities"])
print(f"Loaded {len(entities)} validated entities for {payload['ontology_id']}")`

export function PydanticUsageSnippet() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PYDANTIC_USAGE_SNIPPET)
      setCopied(true)
      toast.success("Copied Python usage snippet.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy snippet.")
    }
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span>Pydantic v2 Validation Snippet</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void handleCopy()}
          className="h-7 gap-1 px-2 text-xs"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded border bg-background p-2.5 font-mono text-[11px] leading-relaxed">
        {PYDANTIC_USAGE_SNIPPET}
      </pre>
    </div>
  )
}
