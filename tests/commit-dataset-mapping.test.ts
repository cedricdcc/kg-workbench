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
  let updatedYaml = ""

  const mockTx = {
    select: () => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              id: "00000000-0000-0000-0000-000000000001",
              linkml_yaml:
                "id: test\nname: test\nclasses:\n  Project:\n    name: Project\n",
              ui_layout: {},
            },
          ]),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: (val: Record<string, unknown>) => {
        if ("linkml_yaml" in val) {
          updatedYaml = String(val.linkml_yaml)
        }
        return {
          where: () => Promise.resolve([]),
        }
      },
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
        where: () =>
          Promise.resolve([
            {
              id: "00000000-0000-0000-0000-000000000001",
              linkml_yaml:
                "id: test\nname: test\nclasses:\n  Project:\n    name: Project\n",
              ui_layout: {},
            },
          ]),
      }),
    }),
    update: () => ({
      set: (val: Record<string, unknown>) => {
        if ("linkml_yaml" in val) {
          updatedYaml = String(val.linkml_yaml)
        }
        return {
          where: () => Promise.resolve([]),
        }
      },
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
    assert.equal(res.createdAttributesCount, 2)
    assert.match(updatedYaml, /startDate/)
    assert.match(updatedYaml, /endDate/)
    assert.match(updatedYaml, /datetime/i)
  } finally {
    globalThis.kgWorkbenchDrizzle = originalDrizzle
  }
})
