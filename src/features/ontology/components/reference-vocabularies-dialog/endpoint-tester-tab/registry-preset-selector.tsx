"use client"

import { Badge } from "@/components/ui/badge"

export interface RegistryPreset {
  id: string
  name: string
  endpoint: string
  category: "general" | "biomedical" | "agri_eco" | "eu_public" | "custom"
  requiresApiKey?: boolean
  defaultQuery: string
  description: string
}

export const REGISTRY_PRESETS: RegistryPreset[] = [
  {
    id: "bartoc",
    name: "BARTOC",
    endpoint: "https://bartoc.org/api/voc",
    category: "general",
    defaultQuery: "sensor",
    description: "Thesauri, ontologies & universal classification schemes",
  },
  {
    id: "ols4",
    name: "OLS4",
    endpoint: "https://www.ebi.ac.uk/ols4/api",
    category: "biomedical",
    defaultQuery: "sosa",
    description: "EMBL-EBI Ontology Lookup Service for life sciences",
  },
  {
    id: "agroportal",
    name: "AgroPortal",
    endpoint: "https://data.agroportal.eu",
    category: "agri_eco",
    requiresApiKey: true,
    defaultQuery: "crop",
    description: "Agronomy, agriculture and plant sciences (OntoPortal)",
  },
  {
    id: "bioportal",
    name: "BioPortal",
    endpoint: "https://data.bioontology.org",
    category: "biomedical",
    requiresApiKey: true,
    defaultQuery: "anatomy",
    description: "Biomedical & life science terminologies (OntoPortal)",
  },
  {
    id: "ecoportal",
    name: "EcoPortal",
    endpoint: "https://data.ecoportal.lifewatch.eu",
    category: "agri_eco",
    requiresApiKey: true,
    defaultQuery: "marine",
    description: "Ecology & biodiversity repositories (OntoPortal)",
  },
  {
    id: "eu_vocabularies",
    name: "EU Vocabularies",
    endpoint: "https://publications.europa.eu/webapi/rdf/sparql",
    category: "eu_public",
    defaultQuery: "energy",
    description: "EuroVoc & multilingual public sector controlled vocabularies",
  },
  {
    id: "lov",
    name: "LOV (Legacy)",
    endpoint: "https://lov.linkeddata.es/dataset/api/v2",
    category: "general",
    defaultQuery: "sosa",
    description: "Linked Open Vocabularies (circuit breaker protected)",
  },
  {
    id: "custom",
    name: "Custom Endpoint",
    endpoint: "https://",
    category: "custom",
    defaultQuery: "",
    description: "User-defined REST or SPARQL endpoint",
  },
]

interface RegistryPresetSelectorProps {
  selectedId: string
  onSelect: (preset: RegistryPreset) => void
}

export function RegistryPresetSelector({
  selectedId,
  onSelect,
}: RegistryPresetSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-1">
      <span className="text-[11px] font-medium text-muted-foreground mr-1">
        Presets:
      </span>
      {REGISTRY_PRESETS.map((preset) => {
        const isSelected = selectedId === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted/60 text-foreground border-border"
            }`}
          >
            <span>{preset.name}</span>
            {preset.requiresApiKey && (
              <Badge
                variant={isSelected ? "outline" : "secondary"}
                className={`text-[9px] px-1 py-0 h-3.5 uppercase ${
                  isSelected ? "border-primary-foreground/40 text-primary-foreground" : ""
                }`}
              >
                Key
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
