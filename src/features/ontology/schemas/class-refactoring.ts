import { z } from "zod"

export const ReparentClassInputSchema = z.object({
  ontologyId: z.string().min(1),
  classId: z.string().min(1),
  targetParentClassId: z.string().min(1).nullable().optional(),
  dropAttributeIds: z.array(z.string().min(1)).optional(),
})

export type ReparentClassInput = z.infer<typeof ReparentClassInputSchema>

export const MergeClassesInputSchema = z.object({
  ontologyId: z.string().min(1),
  sourceClassId: z.string().min(1),
  targetClassId: z.string().min(1),
  retainedAttributeIds: z.array(z.string().min(1)).optional(),
})

export type MergeClassesInput = z.infer<typeof MergeClassesInputSchema>
