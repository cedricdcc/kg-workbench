import type { PromptContext } from "./types"

export function buildOntologyGenerationPrompt(context: PromptContext): {
  systemPrompt: string
  userPrompt: string
} {
  const validCQs = context.competencyQuestions.filter(
    (cq) => cq.question && cq.question.trim().length > 0
  )

  const systemPrompt = `You are an expert ontology engineer and knowledge graph architect.
Your task is to analyze a set of Competency Questions (CQs) for an ontology and design a cohesive, modular ontology schema that directly satisfies them.

Guidelines:
1. Modules: Identify logical cohesive functional domain packages (e.g. "OrderManagement", "Catalog", "UserAccount").
2. Classes: Extract core domain entities. Every class must be assigned to exactly one moduleName. Identify essential primitive attributes (with dataType from xsd:string, xsd:integer, xsd:decimal, xsd:boolean, xsd:dateTime).
3. Relations: Identify direct relationships between classes (domainClassName -> predicate relation name -> rangeClassName).
4. Competency Question Graph Patterns: For every competency question provided, decompose the question into the sequence of connected triples (the graph pattern) required to answer it:
   - triples: An array of 1 or more connected triples [{ subjectClassName, predicateRelationName, objectClassName }]. For multi-hop questions (e.g. "Which sensors measure temperature on station?"), generate consecutive hops sharing intermediate classes (e.g. [Station, hasSensor, Sensor] and [Sensor, measuresProperty, Temperature]). All classes and relations appearing in triples MUST also be declared in the classes and relations sections.
   - moduleNames: An array of 1 or more module names relevant to this question.
5. Reuse & Alignment: If existing modules, classes, or relations are provided, reuse matching names whenever appropriate rather than introducing redundant aliases.
6. Standard Vocabularies & Alignment: If candidate standard terms are provided below, leverage them where appropriate by specifying the optional "alignment" object on classes or relations:
   - mode: "reuse" (directly adopt the standard term name), "subClassOf" (create a domain-specific subclass linked to standard parent), or "equivalentClass".
   - targetCurie: Standard CURIE (e.g. "sosa:Observation", "sosa:Platform").
   - targetIri: Standard canonical IRI.
   - rationale: A concise sentence explaining why this standard concept fits the Competency Question.
7. Functioning OWL Ontology Data Model: The resulting schema must form a coherent, formal OWL ontology where relations specify clear domain and range classes, establishing the foundational schema for knowledge graph fact extraction.

Output MUST be strictly valid JSON conforming to the requested schema. Return JSON only.`

  const candidateTermsSection =
    context.candidateReferenceTerms &&
    context.candidateReferenceTerms.length > 0
      ? `\nCandidate Standard Vocabulary Terms (from active reference ontologies):\n${JSON.stringify(
          context.candidateReferenceTerms.map((t) => ({
            curie: t.curie,
            label: t.label,
            type: t.type,
            description: t.description,
            iri: t.iri,
          })),
          null,
          2
        )}\n`
      : ""

  const userPrompt = `Ontology Document Name: "${context.ontologyName}"
Ontology Usecase/Description: "${context.usecase || "Not specified"}"

Existing Modules: ${
    context.existingModules.length > 0
      ? JSON.stringify(context.existingModules)
      : "None"
  }
Existing Classes: ${
    context.existingClasses.length > 0
      ? JSON.stringify(context.existingClasses)
      : "None"
  }
Existing Relations: ${
    context.existingRelations.length > 0
      ? JSON.stringify(context.existingRelations)
      : "None"
  }
${candidateTermsSection}
Competency Questions to analyze:
${JSON.stringify(validCQs, null, 2)}

Please output the complete ontology draft containing modules, classes with attributes, relations, and CQ mappings.`

  return { systemPrompt, userPrompt }
}
