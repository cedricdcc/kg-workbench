import { z } from "zod"

export const RelationReconciliationDecisionSchema = z.object({
  relationId: z.string().min(1),
  action: z.enum(["keep", "remap", "delete"]),
  remappedName: z.string().trim().optional(),
  remappedDescription: z.string().trim().optional(),
})

export const ReconcileAndAdoptClassInputSchema = z.object({
  ontologyId: z.string().min(1),
  classId: z.string().min(1),
  standardTerm: z.object({
    curie: z.string().trim().min(1),
    label: z.string().trim().min(1),
    description: z.string().optional(),
    iri: z.string().optional(),
  }),
  retainedAttributeIds: z.array(z.string().min(1)),
  relationDecisions: z.array(RelationReconciliationDecisionSchema),
})

export type RelationReconciliationDecision = z.infer<
  typeof RelationReconciliationDecisionSchema
>
export type ReconcileAndAdoptClassInput = z.infer<
  typeof ReconcileAndAdoptClassInputSchema
>
