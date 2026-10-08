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
4. Competency Question Mappings: For every competency question provided, map:
   - subjectClassName: The primary entity class representing the subject.
   - predicateRelationName: The relationship name linking subject to object.
   - objectClassName: The target entity class representing the object.
   - moduleNames: An array of 1 or more module names relevant to this question.
5. Reuse & Alignment: If existing modules, classes, or relations are provided, reuse matching names whenever appropriate rather than introducing redundant aliases.

Output MUST be strictly valid JSON conforming to the requested schema. Return JSON only.`

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

Competency Questions to analyze:
${JSON.stringify(validCQs, null, 2)}

Please output the complete ontology draft containing modules, classes with attributes, relations, and CQ mappings.`

  return { systemPrompt, userPrompt }
}
