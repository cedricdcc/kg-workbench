import type { VocabularyRegistryProvider } from "../types"
import { BartocProvider } from "./bartoc-provider"
import { CustomProvider } from "./custom-provider"
import { EuVocabulariesProvider } from "./eu-vocabularies-provider"
import { LovProvider } from "./lov-provider"
import { Ols4Provider } from "./ols4-provider"
import { OntoPortalProvider } from "./ontoportal-provider"

export * from "./bartoc-provider"
export * from "./custom-provider"
export * from "./eu-vocabularies-provider"
export * from "./lov-provider"
export * from "./ols4-provider"
export * from "./ontoportal-provider"

const bartoc = new BartocProvider()
const ols4 = new Ols4Provider()
const lov = new LovProvider()
const euVocabularies = new EuVocabulariesProvider()
const custom = new CustomProvider()

const agroportal = new OntoPortalProvider({
  id: "agroportal",
  name: "AgroPortal (Agronomy & Plant Sciences)",
  defaultEndpoint: "https://data.agroportal.eu",
  requiresApiKey: true,
  category: "agri_eco",
})

const bioportal = new OntoPortalProvider({
  id: "bioportal",
  name: "BioPortal (Biomedical & Life Sciences)",
  defaultEndpoint: "https://data.bioontology.org",
  requiresApiKey: true,
  category: "biomedical",
})

const ecoportal = new OntoPortalProvider({
  id: "ecoportal",
  name: "EcoPortal (Ecology & Biodiversity)",
  defaultEndpoint: "https://data.ecoportal.lifewatch.eu",
  requiresApiKey: true,
  category: "agri_eco",
})

const providerRegistry: Record<string, VocabularyRegistryProvider> = {
  ols4,
  bartoc,
  agroportal,
  bioportal,
  ecoportal,
  eu_vocabularies: euVocabularies,
  lov,
  custom,
}

export function getRegistryProvider(id: string): VocabularyRegistryProvider | undefined {
  return providerRegistry[id.toLowerCase()]
}

export function listRegistryProviders(): VocabularyRegistryProvider[] {
  return Object.values(providerRegistry)
}
