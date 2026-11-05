import type { ArchivedDatasetSource } from "@/features/tabular/types"

export interface FormatBadge {
  label: string
  bgClass: string
  textClass: string
  borderClass: string
}

export function formatDatasetFormatBadge(format: string): FormatBadge {
  const norm = format.toLowerCase()
  if (norm === "csv" || norm === "tsv") {
    return {
      label: "CSV",
      bgClass: "bg-emerald-500/10",
      textClass: "text-emerald-700 dark:text-emerald-400",
      borderClass: "border-emerald-500/30",
    }
  }
  if (norm === "parquet" || norm === "pq") {
    return {
      label: "PARQUET",
      bgClass: "bg-blue-500/10",
      textClass: "text-blue-700 dark:text-blue-400",
      borderClass: "border-blue-500/30",
    }
  }
  if (norm === "excel" || norm === "xlsx" || norm === "xls") {
    return {
      label: "EXCEL",
      bgClass: "bg-teal-500/10",
      textClass: "text-teal-700 dark:text-teal-400",
      borderClass: "border-teal-500/30",
    }
  }
  return {
    label: format.toUpperCase(),
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-700 dark:text-slate-400",
    borderClass: "border-slate-500/30",
  }
}

export interface DatasetArchiveBrowserProps {
  ontologyId: string
  datasets: ArchivedDatasetSource[]
  onOpenUpload: () => void
  onInspectProfile: (dataset: ArchivedDatasetSource) => void
  onOpenMappingWizard: (dataset: ArchivedDatasetSource) => void
  onDeleteDataset: (id: string) => Promise<void>
}
