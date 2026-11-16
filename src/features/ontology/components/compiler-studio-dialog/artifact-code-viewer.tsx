"use client"

import { useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface ArtifactCodeViewerProps {
  title: string
  filename: string
  mimeType: string
  languageLabel: string
  content: string
  emptyMessage?: string
}

export function triggerArtifactDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ArtifactCodeViewer({
  title,
  filename,
  mimeType,
  languageLabel,
  content,
  emptyMessage = "No artifact output generated.",
}: ArtifactCodeViewerProps) {
  const [copied, setCopied] = useState(false)

  const hasContent = content.trim().length > 0
  const lineCount = hasContent ? content.split("\n").length : 0

  async function handleCopy() {
    if (!hasContent) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      toast.success(`Copied ${filename} to clipboard`)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  function handleDownload() {
    if (!hasContent) return
    triggerArtifactDownload(content, filename, mimeType)
    toast.success(`Downloaded ${filename}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline" className="font-mono text-xs">
            {filename}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {languageLabel}
          </Badge>
          {hasContent && (
            <span className="text-xs text-muted-foreground">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasContent}
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
            disabled={!hasContent}
            onClick={handleDownload}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download {filename}
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-md border bg-muted/40">
        {hasContent ? (
          <pre className="p-4 font-mono text-xs leading-relaxed text-foreground">
            <code>{content}</code>
          </pre>
        ) : (
          <div className="flex h-48 items-center justify-center p-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
