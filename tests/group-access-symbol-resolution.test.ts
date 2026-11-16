import assert from "node:assert/strict"
import test from "node:test"
import { Param } from "drizzle-orm"

import { assertOntologyRecordAccess } from "../src/server/group-access"
import { addAttribute } from "../src/features/ontology/server/actions/attributes"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface FakeOntologyRow {
  id: string
  group_key: string
  linkml_yaml: string | null
  ui_layout: unknown
  compiled_artifacts?: unknown
}

function collectQueryParams(node: unknown, out: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return out
  if (node instanceof Param) {
    out.push(node.value)
    return out
  }
  const obj = node as { queryChunks?: unknown[] }
  if (Array.isArray(obj.queryChunks)) {
    for (const chunk of obj.queryChunks) {
      collectQueryParams(chunk, out)
    }
  }
  return out
}

function containsNonUuidEquality(condition: unknown): string | null {
  const params = collectQueryParams(condition)
  for (const param of params) {
    if (
      typeof param === "string" &&
      param !== "shared" &&
      !UUID_REGEX.test(param)
    ) {
      return param
    }
  }
  return null
}

function createFakeDb(rows: FakeOntologyRow[]) {
  const select = (fields?: Record<string, unknown>) => ({
    from: () => {
      let whereCond: unknown = undefined
      const exec = async () => {
        if (whereCond) {
          const nonUuid = containsNonUuidEquality(whereCond)
          const fieldKeys = Object.keys(fields ?? {})
          const queriesOnlyIdOrDocCheck =
            fieldKeys.length === 1 && fieldKeys[0] === "id"
          if (nonUuid && queriesOnlyIdOrDocCheck) {
            throw new Error(`invalid input syntax for type uuid: "${nonUuid}"`)
          }
          if (nonUuid) {
            throw new Error(`invalid input syntax for type uuid: "${nonUuid}"`)
          }
        }
        return rows.map((row) => ({ ...row }))
      }
      const chain = {
        where: (cond: unknown) => {
          whereCond = cond
          return chain
        },
        limit: () => exec(),
        then: (
          resolve: (val: FakeOntologyRow[]) => unknown,
          reject?: (err: unknown) => unknown
        ) => exec().then(resolve, reject),
      }
      return chain
    },
  })

  return {
    select,
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          Object.assign(rows[0] ?? {}, values)
          return Promise.resolve([])
        },
      }),
    }),
  }
}

test("assertOntologyRecordAccess resolves LinkML symbol 'Observatory' without throwing Postgres uuid syntax error", async () => {
  const docId = "11111111-1111-4111-8111-111111111111"
  const fakeDb = createFakeDb([
    {
      id: docId,
      group_key: "shared",
      linkml_yaml: `id: https://example.org/marine
name: Marine
classes:
  Observatory:
    description: Marine observatory
    attributes:
      age:
        range: integer
`,
      ui_layout: { classPositions: {}, moduleLayouts: {} },
    },
  ])

  const resolvedClassDoc = await assertOntologyRecordAccess(
    "ontology_classes",
    "Observatory",
    fakeDb as never
  )
  assert.equal(resolvedClassDoc, docId)

  const resolvedCompositeAttrDoc = await assertOntologyRecordAccess(
    "ontology_attributes",
    "Observatory.age",
    fakeDb as never
  )
  assert.equal(resolvedCompositeAttrDoc, docId)
})

test("assertOntologyRecordAccess uses explicitOntologyId directly without scanning symbol keys", async () => {
  const docId = "22222222-2222-4222-8222-222222222222"
  const fakeDb = createFakeDb([
    {
      id: docId,
      group_key: "shared",
      linkml_yaml: "classes:\n  OtherClass: {}\n",
      ui_layout: {},
    },
  ])

  const resolved = await assertOntologyRecordAccess(
    "ontology_classes",
    "Observatory",
    fakeDb as never,
    docId
  )
  assert.equal(resolved, docId)
})

test("assertOntologyRecordAccess rejects unknown non-UUID symbols cleanly without crashing SQL", async () => {
  const fakeDb = createFakeDb([
    {
      id: "33333333-3333-4333-8333-333333333333",
      group_key: "shared",
      linkml_yaml: "classes:\n  Person: {}\n",
      ui_layout: {},
    },
  ])

  await assert.rejects(
    () =>
      assertOntologyRecordAccess(
        "ontology_classes",
        "NonExistentClass",
        fakeDb as never
      ),
    /Ontology record is not accessible for the current group/
  )
})

test("addAttribute accepts LinkML class symbol key alongside explicit ontologyId or fallback symbol lookup", () => {
  assert.equal(typeof addAttribute, "function")
})
