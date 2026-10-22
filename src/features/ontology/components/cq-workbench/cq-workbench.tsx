"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { OntologyModule, OntologyRelation } from "@/domain/ontology"
import type {
  OntologyClassWithAttributes,
  OntologyCQWithModules,
} from "@/features/ontology/server/queries"
import {
  createCQ,
  deleteCQ,
  setCQModules,
  updateCQ,
} from "@/features/ontology/server/actions/competency-questions"
import {
  calculateCqCoverageSummary,
  evaluateCqCoverage,
} from "@/features/ontology/utils/cq-coverage"
import { AiGenerateOntologyDialog } from "../ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-dialog"
import { CqMetricsBar } from "./cq-metrics-bar"
import { CqListPanel } from "./cq-list-panel/cq-list-panel"
import { CqDetailPanel } from "./cq-detail-panel/cq-detail-panel"
import type { CqFilterState } from "./types"

export interface CqWorkbenchProps {
  ontologyId: string
  cqs: OntologyCQWithModules[]
  classes: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  modules: OntologyModule[]
  currentModuleId?: string | null
}

export function CqWorkbench({
  ontologyId,
  cqs,
  classes,
  relations,
  modules,
  currentModuleId = null,
}: CqWorkbenchProps) {
  const router = useRouter()

  const [filters, setFilters] = useState<CqFilterState>({
    search: "",
    moduleId: currentModuleId,
    coverageFilter: "all",
  })

  const [selectedCqId, setSelectedCqId] = useState<string | null>(
    cqs.length > 0 ? cqs[0].id : null
  )
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false)

  // 1. Evaluate coverage for all CQs
  const { summary, evaluationsById } = useMemo(() => {
    const summary = calculateCqCoverageSummary(cqs, classes, relations)
    const map: Record<string, ReturnType<typeof evaluateCqCoverage>> = {}
    for (const cq of cqs) {
      map[cq.id] = evaluateCqCoverage(cq, classes, relations)
    }
    return { summary, evaluationsById: map }
  }, [cqs, classes, relations])

  // 2. Filter CQs
  const filteredCqs = useMemo(() => {
    return cqs.filter((cq) => {
      // Text search
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase()
        const questionMatches = cq.question.toLowerCase().includes(query)
        const evalItem = evaluationsById[cq.id]
        const subjectMatches = evalItem?.subjectClassName?.toLowerCase().includes(query) ?? false
        const predicateMatches = evalItem?.predicateRelationName?.toLowerCase().includes(query) ?? false
        const objectMatches = evalItem?.objectClassName?.toLowerCase().includes(query) ?? false
        if (!questionMatches && !subjectMatches && !predicateMatches && !objectMatches) {
          return false
        }
      }

      // Module filter
      if (filters.moduleId) {
        const hasModule = (cq.modules ?? []).some((m) => m.id === filters.moduleId)
        if (!hasModule) return false
      }

      // Coverage status filter
      if (filters.coverageFilter !== "all") {
        const status = evaluationsById[cq.id]?.status ?? "unmapped"
        if (filters.coverageFilter === "covered" && status !== "full") {
          return false
        }
        if (filters.coverageFilter === "unmapped" && status === "full") {
          return false
        }
      }

      return true
    })
  }, [cqs, evaluationsById, filters])

  // Resolve active CQ object
  const activeCq = useMemo(() => {
    if (!selectedCqId) return null
    return cqs.find((cq) => cq.id === selectedCqId) ?? null
  }, [cqs, selectedCqId])

  // Keep selection valid when filters or items change
  const effectiveSelectedId = activeCq ? activeCq.id : filteredCqs[0]?.id ?? null

  function handleFilterChange(updates: Partial<CqFilterState>) {
    setFilters((prev) => ({ ...prev, ...updates }))
  }

  // Action: Add new CQ
  async function handleAddCq(customQuestion?: string) {
    try {
      const created = await createCQ(ontologyId, {
        question: customQuestion ?? "What domain concept or fact must this ontology specify?",
        sortOrder: cqs.length,
      })

      if (filters.moduleId) {
        await setCQModules(created.id, [filters.moduleId])
      }

      setSelectedCqId(created.id)
      router.refresh()
      toast.success("Competency question created.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create question.")
    }
  }

  // Action: Duplicate CQ
  async function handleDuplicateCq(cq: OntologyCQWithModules) {
    try {
      const created = await createCQ(ontologyId, {
        question: `${cq.question} (Copy)`,
        subjectClassId: cq.subject_class_id,
        predicateRelationId: cq.predicate_relation_id,
        objectClassId: cq.object_class_id,
        sortOrder: cqs.length,
      })

      const moduleIds = (cq.modules ?? []).map((m) => m.id)
      if (moduleIds.length > 0) {
        await setCQModules(created.id, moduleIds)
      }

      setSelectedCqId(created.id)
      router.refresh()
      toast.success("Question duplicated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate question.")
    }
  }

  // Action: Delete CQ
  async function handleDeleteCq(id: string) {
    try {
      await deleteCQ(id)
      if (selectedCqId === id) {
        const remaining = filteredCqs.filter((item) => item.id !== id)
        setSelectedCqId(remaining[0]?.id ?? null)
      }
      router.refresh()
      toast.success("Question deleted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete question.")
    }
  }

  // Action: Update Question text
  async function handleUpdateQuestion(question: string) {
    if (!effectiveSelectedId) return
    try {
      await updateCQ(effectiveSelectedId, { question })
      router.refresh()
      toast.success("Question formulation saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update question.")
    }
  }

  // Action: Update Concept Mapping
  async function handleUpdateMapping(mapping: {
    subjectClassId: string | null
    predicateRelationId: string | null
    objectClassId: string | null
  }) {
    if (!effectiveSelectedId) return
    try {
      await updateCQ(effectiveSelectedId, mapping)
      router.refresh()
      toast.success("Concept mapping updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update concept mapping.")
    }
  }

  // Action: Toggle Module Association
  async function handleToggleModule(moduleId: string) {
    if (!activeCq) return
    try {
      const currentIds = new Set((activeCq.modules ?? []).map((m) => m.id))
      if (currentIds.has(moduleId)) {
        currentIds.delete(moduleId)
      } else {
        currentIds.add(moduleId)
      }
      await setCQModules(activeCq.id, Array.from(currentIds))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update module association.")
    }
  }

  // Action: Reorder CQ
  async function handleReorder(id: string, direction: "up" | "down") {
    const currentIndex = filteredCqs.findIndex((item) => item.id === id)
    if (currentIndex === -1) return

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= filteredCqs.length) return

    const targetItem = filteredCqs[targetIndex]
    try {
      const currentOrder = currentIndex
      const targetOrder = targetIndex
      await Promise.all([
        updateCQ(id, { sortOrder: targetOrder }),
        updateCQ(targetItem.id, { sortOrder: currentOrder }),
      ])
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder question.")
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top Coverage Metrics Bar & Filter Toolbar */}
      <CqMetricsBar
        summary={summary}
        modules={modules}
        filters={filters}
        onFilterChange={handleFilterChange}
        onAddQuestion={() => handleAddCq()}
        onAiDraft={() => setAiGenerateOpen(true)}
      />

      {/* Main Split Workbench: List (50%) | Inspector (50%) */}
      <div className="flex min-h-0 flex-1">
        {/* Left/Center Pane: CQ List Panel */}
        <div className="w-1/2 min-w-[340px] max-w-2xl border-r border-border/60">
          <CqListPanel
            cqs={filteredCqs}
            evaluationsById={evaluationsById}
            selectedCqId={effectiveSelectedId}
            searchQuery={filters.search}
            onSelectCq={setSelectedCqId}
            onQuickAdd={(q) => handleAddCq(q)}
            onDuplicateCq={handleDuplicateCq}
            onDeleteCq={handleDeleteCq}
            onReorderCq={handleReorder}
          />
        </div>

        {/* Right Pane: Concept Mapping & Detail Inspector */}
        <div className="flex-1 min-w-[380px] bg-card/20">
          <CqDetailPanel
            cq={activeCq}
            classes={classes}
            relations={relations}
            modules={modules}
            currentModuleId={filters.moduleId}
            onUpdateQuestion={handleUpdateQuestion}
            onUpdateMapping={handleUpdateMapping}
            onToggleModule={handleToggleModule}
            onDelete={() => {
              if (activeCq) handleDeleteCq(activeCq.id)
              return Promise.resolve()
            }}
          />
        </div>
      </div>

      {/* AI Generate from CQs Dialog */}
      <AiGenerateOntologyDialog
        open={aiGenerateOpen}
        onOpenChange={setAiGenerateOpen}
        ontologyId={ontologyId}
        cqCount={summary.totalCount}
      />
    </div>
  )
}
