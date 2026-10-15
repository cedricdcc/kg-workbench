import { z } from "zod"

export const ReparentClassInputSchema = z.object({
  ontologyId: z.string().uuid(),
  classId: z.string().uuid(),
  targetParentClassId: z.string().uuid().nullable().optional(),
  dropAttributeIds: z.array(z.string().uuid()).optional(),
})

export type ReparentClassInput = z.infer<typeof ReparentClassInputSchema>

export const MergeClassesInputSchema = z.object({
  ontologyId: z.string().uuid(),
  sourceClassId: z.string().uuid(),
  targetClassId: z.string().uuid(),
  retainedAttributeIds: z.array(z.string().uuid()).optional(),
})

export type MergeClassesInput = z.infer<typeof MergeClassesInputSchema>
