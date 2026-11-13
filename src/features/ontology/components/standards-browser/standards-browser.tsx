"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookMarked, Loader2, Package } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  addOhiPackageAction,
  getOhiPackageStateAction,
  inspectOhiPackageTreeAction,
  removeOhiPackageAction,
  searchOhiCatalogAction,
  syncOhiLockfileAction,
} from "@/features/ontology/server/actions/ohi-packages"
import type { OhiFormat } from "@/features/ontology/server/ohi/types"
import { OhiDependencyTreePreview } from "./ohi-dependency-tree-preview"
import { OhiLockfileStatusBar } from "./ohi-lockfile-status-bar"
import { OhiPackageCard } from "./ohi-package-card"
import { OhiPackageSearchBar } from "./ohi-package-search-bar"

interface StandardsBrowserProps {
  ontologyId: string
  onOpenManage?: () => void
}

export function StandardsBrowser({
  ontologyId,
  onOpenManage,
}: StandardsBrowserProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [preferredFormat, setPreferredFormat] =
    useState<OhiFormat>("linkml-yaml")
  const [inspectedRef, setInspectedRef] = useState<string | null>(null)

  const stateQuery = useQuery({
    queryKey: ["ohi-package-state", ontologyId],
    queryFn: () => getOhiPackageStateAction(ontologyId),
    enabled: Boolean(ontologyId),
  })

  const catalogQuery = useQuery({
    queryKey: ["ohi-catalog-search", searchQuery],
    queryFn: () => searchOhiCatalogAction(searchQuery, { limit: 12 }),
  })

  const treeQuery = useQuery({
    queryKey: ["ohi-package-tree", inspectedRef, preferredFormat],
    queryFn: () =>
      inspectOhiPackageTreeAction(inspectedRef!, preferredFormat),
    enabled: Boolean(inspectedRef),
  })

  const invalidateOhiAndReferences = () => {
    queryClient.invalidateQueries({
      queryKey: ["ohi-package-state", ontologyId],
    })
    queryClient.invalidateQueries({
      queryKey: ["reference-ontologies"],
    })
  }

  const addMutation = useMutation({
    mutationFn: (packageRef: string) =>
      addOhiPackageAction({
        ontologyId,
        packageRef,
        format: preferredFormat,
      }),
    onSuccess: (nextState, packageRef) => {
      queryClient.setQueryData(["ohi-package-state", ontologyId], nextState)
      invalidateOhiAndReferences()
      toast.success(`Locked ${packageRef} and dependencies in ohi.lock.json`)
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to add ohi.dev package"
      )
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => syncOhiLockfileAction(ontologyId),
    onSuccess: (nextState) => {
      queryClient.setQueryData(["ohi-package-state", ontologyId], nextState)
      invalidateOhiAndReferences()
      toast.success(
        `Verified ${nextState.verification.checked_files_count} locked file(s) via ohi sync`
      )
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync ohi.lock.json"
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (packageRef: string) =>
      removeOhiPackageAction({ ontologyId, packageRef }),
    onSuccess: (nextState, packageRef) => {
      queryClient.setQueryData(["ohi-package-state", ontologyId], nextState)
      invalidateOhiAndReferences()
      toast.success(`Removed ${packageRef} from ohi.yaml`)
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove package"
      )
    },
  })

  const installedRefSet = useMemo(() => {
    const refs = new Set<string>()
    for (const pkg of stateQuery.data?.packages ?? []) {
      refs.add(pkg.packageRef.toLowerCase())
      refs.add(`${pkg.namespace}/${pkg.name}`.toLowerCase())
    }
    return refs
  }, [stateQuery.data?.packages])

  const isMutating =
    addMutation.isPending || syncMutation.isPending || removeMutation.isPending

  const packageState = stateQuery.data
  const packages = packageState?.packages ?? []
  const directCount = packages.filter((p) => p.isDirect).length
  const catalogPackages = catalogQuery.data ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            ohi.dev Packages
          </span>
        </div>
        {onOpenManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenManage}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <BookMarked className="h-3.5 w-3.5 text-primary" />
            Manage
          </Button>
        )}
      </div>

      <OhiLockfileStatusBar
        status={packageState?.status ?? "empty"}
        lockedCount={packages.length}
        directCount={directCount}
        mismatchCount={packageState?.verification.mismatched_files.length ?? 0}
        isSyncing={syncMutation.isPending}
        onSync={() => syncMutation.mutate()}
      />

      <OhiPackageSearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        preferredFormat={preferredFormat}
        onFormatChange={setPreferredFormat}
      />

      {inspectedRef && (
        <OhiDependencyTreePreview
          preview={treeQuery.data ?? null}
          isLoading={treeQuery.isLoading}
          isInstalled={installedRefSet.has(inspectedRef.toLowerCase())}
          isAdding={addMutation.isPending}
          onAdd={(ref) => addMutation.mutate(ref)}
          onClose={() => setInspectedRef(null)}
        />
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Locked in ohi.lock.json ({packages.length})
              </span>
              {stateQuery.isLoading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>

            {!stateQuery.isLoading && packages.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                No ohi.dev packages locked yet. Add a package below to generate{" "}
                <span className="font-mono">ohi.yaml</span> and{" "}
                <span className="font-mono">ohi.lock.json</span>.
              </p>
            ) : (
              <div className="space-y-1.5">
                {packages.map((pkg) => (
                  <OhiPackageCard
                    key={`${pkg.packageRef}-${pkg.format}`}
                    variant="installed"
                    pkg={pkg}
                    isInspected={inspectedRef === pkg.packageRef}
                    isMutating={isMutating}
                    onInspectTree={(ref) =>
                      setInspectedRef((prev) => (prev === ref ? null : ref))
                    }
                    onSync={() => syncMutation.mutate()}
                    onRemove={(ref) => removeMutation.mutate(ref)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                ohi.dev Catalog ({catalogPackages.length})
              </span>
              {catalogQuery.isLoading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>

            {!catalogQuery.isLoading && catalogPackages.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-muted-foreground">
                No matching ohi.dev packages found.
              </p>
            ) : (
              <div className="space-y-1.5">
                {catalogPackages.map((pkg) => {
                  const versionedRef = pkg.package_ref.includes("@")
                    ? pkg.package_ref
                    : pkg.latest_version
                      ? `${pkg.package_ref}@${pkg.latest_version}`
                      : pkg.package_ref
                  const isInstalled =
                    installedRefSet.has(versionedRef.toLowerCase()) ||
                    installedRefSet.has(pkg.package_ref.toLowerCase())

                  return (
                    <OhiPackageCard
                      key={pkg.package_ref}
                      variant="catalog"
                      pkg={pkg}
                      isInstalled={isInstalled}
                      isInspected={inspectedRef === versionedRef}
                      isMutating={isMutating}
                      onInspectTree={(ref) =>
                        setInspectedRef((prev) => (prev === ref ? null : ref))
                      }
                      onAdd={(ref) => addMutation.mutate(ref)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
