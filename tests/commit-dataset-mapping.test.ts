import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("commitDatasetMappingAction rejects missing ontologyId or targetClassName", async () => {
  const { commitDatasetMappingAction } =
    await import("../src/features/tabular/server/actions/commit-dataset-mapping")

  await assert.rejects(
    () =>
      commitDatasetMappingAction({
        ontologyId: "",
        mappingSpec: {
          targetClassName: "Test",
          primaryKeyColumn: "id",
          columnMappings: [],
        },
      }),
    /ontologyId is required/
  )
})

test("commitDatasetMappingAction normalizes xsd:date to xsd:dateTime when inserting attributes", async () => {
  const originalDrizzle = globalThis.kgWorkbenchDrizzle
  const insertedAttributes: Array<{ name: string; data_type: string }> = []

  const mockTx = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    insert: () => ({
      values: (val: Record<string, unknown>) => {
        if ("data_type" in val) {
          insertedAttributes.push({
            name: String(val.name),
            data_type: String(val.data_type),
          })
        }
        return {
          returning: () => Promise.resolve([{ id: "mock-class-id", ...val }]),
        }
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  }

  const mockDb = {
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      return await cb(mockTx)
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve([{ id: "ont-1" }]),
        }),
      }),
    }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.kgWorkbenchDrizzle = mockDb as any

  try {
    const { commitDatasetMappingAction } =
      await import("../src/features/tabular/server/actions/commit-dataset-mapping")

    const res = await commitDatasetMappingAction({
      ontologyId: "00000000-0000-0000-0000-000000000001",
      mappingSpec: {
        targetClassId: "class-1",
        targetClassName: "Project",
        primaryKeyColumn: "id",
        columnMappings: [],
        synthesizedElements: {
          classes: [],
          attributes: [
            {
              className: "Project",
              name: "startDate",
              dataType: "xsd:date",
            },
            {
              className: "Project",
              name: "endDate",
              dataType: "date",
            },
          ],
          relations: [],
        },
      },
    })

    assert.equal(res.ok, true)
    assert.equal(insertedAttributes.length, 2)
    assert.equal(insertedAttributes[0].data_type, "xsd:dateTime")
    assert.equal(insertedAttributes[1].data_type, "xsd:dateTime")
  } finally {
    globalThis.kgWorkbenchDrizzle = originalDrizzle
  }
})
