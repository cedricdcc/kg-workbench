"use client"

import { useMemo, useState } from "react"
import { BookMarked, Globe, Layers } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getReferenceOntologies,
  type ReferenceOntologySummary,
} from "@/features/ontology/server/queries/reference-vocabularies"
import { VocabularySearchTab } from "./vocabulary-search-tab"
import { VocabularyLibraryTab } from "./vocabulary-library-tab"
import { VocabularyTermsView } from "./vocabulary-terms-view"

interface ReferenceVocabulariesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReferenceVocabulariesDialog({
  open,
  onOpenChange,
}: ReferenceVocabulariesDialogProps) {
  const [activeTab, setActiveTab] = useState("library")
  const [selectedVocabulary, setSelectedVocabulary] =
    useState<ReferenceOntologySummary | null>(null)
  const queryClient = useQueryClient()

  const { data: vocabularies = [], isLoading } = useQuery<
    ReferenceOntologySummary[]
  >({
    queryKey: ["reference-ontologies"],
    queryFn: () => getReferenceOntologies(),
    enabled: open,
  })

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["reference-ontologies"] })
    if (selectedVocabulary) {
      queryClient.invalidateQueries({
        queryKey: ["reference-ontology-terms", selectedVocabulary.id],
      })
    }
  }

  const existingPrefixes = useMemo(() => {
    return new Set(vocabularies.map((v) => v.prefix.toLowerCase()))
  }, [vocabularies])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelectedVocabulary(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden p-6 sm:max-w-5xl">
        <DialogHeader className="shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-4 w-4 text-primary" />
            Reference Vocabularies & Standard Ontologies
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage external reference ontologies (OLS4 & LOV). These ground AI
            generation and entity alignment using zero-cost local vector
            matching.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val)
            if (val === "search") {
              setSelectedVocabulary(null)
            }
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="library" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Workspace Library ({vocabularies.length})
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              Search & Add (OLS4 / LOV)
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="library"
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            {selectedVocabulary ? (
              <VocabularyTermsView
                vocabulary={selectedVocabulary}
                onBack={() => setSelectedVocabulary(null)}
              />
            ) : (
              <VocabularyLibraryTab
                vocabularies={vocabularies}
                isLoading={isLoading}
                onRefresh={handleRefresh}
                onSelectVocabulary={setSelectedVocabulary}
              />
            )}
          </TabsContent>

          <TabsContent
            value="search"
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <VocabularySearchTab
              existingPrefixes={existingPrefixes}
              onAdded={() => {
                handleRefresh()
                setActiveTab("library")
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
