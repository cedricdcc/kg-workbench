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
import { getReferenceOntologies, type ReferenceOntologySummary } from "@/features/ontology/server/queries/reference-vocabularies"
import { VocabularySearchTab } from "./vocabulary-search-tab"
import { VocabularyLibraryTab } from "./vocabulary-library-tab"

interface ReferenceVocabulariesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReferenceVocabulariesDialog({
  open,
  onOpenChange,
}: ReferenceVocabulariesDialogProps) {
  const [activeTab, setActiveTab] = useState("library")
  const queryClient = useQueryClient()

  const { data: vocabularies = [], isLoading } = useQuery<ReferenceOntologySummary[]>({
    queryKey: ["reference-ontologies"],
    queryFn: () => getReferenceOntologies(),
    enabled: open,
  })

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["reference-ontologies"] })
  }

  const existingPrefixes = useMemo(() => {
    return new Set(vocabularies.map((v) => v.prefix.toLowerCase()))
  }, [vocabularies])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-4 w-4 text-primary" />
            Reference Vocabularies & Standard Ontologies
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage external reference ontologies (OLS4 & LOV). These ground AI generation and entity alignment using zero-cost local vector matching.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Workspace Library ({vocabularies.length})
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              Search & Add (OLS4 / LOV)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library">
            <VocabularyLibraryTab
              vocabularies={vocabularies}
              isLoading={isLoading}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="search">
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
