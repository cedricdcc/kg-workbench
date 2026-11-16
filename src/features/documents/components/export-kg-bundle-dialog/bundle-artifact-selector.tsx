"use client"

import { useState } from "react"
import { Check, Copy, Download, FileCode2, Files } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { KnowledgeGraphExportBundle } from "../../server/actions/build-kg-bundle"
import { BUNDLE_ARTIFACTS, type BundleArtifactKey } from "./types"

interface BundleArtifactSelectorProps {
  bundle: KnowledgeGraphExportBundle
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
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

export function BundleArtifactSelector({ bundle }: BundleArtifactSelectorProps) {
  const [activeKey, setActiveKey] = useState<BundleArtifactKey>("instances_ttl")
  const [copiedKey, setCopiedKey] = useState<BundleArtifactKey | null>(null)

  const activeArtifact =
    BUNDLE_ARTIFACTS.find((item) => item.key === activeKey) ??
    BUNDLE_ARTIFACTS[0]
  const activeContent = bundle.files[activeArtifact.key] ?? ""

  async function handleCopy(key: BundleArtifactKey, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedKey(key)
      toast.success("Copied artifact to clipboard.")
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 2000)
    } catch {
      toast.error("Failed to copy artifact to clipboard.")
    }
  }

  function handleDownloadAll() {
    for (const artifact of BUNDLE_ARTIFACTS) {
      const content = bundle.files[artifact.key] ?? ""
      if (content.trim() === "") continue
      triggerFileDownload(artifact.filename, content, artifact.mimeType)
    }
    toast.success("Downloaded Knowledge Graph bundle files.")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Files className="size-3.5" />
          <span>Bundle Artifacts (6 files)</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={handleDownloadAll}
          className="h-8 gap-1.5 text-xs"
        >
          <Download className="size-3.5" />
          Download All
        </Button>
      </div>

      <Tabs
        value={activeKey}
        onValueChange={(value) => setActiveKey(value as BundleArtifactKey)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          {BUNDLE_ARTIFACTS.map((artifact) => {
            const hasContent = (bundle.files[artifact.key] ?? "").trim().length > 0
            return (
              <TabsTrigger
                key={artifact.key}
                value={artifact.key}
                className="gap-1.5 text-xs"
              >
                <FileCode2 className="size-3.5" />
                <span>{artifact.label}</span>
                {!hasContent ? (
                  <Badge variant="outline" className="px-1 py-0 text-[10px]">
                    empty
                  </Badge>
                ) : null}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {BUNDLE_ARTIFACTS.map((artifact) => {
          const content = bundle.files[artifact.key] ?? ""
          const isCopied = copiedKey === artifact.key

          return (
            <TabsContent
              key={artifact.key}
              value={artifact.key}
              className="mt-2 flex min-h-0 flex-1 flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium">{artifact.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {artifact.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopy(artifact.key, content)}
                    disabled={!content}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    {isCopied ? (
                      <Check className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {isCopied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      triggerFileDownload(
                        artifact.filename,
                        content,
                        artifact.mimeType
                      )
                    }
                    disabled={!content}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Download className="size-3" />
                    Download
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[260px] rounded-md border bg-muted/20">
                <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                  {activeContent || "// No content available for this artifact."}
                </pre>
              </ScrollArea>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
