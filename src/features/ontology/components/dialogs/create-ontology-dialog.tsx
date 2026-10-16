"use client"

import { useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { toast } from "sonner"
import {
  FileCode,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { createOntologyDocument } from "@/features/ontology/server/actions/ontology-documents"
import { importOntologyFromTurtle } from "@/features/ontology/server/actions/ontology-transfer"
import { cn } from "@/lib/utils"

const DEFAULT_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
] as const

interface CreateOntologyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (docId: string) => void
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getTurtlePreview(text: string, fallbackFileName?: string) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const classMatches = trimmed.match(
    /(?:a|rdf:type)\s+(?:owl:Class|rdfs:Class)\b/g
  )
  const classCount = classMatches ? classMatches.length : 0

  const titleMatch = trimmed.match(
    /(?:dc:title|dct:title|dcterms:title|rdfs:label)\s+"([^"\\]*(?:\\.[^"\\]*)*)"/i
  )
  const descMatch = trimmed.match(
    /(?:rdfs:comment|dc:description|dct:description|dcterms:description)\s+"([^"\\]*(?:\\.[^"\\]*)*)"/i
  )

  const title = titleMatch
    ? titleMatch[1]
    : fallbackFileName
      ? fallbackFileName.replace(/\.[^/.]+$/, "")
      : undefined
  const description = descMatch ? descMatch[1] : undefined

  return {
    title,
    description,
    classCount,
  }
}

export function CreateOntologyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOntologyDialogProps) {
  // Blank tab state
  const [defaultLanguage, setDefaultLanguage] = useState("")
  const [name, setName] = useState("")
  const [usecase, setUsecase] = useState("")
  const [defaultLanguageError, setDefaultLanguageError] = useState<
    string | null
  >(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Turtle tab state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [turtleText, setTurtleText] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isTextOpen, setIsTextOpen] = useState(false)
  const [isImportPending, setIsImportPending] = useState(false)

  const normalizedDefaultLanguage = defaultLanguage.trim().toLowerCase()
  const trimmedName = name.trim()
  const isCreateDisabled =
    isPending || !normalizedDefaultLanguage || !trimmedName

  const activeContent = turtleText
  const turtlePreview = getTurtlePreview(activeContent, selectedFile?.name)
  const isImportDisabled =
    isImportPending || (!selectedFile && !turtleText.trim())

  function resolveDefaultLanguageLabel(languageCode: string) {
    return (
      DEFAULT_LANGUAGE_OPTIONS.find((option) => option.code === languageCode)
        ?.label ?? languageCode
    )
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      setDefaultLanguage("")
      setName("")
      setUsecase("")
      setDefaultLanguageError(null)
      setNameError(null)
      setSelectedFile(null)
      setTurtleText("")
      setIsDragging(false)
      setIsTextOpen(false)
    }
    onOpenChange(value)
  }

  async function handleFileSelected(file: File) {
    setSelectedFile(file)
    try {
      const text = await file.text()
      setTurtleText(text)
    } catch {
      toast.error("Failed to read the selected file.")
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
    e.target.value = ""
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null)
    setTurtleText("")
  }

  async function handleBlankSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isCreateDisabled) {
      return
    }

    const trimmedUsecase = usecase.trim()
    if (!normalizedDefaultLanguage) {
      setDefaultLanguageError("Default language is required.")
      return
    }
    setDefaultLanguageError(null)
    if (!trimmedName) {
      setNameError("Name is required.")
      return
    }
    setNameError(null)
    setIsPending(true)

    try {
      const doc = await createOntologyDocument({
        defaultLanguage: normalizedDefaultLanguage,
        defaultLanguageLabel: resolveDefaultLanguageLabel(
          normalizedDefaultLanguage
        ),
        name: trimmedName,
        usecase: trimmedUsecase,
      })
      handleOpenChange(false)
      onSuccess(doc.id)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create ontology."
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleTurtleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isImportDisabled) {
      return
    }

    setIsImportPending(true)
    try {
      const { ontologyId, warnings } = await importOntologyFromTurtle({
        content: turtleText,
        fileName: selectedFile?.name || "imported-ontology.ttl",
      })

      if (warnings.length > 0) {
        toast.warning("Imported with visual warnings.", {
          description: warnings.slice(0, 3).join(" "),
        })
      } else {
        toast.success("Ontology imported from Turtle successfully.")
      }

      handleOpenChange(false)
      onSuccess(ontologyId)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import Turtle ontology."
      )
    } finally {
      setIsImportPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Ontology</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="blank" className="w-full">
          <TabsList className="mb-2 grid w-full grid-cols-2">
            <TabsTrigger value="blank">Blank Ontology</TabsTrigger>
            <TabsTrigger value="turtle">Import from Turtle</TabsTrigger>
          </TabsList>

          <TabsContent value="blank">
            <form onSubmit={handleBlankSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="ontology-default-language">
                  Default Language
                </Label>
                <Input
                  id="ontology-default-language"
                  list="ontology-default-language-options"
                  value={defaultLanguage}
                  onChange={(e) => {
                    setDefaultLanguage(e.target.value)
                    if (defaultLanguageError) {
                      setDefaultLanguageError(null)
                    }
                  }}
                  placeholder="e.g. en"
                  autoFocus
                />
                <datalist id="ontology-default-language-options">
                  {DEFAULT_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
                {defaultLanguageError && (
                  <p className="text-xs text-destructive">
                    {defaultLanguageError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ontology-name">Name</Label>
                <Input
                  id="ontology-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) {
                      setNameError(null)
                    }
                  }}
                  placeholder="e.g. My Ontology"
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ontology-usecase">Use Case</Label>
                <Textarea
                  id="ontology-usecase"
                  value={usecase}
                  onChange={(e) => setUsecase(e.target.value)}
                  placeholder="Describe the intended use case for this ontology"
                  className="min-h-24"
                />
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
                <Button type="submit" disabled={isCreateDisabled}>
                  {isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="turtle">
            <form onSubmit={handleTurtleSubmit} className="space-y-4 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".ttl,.n3,.owl"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {/* File Dropzone or Selected File Display */}
              {selectedFile ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 rounded bg-primary/10 p-2 text-primary">
                      <FileCode className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={clearSelectedFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-all duration-150 select-none",
                    isDragging
                      ? "scale-[0.99] border-primary bg-primary/5"
                      : "border-border/80 hover:border-primary/50 hover:bg-muted/20"
                  )}
                >
                  <div className="mb-2 rounded-full bg-primary/10 p-2.5 text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium">
                    Click to upload or drag & drop
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Turtle (.ttl), Notation3 (.n3), or OWL (.owl)
                  </p>
                </div>
              )}

              {/* Collapsible raw text area */}
              <Collapsible
                open={isTextOpen}
                onOpenChange={setIsTextOpen}
                className="space-y-2"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-between px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span>Or paste raw Turtle text directly</span>
                    {isTextOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1.5">
                  <Textarea
                    value={turtleText}
                    onChange={(e) => {
                      setTurtleText(e.target.value)
                      if (selectedFile) {
                        setSelectedFile(null)
                      }
                    }}
                    placeholder={`@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n:MyClass a owl:Class .\n:name a owl:DatatypeProperty .`}
                    className="max-h-[220px] min-h-[120px] font-mono text-xs"
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Live Preview Card */}
              {turtlePreview &&
                (turtlePreview.title || turtlePreview.classCount > 0) && (
                  <div className="animate-in space-y-1.5 rounded-md border border-border/80 bg-muted/30 p-3 text-xs duration-200 fade-in">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Detected Ontology
                      </span>
                      {turtlePreview.classCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {turtlePreview.classCount}{" "}
                          {turtlePreview.classCount === 1 ? "class" : "classes"}
                        </Badge>
                      )}
                    </div>
                    {turtlePreview.title && (
                      <p className="truncate font-medium text-foreground">
                        {turtlePreview.title}
                      </p>
                    )}
                    {turtlePreview.description && (
                      <p className="line-clamp-2 text-muted-foreground italic">
                        &ldquo;{turtlePreview.description}&rdquo;
                      </p>
                    )}
                  </div>
                )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isImportPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isImportDisabled}>
                  {isImportPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Import Ontology"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
